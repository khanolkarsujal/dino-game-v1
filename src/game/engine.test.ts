import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEggTierFromDistance,
  computeWaveBudget,
  selectWaveComposition,
} from './balance';
import { BUILDING_DEFS } from './data';
import { createRng } from './rng';
import {
  createInitialState,
  ensureDebugDragon,
  getDragonCapacity,
  issueDragonCommand,
  placeBuilding,
  spawnDebugEnemies,
  steerAroundObstacles,
  stepSimulation,
  summonNextWaveNow,
  triggerDebugDragonAbility,
  type GameInput,
} from './engine';
import { createInitialStatusState } from './statusEffects';
import { DRAGON_ABILITY_CONFIG } from './dragonConfig';

const IDLE_INPUT: GameInput = {
  moveX: 0,
  moveZ: 0,
  attackJustPressed: false,
  dashJustPressed: false,
  interactJustPressed: false,
  commandJustPressed: null,
};

test('difficulty budget rewards destroying caves instead of punishing player', () => {
  const budgetAllCaves = computeWaveBudget(6, 4);
  const budgetTwoCaves = computeWaveBudget(6, 2);
  const budgetZeroCaves = computeWaveBudget(6, 0);

  assert.ok(budgetTwoCaves < budgetAllCaves, 'Destroying caves should lower threat budget');
  assert.ok(budgetZeroCaves < budgetTwoCaves, 'Zero caves should produce lowest threat budget');
});

test('egg tier scales deterministically with distance from campfire', () => {
  assert.equal(computeEggTierFromDistance(12), 0);
  assert.equal(computeEggTierFromDistance(26), 1);
  assert.equal(computeEggTierFromDistance(58), 2);
  assert.equal(computeEggTierFromDistance(92), 3);
});

test('wave 15 composition always includes the Nightmare Lord boss', () => {
  const rng = createRng(42);
  const comp = selectWaveComposition(15, 4, rng);
  assert.ok(comp.includes('boss'), 'Final wave must spawn boss');
});

test('simulation survives initial 10 seconds with no player input', () => {
  const state = createInitialState(1234);
  state.phase = 'playing';
  for (let i = 0; i < 300; i++) {
    stepSimulation(state, 1 / 30, IDLE_INPUT);
  }
  assert.equal(state.phase, 'playing');
  assert.ok(state.campfireHp > 0);
  assert.ok(state.player.hp > 0);
});

test('building placement deducts resources and expands dragon capacity', () => {
  const state = createInitialState(99);
  state.phase = 'playing';
  const baseCap = getDragonCapacity(state);
  const woodBefore = state.resources.wood;
  const stoneBefore = state.resources.stone;
  const res = placeBuilding(state, 'nest', 8, 8);
  assert.equal(res.ok, true);
  assert.equal(state.resources.wood, woodBefore - BUILDING_DEFS.nest.cost.wood);
  assert.equal(state.resources.stone, stoneBefore - BUILDING_DEFS.nest.cost.stone);

  // Finish construction timer
  for (let i = 0; i < 90; i++) {
    stepSimulation(state, 1 / 30, IDLE_INPUT);
  }
  assert.equal(getDragonCapacity(state), baseCap + 2);
});

test('player melee slash damages enemies and grants ember on kill', () => {
  const state = createInitialState(7);
  state.phase = 'playing';
  summonNextWaveNow(state);
  stepSimulation(state, 0.05, IDLE_INPUT); // starts wave 1

  // Place a raider directly in front of player facing +Z
  state.enemies.push({
    id: 9999,
    kind: 'raider',
    x: state.player.x,
    z: state.player.z + 1.5,
    vx: 0,
    vz: 0,
    facingX: 0,
    facingZ: -1,
    hp: 20,
    maxHp: 20,
    slowTimer: 0,
    statuses: createInitialStatusState(),
    buffed: false,
    windupTimer: 0,
    cooldownTimer: 1,
    hasAttackToken: false,
    hitFlash: 0,
    koTimer: 0,
    targetId: null,
    flankSign: 1,
  });
  state.player.facingX = 0;
  state.player.facingZ = 1;

  const emberBefore = state.resources.ember;
  stepSimulation(state, 0.02, { ...IDLE_INPUT, attackJustPressed: true });
  // Advance past windup (0.06s)
  for (let i = 0; i < 6; i++) {
    stepSimulation(state, 0.02, IDLE_INPUT);
  }

  const raider = state.enemies.find((e) => e.id === 9999);
  assert.ok(raider && raider.hp === 0 && raider.koTimer > 0, 'Raider should enter KO topple');
  assert.ok(state.resources.ember > emberBefore, 'Kill should reward Ember');
});

test('dragon squad commands update anchor and tactical mode', () => {
  const state = createInitialState(55);
  state.phase = 'playing';
  state.player.x = 30;
  state.player.z = 10;
  issueDragonCommand(state, 'defend');
  assert.equal(state.squadCommand, 'defend');
  assert.equal(state.defendAnchor.x, 30);
  issueDragonCommand(state, 'attack');
  assert.equal(state.squadCommand, 'attack');
});

test('fire dragon breathes continuous cone stream and applies Burning DoT + damage boost', () => {
  const state = createInitialState(11);
  state.phase = 'playing';
  spawnDebugEnemies(state, 'huge'); // Siege Golem survives multiple ticks
  const siege = state.enemies[0];
  const initialHp = siege.hp;

  triggerDebugDragonAbility(state, 'fire');
  const fireDragon = state.dragons.find((d) => d.element === 'fire')!;
  assert.equal(fireDragon.sizeScale, 1.15);

  let sawFlameStreamEvent = false;
  for (let i = 0; i < 25; i++) {
    stepSimulation(state, 0.04, IDLE_INPUT);
    if (state.events.some((ev) => ev.type === 'dragon_vfx' && ev.kind === 'flame_stream')) {
      sawFlameStreamEvent = true;
    }
  }
  assert.equal(sawFlameStreamEvent, true, 'Fire dragon should emit continuous flame_stream ticks');
  assert.ok(siege.statuses.burning.remaining > 0, 'Enemies in cone should catch Burning');
  assert.ok(siege.hp < initialHp, 'Continuous flame ticks should deal damage');
});

