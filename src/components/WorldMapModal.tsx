import React, { useState } from 'react';
import { Compass, Crown, Flame, Lock, Shield, Skull, Sparkles } from 'lucide-react';
import { DRAGON_ARCHETYPES, RELIC_DEFS, WORLD_RADIUS } from '../game/data';
import { DRAGON_ABILITY_CONFIG } from '../game/dragonConfig';
import { getDragonCapacity, getMissionObjective, type GameState } from '../game/engine';
import {
  BIOME_META,
  FOG_GRID_SIZE,
  getActiveTargetCave,
  getExplorationPercent,
  isCaveWarded,
  isFogExplored,
  REGION_ROADS,
} from '../game/regionMap';

interface WorldMapModalProps {
  state: GameState;
  onClose: () => void;
}

type MapTab = 'squad' | 'relics' | 'chronicle';

export const WorldMapModal: React.FC<WorldMapModalProps> = ({ state, onClose }) => {
  const [tab, setTab] = useState<MapTab>('squad');
  const mapSize = 376;
  const toSvg = (wx: number, wz: number) => ({
    x: mapSize / 2 + (wx / WORLD_RADIUS) * (mapSize * 0.45),
    y: mapSize / 2 + (wz / WORLD_RADIUS) * (mapSize * 0.45),
  });

  const activeCave = getActiveTargetCave(state.caves);
  const objective = getMissionObjective(state);
  const exploredPct = getExplorationPercent(state.fogGrid);
  const dragonCap = getDragonCapacity(state);

  const fogCellPx = (mapSize * 0.9) / FOG_GRID_SIZE;
  const fogOffset = mapSize * 0.05;

  return (
    <div
      className="pointer-events-auto my-auto mx-auto rounded-lg border border-amber-500/40 p-4 md:p-5 max-w-4xl w-full shadow-2xl"
      style={{ backgroundColor: 'rgba(13, 17, 23, 0.96)' }}
    >
      <div className="flex items-center justify-between gap-4 mb-3 pb-2.5 border-b border-stone-800">
        <div>
          <h3 className="font-display text-lg font-bold text-amber-200 flex items-center gap-2">
            <Compass className="w-5 h-5 text-amber-400" />
            Kingdom of Elderglen · Regional Survey
          </h3>
          <div className="text-xs text-stone-400 font-mono-num mt-0.5">
            {objective.title} · {objective.distanceMeters}m {objective.direction} · Region Explored: {exploredPct}%
          </div>
        </div>
        <button
          type="button"
          tabIndex={-1}
          onClick={(e) => {
            e.currentTarget.blur();
            onClose();
          }}
          className="px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-xs font-medium text-stone-200 cursor-pointer"
        >
          Close [G]
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[376px_1fr] gap-4">
        {/* Left: Fog-of-War Interactive SVG Map */}
        <div className="flex flex-col items-center">
          <svg
            width={mapSize}
            height={mapSize}
            viewBox={`0 0 ${mapSize} ${mapSize}`}
            className="rounded border border-stone-700 bg-[#0d1410]"
            aria-label="Elderglen Region Map"
          >
            {/* Biome Quadrant Tints */}
            <path
              d={`M ${mapSize / 2} ${mapSize / 2} L ${mapSize} 0 L ${mapSize} ${mapSize} Z`}
              fill={BIOME_META.woods.accentHex}
              fillOpacity={0.14}
            />
            <path
              d={`M ${mapSize / 2} ${mapSize / 2} L ${mapSize} ${mapSize} L 0 ${mapSize} Z`}
              fill={BIOME_META.frost.accentHex}
              fillOpacity={0.14}
            />
            <path
              d={`M ${mapSize / 2} ${mapSize / 2} L 0 ${mapSize} L 0 0 Z`}
              fill={BIOME_META.bastion.accentHex}
              fillOpacity={0.14}
            />
            <path
              d={`M ${mapSize / 2} ${mapSize / 2} L 0 0 L ${mapSize} 0 Z`}
              fill={BIOME_META.obsidian.accentHex}
              fillOpacity={0.18}
            />

            <circle
              cx={mapSize / 2}
              cy={mapSize / 2}
              r={mapSize * 0.45}
              fill="none"
              stroke="#334155"
              strokeWidth="1.2"
              strokeDasharray="4 4"
            />

            {/* Winding Roads */}
            {REGION_ROADS.map((road) => {
              const pts = road.points
                .map(([px, pz]) => {
                  const s = toSvg(px, pz);
                  return `${s.x.toFixed(1)},${s.y.toFixed(1)}`;
                })
                .join(' ');
              return (
                <polyline
                  key={road.id}
                  points={pts}
                  fill="none"
                  stroke="#a88b64"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={0.75}
                />
              );
            })}

            {/* Fog of War Unexplored Shroud */}
            {Array.from({ length: FOG_GRID_SIZE }).map((_, gz) =>
              Array.from({ length: FOG_GRID_SIZE }).map((__, gx) => {
                const wx = ((gx + 0.5) / FOG_GRID_SIZE) * (WORLD_RADIUS * 2) - WORLD_RADIUS;
                const wz = ((gz + 0.5) / FOG_GRID_SIZE) * (WORLD_RADIUS * 2) - WORLD_RADIUS;
                if (isFogExplored(state.fogGrid, wx, wz)) return null;
                return (
                  <rect
                    key={`${gx}-${gz}`}
                    x={fogOffset + gx * fogCellPx}
                    y={fogOffset + gz * fogCellPx}
                    width={fogCellPx + 0.6}
                    height={fogCellPx + 0.6}
                    fill="#070a0f"
                    fillOpacity={0.72}
                  />
                );
              }),
            )}

            {/* Biome Region Labels */}
            <text
              x={mapSize * 0.78}
              y={mapSize * 0.42}
              fontSize="9"
              fill="#9ee38b"
              fillOpacity={0.9}
              stroke="#070a0f"
              strokeWidth="2.5"
              paintOrder="stroke"
              textAnchor="middle"
              fontWeight="700"
            >
              WHISPERING WOODS
            </text>
            <text
              x={mapSize * 0.42}
              y={mapSize * 0.89}
              fontSize="9"
              fill="#a8d1ef"
              fillOpacity={0.9}
              stroke="#070a0f"
              strokeWidth="2.5"
              paintOrder="stroke"
              textAnchor="middle"
              fontWeight="700"
            >
              FROSTQUARRY RIDGE
            </text>
            <text
              x={mapSize * 0.22}
              y={mapSize * 0.34}
              fontSize="9"
              fill="#d6c8ad"
              fillOpacity={0.9}
              stroke="#070a0f"
              strokeWidth="2.5"
              paintOrder="stroke"
              textAnchor="middle"
              fontWeight="700"
            >
              SHATTERED BASTION
            </text>
            <text
              x={mapSize * 0.55}
              y={mapSize * 0.11}
              fontSize="9"
              fill="#eb8ea5"
              fillOpacity={0.92}
              stroke="#070a0f"
              strokeWidth="2.5"
              paintOrder="stroke"
              textAnchor="middle"
              fontWeight="700"
            >
              OBSIDIAN RIFT
            </text>

            {/* Lost Ruins */}
            {state.ruins.map((r) => {
              const pt = toSvg(r.x, r.z);
              return (
                <g key={r.id}>
                  <rect
                    x={pt.x - 4.5}
                    y={pt.y - 4.5}
                    width={9}
                    height={9}
                    fill={r.claimed ? '#62e685' : '#f0c250'}
                    stroke="#111827"
                    strokeWidth="1"
                  />
                </g>
              );
            })}

            {/* Shadow Dragon Jails */}
            {state.jails.map((j) => {
              const pt = toSvg(j.x, j.z);
              const col = DRAGON_ARCHETYPES[j.element].accentColor;
              return (
                <g key={j.id}>
                  <polygon
                    points={`${pt.x},${pt.y - 6} ${pt.x + 6},${pt.y} ${pt.x},${pt.y + 6} ${pt.x - 6},${pt.y}`}
                    fill={j.opened ? '#374151' : col}
                    stroke="#0f172a"
                    strokeWidth="1"
                  />
                </g>
              );
            })}

            {/* Wild Eggs */}
            {state.wildEggs.map((egg) => {
              const pt = toSvg(egg.x, egg.z);
              return (
                <circle
                  key={egg.id}
                  cx={pt.x}
                  cy={pt.y}
                  r={2.5}
                  fill={DRAGON_ARCHETYPES[egg.element].accentColor}
                  fillOpacity={0.85}
                />
              );
            })}

            {/* Numbered Monster Caves (1 -> 2 -> 3 -> 4) */}
            {state.caves.map((c) => {
              const pt = toSvg(c.x, c.z);
              const warded = isCaveWarded(c, state.caves);
              const isTarget = activeCave?.id === c.id;
              return (
                <g key={c.id}>
                  {isTarget && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={13}
                      fill="none"
                      stroke="#ff5a36"
                      strokeWidth="1.8"
                      strokeDasharray="3 2"
                    />
                  )}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={8}
                    fill={!c.alive ? '#374151' : isTarget ? '#dc2626' : warded ? '#6d28d9' : '#9333ea'}
                    stroke="#f8fafc"
                    strokeWidth="1.2"
                  />
                  <text
                    x={pt.x}
                    y={pt.y + 3.5}
                    fontSize="9.5"
                    fill="#ffffff"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    {c.alive ? c.index : 'X'}
                  </text>
                </g>
              );
            })}

            {/* Sunfire Campfire Citadel */}
            <circle cx={mapSize / 2} cy={mapSize / 2} r={6.5} fill="#ff8a24" stroke="#fff3d6" strokeWidth="1.2" />

            {/* Oathbound Protectors */}
            {state.protectors.map((pr) => {
              if (pr.downTimer > 0) return null;
              const pt = toSvg(pr.x, pr.z);
              return <circle key={pr.id} cx={pt.x} cy={pt.y} r={3} fill="#93c5fd" />;
            })}

            {/* Dragons */}
            {state.dragons.map((d) => {
              const pt = toSvg(d.x, d.z);
              return (
                <circle
                  key={d.id}
                  cx={pt.x}
                  cy={pt.y}
                  r={3.5 * (d.sizeScale || 1)}
                  fill={DRAGON_ARCHETYPES[d.element].accentColor}
                  stroke="#0f172a"
                  strokeWidth="0.8"
                />
              );
            })}

            {/* Guardian */}
            {(() => {
              const pt = toSvg(state.player.x, state.player.z);
              return <circle cx={pt.x} cy={pt.y} r={4.5} fill="#60a5fa" stroke="#ffffff" strokeWidth="1.5" />;
            })()}
          </svg>

          {/* Compact Map Legend */}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-stone-400">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 inline-block rounded-full bg-red-600 border border-white" /> Active Cave
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 inline-block rounded-full bg-violet-700 border border-white" /> Warded Cave
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 inline-block bg-amber-300" /> Ruin
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 inline-block rotate-45 bg-lime-400" /> Dragon Jail
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 inline-block rounded-full bg-blue-400 border border-white" /> You
            </span>
          </div>
        </div>

        {/* Right: Conquest Sequence + Squad Roles / Relics / Chronicles */}
        <div className="flex flex-col gap-3 text-xs min-h-[376px]">
          {/* Sequential Cave Targets */}
          <div className="p-3 rounded bg-stone-900/95 border border-stone-800">
            <div className="text-[11px] font-display font-bold uppercase tracking-wider text-amber-300 mb-2 flex items-center gap-1.5">
              <Skull className="w-3.5 h-3.5" /> Sequential Cave Conquest Order
            </div>
            <div className="grid grid-cols-2 gap-1.5 font-mono-num">
              {state.caves.map((c) => {
                const warded = isCaveWarded(c, state.caves);
                const isTarget = activeCave?.id === c.id;
                return (
                  <div
                    key={c.id}
                    className={`px-2.5 py-1.5 rounded border ${
                      !c.alive
                        ? 'border-stone-800 bg-stone-950/60 text-stone-500'
                        : isTarget
                          ? 'border-red-500/70 bg-red-950/35 text-red-100'
                          : 'border-violet-800/60 bg-violet-950/20 text-violet-300'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold">
                      <span>
                        {c.index}. {c.name}
                      </span>
                      {warded && c.alive && <Lock className="w-3 h-3 text-violet-400" />}
                    </div>
                    <div className="text-[10px] mt-0.5 text-stone-300">
                      {!c.alive
                        ? 'Collapsed'
                        : isTarget
                          ? `TARGET · ${Math.round((c.hp / c.maxHp) * 100)}% HP`
                          : 'Void-Warded (Clear prior)'}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Sub-tabs for Squad Roles, Relics, Chronicles */}
          <div className="flex gap-1.5 border-b border-stone-800 pb-1.5">
            {(
              [
                { id: 'squad', label: `Squad & Roles (${state.dragons.length}/${dragonCap})` },
                { id: 'relics', label: `Relics (${state.discoveredRelics.length}/4)` },
                { id: 'chronicle', label: `Chronicles (${state.chronicleLog.length})` },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setTab(t.id);
                }}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                  tab === t.id
                    ? 'bg-amber-600 text-stone-950'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto max-h-[225px] pr-1 space-y-2">
            {tab === 'squad' && (
              <>
                {!objective.hasFrontliner && (
                  <div className="p-2.5 rounded border border-amber-500/40 bg-amber-950/30 text-amber-200 text-[11px]">
                    Tactical Advisory: You have no Green Bastion Drake frontliner yet. Follow King&apos;s Timber Road East to free the trapped Green Drake before sieging caves!
                  </div>
                )}
                {state.dragons.map((d) => {
                  const cfg = DRAGON_ABILITY_CONFIG.stats[d.element];
                  return (
                    <div
                      key={d.id}
                      className="flex items-center justify-between px-2.5 py-2 rounded bg-stone-900 border border-stone-800 font-mono-num"
                    >
                      <div>
                        <div className="font-semibold" style={{ color: DRAGON_ARCHETYPES[d.element].accentColor }}>
                          {DRAGON_ARCHETYPES[d.element].name} · Lv{d.level}
                        </div>
                        <div className="text-[10px] text-stone-400">
                          {cfg.isFrontliner ? 'FRONTLINE TANK (Taunt · -58% Boss Dmg)' : 'BACKLINER DPS (Keep behind tank)'}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-stone-200">
                          {d.downTimer > 0 ? `KO ${Math.ceil(d.downTimer)}s` : `${Math.round(d.hp)}/${d.maxHp} HP`}
                        </div>
                        <div className="text-[10px] text-stone-400">{d.sizeScale.toFixed(2)}x</div>
                      </div>
                    </div>
                  );
                })}
                {state.protectors.map((pr) => (
                  <div
                    key={pr.id}
                    className="flex items-center justify-between px-2.5 py-2 rounded bg-stone-900 border border-sky-900/60 font-mono-num"
                  >
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-sky-400" />
                      <div>
                        <div className="font-semibold text-sky-200">{pr.name}</div>
                        <div className="text-[10px] text-stone-400">OATHBOUND FRONTLINE ESCORT</div>
                      </div>
                    </div>
                    <div className="text-sky-200">
                      {pr.downTimer > 0 ? `KO ${Math.ceil(pr.downTimer)}s` : `${Math.round(pr.hp)}/${pr.maxHp} HP`}
                    </div>
                  </div>
                ))}
              </>
            )}

            {tab === 'relics' && (
              <div className="space-y-2">
                {Object.values(RELIC_DEFS).map((relic) => {
                  const found = state.discoveredRelics.includes(relic.id);
                  return (
                    <div
                      key={relic.id}
                      className={`p-2.5 rounded border ${
                        found ? 'border-amber-500/40 bg-stone-900' : 'border-stone-800 bg-stone-950/60 opacity-60'
                      }`}
                    >
                      <div className="flex items-center justify-between font-semibold" style={{ color: found ? relic.color : '#9ca3af' }}>
                        <span className="flex items-center gap-1.5">
                          <Crown className="w-3.5 h-3.5" />
                          {relic.name}
                        </span>
                        <span className="text-[10px] font-mono-num">{found ? 'RECLAIMED' : 'LOST IN RUINS'}</span>
                      </div>
                      <div className="text-[11px] text-stone-300 mt-1">{relic.effectText}</div>
                      {found && <div className="text-[10px] text-stone-400 italic mt-1">{relic.lore}</div>}
                    </div>
                  );
                })}
              </div>
            )}

            {tab === 'chronicle' && (
              <div className="space-y-2">
                {[...state.chronicleLog].reverse().map((entry) => (
                  <div key={entry.id} className="p-2.5 rounded bg-stone-900 border border-stone-800">
                    <div className="font-semibold flex items-center gap-1.5" style={{ color: entry.color }}>
                      {entry.title.includes('Awakening') ? <Flame className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                      {entry.title}
                    </div>
                    <div className="text-[11px] text-stone-300 mt-1 leading-relaxed">{entry.text}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
