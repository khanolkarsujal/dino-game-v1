import type { DragonElement, EnemyKind } from './data';

/**
 * Data-driven configuration for all 4 Dragon Colors, Sizes, Abilities,
 * Status Effects, and Pixel-Art Anchors. Tune all numbers here.
 */

export const DRAGON_TEXELS_PER_WORLD_UNIT = 16;
export const BASE_DRAGON_FRAME_PX = 40;

export const HUGE_ENEMY_KINDS: ReadonlySet<EnemyKind> = new Set([
  'brute',
  'siege',
  'warden',
  'boss',
]);

export function isHugeEnemy(kind: EnemyKind): boolean {
  return HUGE_ENEMY_KINDS.has(kind);
}

export type DragonRarity = 'common' | 'rare' | 'epic' | 'legendary';

export const DRAGON_RARITY_META: Record<
  DragonRarity,
  { label: string; shortLabel: string; color: string; rank: number; description: string }
> = {
  common: {
    label: 'Common',
    shortLabel: 'Common',
    color: '#73cc58',
    rank: 1,
    description: 'Common green-colored dragon found early as a reliable frontline tank.',
  },
  rare: {
    label: 'Rare',
    shortLabel: 'Rare',
    color: '#ffd24a',
    rank: 2,
    description: 'Rare yellow-colored electric dragon with the ability to stun enemies and attack multiple enemies at once.',
  },
  epic: {
    label: 'Epic',
    shortLabel: 'Epic',
    color: '#5ec9ff',
    rank: 3,
    description: 'Epic blue-colored ice dragon with the ability to freeze enemies.',
  },
  legendary: {
    label: 'Legendary',
    shortLabel: 'Legendary',
    color: '#ff6b35',
    rank: 4,
    description: 'Legendary red dragon with the ability to burn people and deal massive damage.',
  },
};

export interface DragonStatsConfig {
  colorName: 'red' | 'blue' | 'green' | 'yellow';
  rarity: DragonRarity;
  /** True for frontline melee tanks (Green Bastion Drake) */
  isFrontliner: boolean;
  /** Multiplier to damage received from Warden / Boss / Siege heavy hitters */
  bossDamageTakenMult: number;
  /** General damage taken multiplier (armor mitigation) */
  generalDamageTakenMult: number;
  /** Preferred combat standoff distance factor behind frontline (0 = vanguard rusher) */
  preferredStandOff: number;
  /** Uniform pixel-density scale multiplier (renders larger/smaller sprites at fixed texels/unit) */
  sizeScale: number;
  /** Physical collision & formation spacing radius (scales with sizeScale) */
  collisionRadius: number;
  /** Effect scale multiplier (e.g. bigger slashes for green, smaller sparks for yellow) */
  effectScale: number;
  baseHp: number;
  baseDmg: number;
  moveSpeed: number;
  attackRange: number;
  attackCooldown: number;
  anticipationSec: number;
  recoverySec: number;
  tauntRadius: number;
}

export interface FireAbilityConfig {
  /** Forward length of the continuous flame cone/beam */
  beamLength: number;
  /** Half-width of flame beam at max reach */
  beamHalfWidth: number;
  /** Seconds between damage & burn ticks while streaming */
  tickInterval: number;
  /** Fraction of dragon attack damage applied per stream tick */
  tickDamageMult: number;
  /** Continuous flame hold duration per attack cycle (loops while target stays in range) */
  streamHoldSec: number;
  /** Burning DoT duration (refreshed on re-hit, never stacks infinitely) */
  burnDuration: number;
  /** Burning DPS fraction of dragon baseDmg */
  burnDpsFactor: number;
  /** Multiplier applied to ALL damage sources against Burning enemies (e.g. 1.25 = +25%) */
  burnBonusDamageMult: number;
}

