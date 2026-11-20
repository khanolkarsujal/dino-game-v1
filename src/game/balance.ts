import {
  BUILDING_DEFS,
  type BuildingKind,
  DRAGON_ARCHETYPES,
  type DragonElement,
  type EggTier,
  ENEMY_ARCHETYPES,
  type EnemyKind,
  NIGHT_EVERY,
  type ResourceBundle,
  UPGRADE_CARDS,
  type UpgradeCardDef,
} from './data';
import type { SeededRng } from './rng';

/**
 * Controlled mathematical difficulty budget.
 * Never scales enemy HP up based on dragon count!
 * Destroying Monster Caves permanently REDUCES enemy threat budget.
 */
export function computeWaveBudget(wave: number, aliveCaves: number): number {
  const safeWave = Math.max(1, wave);
  const baseBudget = 8 + safeWave * 4.5 + Math.pow(safeWave, 1.32) * 0.9;
  // Each destroyed cave removes 15% of external pressure (4 alive = 1.0, 0 alive = 0.4)
  const caveFactor = 0.4 + 0.15 * Math.max(0, Math.min(4, aliveCaves));
  const isNight = safeWave % NIGHT_EVERY === 0;
  const phaseFactor = isNight ? 1.35 : 0.85;
  return Math.round(baseBudget * caveFactor * phaseFactor);
}

export function selectWaveComposition(
  wave: number,
  aliveCaves: number,
  rng: SeededRng,
): EnemyKind[] {
  const budget = computeWaveCompositionBudget(wave, aliveCaves);
  const unlocked = (Object.values(ENEMY_ARCHETYPES) as (typeof ENEMY_ARCHETYPES)[EnemyKind][])
    .filter((e) => e.kind !== 'boss' && e.unlockWave <= wave);

  const list: EnemyKind[] = [];
  if (wave >= 15) {
    list.push('boss');
  }

  let remaining = budget;
  let guard = 0;
  while (remaining >= 2 && guard < 120) {
    guard++;
    const affordable = unlocked.filter((e) => e.threatCost <= remaining);
    if (affordable.length === 0) break;
    const chosen = rng.pick(affordable);
    list.push(chosen.kind);
    remaining -= chosen.threatCost;
  }

  if (list.length === 0) {
    list.push('raider');
  }
  return list;
}

function computeWaveCompositionBudget(wave: number, aliveCaves: number): number {
  const total = computeWaveBudget(wave, aliveCaves);
  return wave >= 15 ? Math.max(16, total - 18) : total;
}

export function computeEggTierFromDistance(distFromCamp: number): EggTier {
  if (distFromCamp >= 84) return 3; // Solar / Golden reach (Obsidian & Deep Bastion)
  if (distFromCamp >= 52) return 2; // Elite frontier wilds
  if (distFromCamp >= 22) return 1; // Strong outer woods
  return 0; // Common sanctuary edge
}

/**
 * Rarity-weighted wild egg discovery progression:
 * - Common Green (earth): dominant early green-colored dragon eggs
 * - Rare Yellow (electric): rare electric dragon eggs (yellow, stuns and multi-attacks)
 * - Epic Blue (ice): very rare ice dragon eggs (blue, freezes enemies)
 * - Legendary Red (fire): rarest legendary dragon eggs (red, burns people)
 */
export function pickWildEggElementByProgress(
  cavesDestroyed: number,
  rng: SeededRng,
): DragonElement {
  const weights: Array<{ element: DragonElement; weight: number }> =
    cavesDestroyed <= 0
      ? [
          { element: 'earth', weight: 85 },
          { element: 'electric', weight: 15 },
        ]
      : cavesDestroyed === 1
        ? [
            { element: 'earth', weight: 65 },
            { element: 'electric', weight: 28 },
            { element: 'ice', weight: 7 },
          ]
        : cavesDestroyed === 2
          ? [
              { element: 'earth', weight: 52 },
              { element: 'electric', weight: 28 },
              { element: 'ice', weight: 15 },
              { element: 'fire', weight: 5 },
            ]
          : [
              { element: 'earth', weight: 45 },
              { element: 'electric', weight: 27 },
              { element: 'ice', weight: 18 },
              { element: 'fire', weight: 10 },
            ];

  const total = weights.reduce((sum, w) => sum + w.weight, 0);
  let roll = rng.range(0, total);
  for (const entry of weights) {
    roll -= entry.weight;
    if (roll <= 0) return entry.element;
  }
  return 'earth';
}

export function canAfford(bag: ResourceBundle, cost: ResourceBundle): boolean {
  return bag.wood >= cost.wood && bag.stone >= cost.stone && bag.ember >= cost.ember;
}

export function spendResources(bag: ResourceBundle, cost: ResourceBundle): ResourceBundle {
  return {
    wood: Math.max(0, bag.wood - cost.wood),
    stone: Math.max(0, bag.stone - cost.stone),
    ember: Math.max(0, bag.ember - cost.ember),
  };
}

export function buildingCost(kind: BuildingKind): ResourceBundle {
  return BUILDING_DEFS[kind].cost;
}

import { DRAGON_ABILITY_CONFIG } from './dragonConfig';
export function computeDragonDpsEstimate(
  element: DragonElement,
  level: number,
  tier: EggTier,
  dmgMult: number,
  rateMult: number,
): number {
  const arch = DRAGON_ARCHETYPES[element];
  const tierMult = [1, 1.25, 1.55, 1.95][tier];
  const lvlMult = 1 + 0.22 * (level - 1);
  const singleTargetDps = (arch.baseDmg * tierMult * lvlMult * dmgMult) / (arch.attackCooldown / rateMult);
  let multiFactor = 1.0;
  if (element === 'fire') {
    multiFactor = 1.35 * DRAGON_ABILITY_CONFIG.fire.burnBonusDamageMult;
  } else if (element === 'earth') {
    multiFactor = 1.42; // high single-target combo rotation (swipe/whip/bite)
  } else if (element === 'electric') {
    multiFactor = 1.55;
  }
  return Number((singleTargetDps * multiFactor).toFixed(1));
}

export function getSynergisticUpgrades(
  hasDragons: boolean,
  hasBuildings: boolean,
  rng: SeededRng,
): UpgradeCardDef[] {
  const pool = UPGRADE_CARDS.filter((card) => {
    if (card.tag === 'dragons' && !hasDragons) return false;
    if (card.id === 'watch_optics' && !hasBuildings) return false;
    return true;
  });
  const copy = [...pool];
  const picked: UpgradeCardDef[] = [];
  while (picked.length < 3 && copy.length > 0) {
    const idx = rng.int(0, copy.length - 1);
    picked.push(copy.splice(idx, 1)[0]);
  }
  return picked;
}