test('ice dragon launches frost ball projectile that freezes small enemies', () => {
  const state = createInitialState(12);
  state.phase = 'playing';
  state.enemies.push({
    id: 8881,
    kind: 'raider',
    x: state.player.x,
    z: state.player.z + 5.5,
    vx: 0,
    vz: 0,
    facingX: 0,
    facingZ: -1,
    hp: 90,
    maxHp: 90,
    slowTimer: 0,
    statuses: createInitialStatusState(),
    buffed: false,
    windupTimer: 0,
    cooldownTimer: 2,
    hasAttackToken: false,
    hitFlash: 0,
    koTimer: 0,
    targetId: null,
    flankSign: 1,
  });
  triggerDebugDragonAbility(state, 'ice');

  let sawFreeze = false;
  for (let i = 0; i < 30; i++) {
    stepSimulation(state, 0.04, IDLE_INPUT);
    if (state.enemies[0]?.statuses.frozen.remaining > 0) {
      sawFreeze = true;
      break;
    }
  }
  assert.equal(sawFreeze, true, 'Frost ball impact should freeze target enemy');
});

test('green melee dragon rotates swipe -> whip -> bite combo and has fastest moveSpeed', () => {
  const state = createInitialState(13);
  state.phase = 'playing';
  const green = ensureDebugDragon(state, 'earth');
  assert.equal(green.sizeScale, 1.4);
  assert.ok(
    DRAGON_ABILITY_CONFIG.stats.earth.moveSpeed > DRAGON_ABILITY_CONFIG.stats.fire.moveSpeed &&
      DRAGON_ABILITY_CONFIG.stats.earth.moveSpeed > DRAGON_ABILITY_CONFIG.stats.ice.moveSpeed &&
      DRAGON_ABILITY_CONFIG.stats.earth.moveSpeed > DRAGON_ABILITY_CONFIG.stats.electric.moveSpeed,
    'Green melee dragon must be fastest',
  );

  spawnDebugEnemies(state, 'huge');
  const seenKinds: string[] = [];
  for (let cycle = 0; cycle < 3; cycle++) {
    triggerDebugDragonAbility(state, 'earth');
    for (let i = 0; i < 20; i++) {
      stepSimulation(state, 0.04, IDLE_INPUT);
      for (const ev of state.events) {
        if (
          ev.type === 'dragon_vfx' &&
          (ev.kind === 'melee_swipe' || ev.kind === 'melee_whip' || ev.kind === 'melee_bite')
        ) {
          seenKinds.push(ev.kind);
        }
      }
    }
  }
  assert.deepEqual(seenKinds.slice(0, 3), ['melee_swipe', 'melee_whip', 'melee_bite']);
});

test('electric dragon prefers groups, chains with exponential falloff, and deals half damage to huge foes', () => {
  const state = createInitialState(14);
  state.phase = 'playing';
  const yellow = ensureDebugDragon(state, 'electric');
  assert.equal(yellow.sizeScale, 0.8);
  yellow.x = 0;
  yellow.z = 8;

  // Add 1 lone Siege Golem close by, and a tight pack of 3 Raiders slightly farther
  const mkEnemy = (id: number, kind: 'raider' | 'siege', x: number, z: number) => ({
    id,
    kind,
    x,
    z,
    vx: 0,
    vz: 0,
    facingX: 0,
    facingZ: -1,
    hp: 150,
    maxHp: 150,
    slowTimer: 0,
    statuses: createInitialStatusState(),
    buffed: false,
    windupTimer: 0,
    cooldownTimer: 2,
    hasAttackToken: false,
    hitFlash: 0,
    koTimer: 0,
    targetId: null,
    flankSign: 1,
  });
  state.enemies.push(mkEnemy(7001, 'siege', 0, 12));
  state.enemies.push(mkEnemy(7002, 'raider', 3, 14));
  state.enemies.push(mkEnemy(7003, 'raider', 4.5, 14.5));
  state.enemies.push(mkEnemy(7004, 'raider', 5.8, 13.8));

  for (let i = 0; i < 15; i++) {
    stepSimulation(state, 0.04, IDLE_INPUT);
  }
  const raider1 = state.enemies.find((e) => e.id === 7002)!;
  const raider2 = state.enemies.find((e) => e.id === 7003)!;
  const siege = state.enemies.find((e) => e.id === 7001)!;
  assert.ok(raider1.hp < 150 && raider2.hp < 150, 'Electric chain should prioritize grouped raiders');
  assert.ok(
    150 - raider1.hp > 150 - raider2.hp,
    'Chain lightning damage should drop off per jump',
  );
  assert.ok(
    150 - siege.hp < 150 - raider1.hp,
    'Huge enemy should receive reduced electric damage if hit',
  );
});

test('steerAroundObstacles deflects melee dragon smoothly around the Campfire plinth', () => {
  const state = createInitialState(15);
  // Standing directly south of Campfire (0, -5), heading straight north (+Z) toward (0, +5)
  const steered = steerAroundObstacles(0, -4.5, 0, 1, 1.33, state, null);
  assert.ok(Math.abs(steered.dirX) > 0.25, 'Should steer tangentially around Campfire');
});