export interface IceAbilityConfig {
  projectileSpeed: number;
  /** Freeze duration for normal/small enemies */
  freezeDuration: number;
  /** Cooldown after freeze ends before enemy can be frozen again */
  freezeImmunitySec: number;
  /** Multiplier to freeze duration for Brute/Siege (boss ignores full freeze and receives slow instead) */
  hugeFreezeDurationMult: number;
  /** Slow duration applied to huge enemies / bosses when freeze is resisted or shortened */
  hugeSlowSec: number;
  /** Extra damage multiplier on melee hits vs Frozen enemies (set 1.0 to disable) */
  frozenMeleeBonusMult: number;
}

export interface MeleeComboStepConfig {
  id: 'swipe' | 'whip' | 'bite';
  label: string;
  dmgMult: number;
  radius: number;
  isCircleAoe: boolean;
  lungeDist: number;
  anticipationSec: number;
  recoverySec: number;
  hitstopSec: number;
}

export interface GreenMeleeConfig {
  /** Strictly melee range cap — never attacks from afar */
  maxMeleeRange: number;
  comboRotation: readonly [MeleeComboStepConfig, MeleeComboStepConfig, MeleeComboStepConfig];
}

export interface ElectricAbilityConfig {
  /** Number of enemies hit across the chain (1st target + jumps, configurable 3-5) */
  chainTargets: number;
  /** Maximum jump radius between chained enemies */
  maxJumpDist: number;
  /** Damage multiplier compounded per jump (e.g. 0.72 -> 100%, 72%, 52%, 37%...) */
  jumpDamageDecay: number;
  /** Stun probability (0..1) on small/regular enemies */
  stunChanceSmall: number;
  stunDurationSmall: number;
  /** Post-stun immunity so one enemy cannot be permanently stun-locked */
  stunImmunitySec: number;
  /** Reduced damage multiplier against huge enemies (brute/siege/warden/boss) */
  hugeDamageMult: number;
  /** Low stun chance against Brute/Siege (Boss is stun-immune) */
  hugeStunChance: number;
  hugeStunDuration: number;
  /** Target scoring weight favoring clustered groups and avoiding lone huge targets */
  groupNeighborBonus: number;
  hugeTargetPenalty: number;
}

export const DRAGON_ABILITY_CONFIG: {
  stats: Record<DragonElement, DragonStatsConfig>;
  fire: FireAbilityConfig;
  ice: IceAbilityConfig;
  green: GreenMeleeConfig;
  electric: ElectricAbilityConfig;
  pixelVfx: {
    maxParticlesPerPool: number;
    maxLightningSegments: number;
    maxFloatingNumbers: number;
    maxTrauma: number;
  };
} = {
  stats: {
    earth: {
      colorName: 'green',
      rarity: 'common',
      isFrontliner: true,
      bossDamageTakenMult: 0.42, // Frontline scales shrug off Cave Warden / Boss strikes
      generalDamageTakenMult: 0.72,
      preferredStandOff: 0,
      sizeScale: 1.4,
      collisionRadius: 0.95 * 1.4,
      effectScale: 1.4,
      baseHp: 220, // Common tank vitality + 0.42x boss mitigation
      baseDmg: 18, // Common tier base damage
      moveSpeed: 9.6, // Fastest dragon — melee vanguard
      attackRange: 2.55, // Strict melee range only
      attackCooldown: 0.78,
      anticipationSec: 0.1,
      recoverySec: 0.16,
      tauntRadius: 11.5, // Captures aggro of bosses & cave defenders away from backliners
    },
    electric: {
      colorName: 'yellow',
      rarity: 'rare',
      isFrontliner: false,
      bossDamageTakenMult: 1.40, // Fragile backliner — stay behind Green frontliner
      generalDamageTakenMult: 1.0,
      preferredStandOff: 3.2,
      sizeScale: 0.8,
      collisionRadius: 0.8 * 0.8,
      effectScale: 0.8,
      baseHp: 125, // Rare tier vitality
      baseDmg: 26, // Rare tier base damage (+44% over Common)
      moveSpeed: 8.8,
      attackRange: 9.6,
      attackCooldown: 0.88,
      anticipationSec: 0.12,
      recoverySec: 0.18,
      tauntRadius: 0,
    },
    ice: {
      colorName: 'blue',
      rarity: 'epic',
      isFrontliner: false,
      bossDamageTakenMult: 1.32,
      generalDamageTakenMult: 0.92,
      preferredStandOff: 3.0,
      sizeScale: 1.0,
      collisionRadius: 0.85 * 1.0,
      effectScale: 1.0,
      baseHp: 160, // Epic tier vitality
      baseDmg: 32, // Epic tier base damage (+Freeze CC)
      moveSpeed: 8.0,
      attackRange: 9.2,
      attackCooldown: 0.92,
      anticipationSec: 0.14,
      recoverySec: 0.2,
      tauntRadius: 0,
    },
    fire: {
      colorName: 'red',
      rarity: 'legendary',
      isFrontliner: false,
      bossDamageTakenMult: 1.28, // High-damage backliner — still relies on Green tank vs bosses
      generalDamageTakenMult: 0.88,
      preferredStandOff: 2.2,
      sizeScale: 1.15,
      collisionRadius: 0.88 * 1.15,
      effectScale: 1.15,
      baseHp: 210, // Legendary vitality
      baseDmg: 52, // Legendary apex damage!
      moveSpeed: 8.4,
      attackRange: 7.6,
      attackCooldown: 0.82,
      anticipationSec: 0.14,
      recoverySec: 0.22,
      tauntRadius: 0,
    },
  },
  fire: {
    beamLength: 7.8,
    beamHalfWidth: 1.8,
    tickInterval: 0.2,
    tickDamageMult: 0.28,
    streamHoldSec: 1.0,
    burnDuration: 3.5,
    burnDpsFactor: 0.35,
    burnBonusDamageMult: 1.25,
  },
  ice: {
    projectileSpeed: 16.5,
    freezeDuration: 2.2,
    freezeImmunitySec: 2.1,
    hugeFreezeDurationMult: 0.3,
    hugeSlowSec: 2.6,
    frozenMeleeBonusMult: 1.25,
  },
  green: {
    maxMeleeRange: 2.7,
    comboRotation: [
      {
        id: 'swipe',
        label: 'Claw Swipe',
        dmgMult: 0.95,
        radius: 2.85,
        isCircleAoe: false,
        lungeDist: 0.35,
        anticipationSec: 0.08,
        recoverySec: 0.13,
        hitstopSec: 0,
      },
      {
        id: 'whip',
        label: 'Tail Whip',
        dmgMult: 1.15,
        radius: 3.7,
        isCircleAoe: true,
        lungeDist: 0,
        anticipationSec: 0.12,
        recoverySec: 0.17,
        hitstopSec: 0.02,
      },
      {
        id: 'bite',
        label: 'Heavy Bite',
        dmgMult: 2.05,
        radius: 3.15,
        isCircleAoe: false,
        lungeDist: 2.2,
        anticipationSec: 0.18,
        recoverySec: 0.25,
        hitstopSec: 0.045,
      },
    ],
  },
  electric: {
    chainTargets: 4, // 1 primary + 3 jumps (configurable 3-5)
    maxJumpDist: 7.2,
    jumpDamageDecay: 0.72,
    stunChanceSmall: 0.88,
    stunDurationSmall: 1.15,
    stunImmunitySec: 1.7,
    hugeDamageMult: 0.5,
    hugeStunChance: 0.15,
    hugeStunDuration: 0.25,
    groupNeighborBonus: 5.5,
    hugeTargetPenalty: 14,
  },
  pixelVfx: {
    maxParticlesPerPool: 128,
    maxLightningSegments: 48,
    maxFloatingNumbers: 48,
    maxTrauma: 0.32,
  },
};

export function getDragonFrameSizePx(element: DragonElement): number {
  return Math.round(BASE_DRAGON_FRAME_PX * DRAGON_ABILITY_CONFIG.stats[element].sizeScale);
}
