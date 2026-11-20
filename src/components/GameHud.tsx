import React from 'react';
import {
  Brain,
  Compass,
  Flame,
  FlaskConical,
  Hammer,
  Map as MapIcon,
  Pause,
  Shield,
  Sparkles,
  Swords,
  Volume2,
  VolumeX,
  Wind,
} from 'lucide-react';
import {
  BUILDING_DEFS,
  type BuildingKind,
  DRAGON_ARCHETYPES,
  type DragonCommand,
  FINAL_WAVE,
  WORLD_RADIUS,
} from '../game/data';
import { canAfford } from '../game/balance';
import {
  getDragonCapacity,
  getMissionObjective,
  getSquadDps,
  type GameState,
} from '../game/engine';
import { getActiveTargetCave, isCaveWarded, REGION_ROADS } from '../game/regionMap';
import { WorldMapModal } from './WorldMapModal';

export type SandboxAction =
  | 'fire'
  | 'ice'
  | 'earth'
  | 'electric'
  | 'pack'
  | 'huge'
  | 'boss'
  | 'all_sizes';

interface GameHudProps {
  state: GameState;
  muted: boolean;
  buildOpen: boolean;
  mapOpen: boolean;
  sandboxOpen: boolean;
  banner: { title: string; subtitle: string; color: string } | null;
  buildMessage: string | null;
  onToggleMute: () => void;
  onToggleMap: () => void;
  onToggleSandbox: () => void;
  onSandboxAction: (action: SandboxAction) => void;
  onOpenStudio: () => void;
  onPause: () => void;
  onToggleBuild: () => void;
  onSelectBuild: (kind: BuildingKind | null) => void;
  onQuickBuildAroundCamp: (kind: BuildingKind) => void;
  onCommand: (cmd: DragonCommand) => void;
  onTriggerAttack: () => void;
  onTriggerDash: () => void;
  onTriggerInteract: () => void;
  onSummonWave: () => void;
}

const BUILDING_ORDER: BuildingKind[] = [
  'nest',
  'lumber',
  'quarry',
  'watchtower',
  'training',
  'wall',
];

export const GameHud: React.FC<GameHudProps> = ({
  state,
  muted,
  buildOpen,
  mapOpen,
  sandboxOpen,
  banner,
  buildMessage,
  onToggleMute,
  onToggleMap,
  onToggleSandbox,
  onSandboxAction,
  onOpenStudio,
  onPause,
  onToggleBuild,
  onSelectBuild,
  onQuickBuildAroundCamp,
  onCommand,
  onTriggerAttack,
  onTriggerDash,
  onTriggerInteract,
  onSummonWave,
}) => {
  const campPct = Math.max(0, Math.min(100, (state.campfireHp / state.campfireMaxHp) * 100));
  const playerPct = Math.max(0, Math.min(100, (state.player.hp / state.player.maxHp) * 100));
  const aliveCaves = state.caves.filter((c) => c.alive).length;
  const aliveEnemies = state.enemies.filter((e) => e.koTimer <= 0).length + state.waveQueue.length;
  const boss = state.enemies.find((e) => e.kind === 'boss' && e.koTimer <= 0);
  const wardens = state.enemies.filter((e) => e.kind === 'warden' && e.koTimer <= 0);
  const dragonCap = getDragonCapacity(state);
  const squadDps = getSquadDps(state);
  const objective = getMissionObjective(state);
  const activeTargetCave = getActiveTargetCave(state.caves);
  const claimedRuins = state.ruins.filter((r) => r.claimed).length;

  const radarSize = 128;
  const toRadar = (wx: number, wz: number) => ({
    x: radarSize / 2 + (wx / WORLD_RADIUS) * (radarSize * 0.44),
    y: radarSize / 2 + (wz / WORLD_RADIUS) * (radarSize * 0.44),
  });

  return (
    <div className="fixed inset-0 z-10 pointer-events-none flex flex-col justify-between p-3.5 md:p-4">
      {/* Top Row: Perimeter Kingdom Status (Left) & Tactical Radar + Utilities (Right) */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left Kingdom Cluster */}
        <div
          className="pointer-events-auto rounded-md border border-stone-700/75 px-3.5 py-2.5 min-w-[248px]"
          style={{ backgroundColor: 'rgba(13, 17, 23, 0.88)' }}
        >
          <div className="flex items-center justify-between gap-3 mb-2 text-xs">
            <span className="font-display font-bold tracking-wider text-amber-300">
              {state.isNight ? 'NIGHT DEFENSE' : 'DAY PREP'}
            </span>
            <span className="font-mono-num text-stone-300">
              Wave {Math.max(1, state.wave)}/{FINAL_WAVE}
            </span>
          </div>

          {/* Campfire Vitality */}
          <div className="mb-1.5">
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="text-amber-300 font-medium flex items-center gap-1">
                <Flame className="w-3 h-3" /> Campfire
              </span>
              <span className="font-mono-num text-stone-200">
                {Math.round(state.campfireHp)}/{state.campfireMaxHp}
              </span>
            </div>
            <div className="h-2 bg-stone-800 rounded-sm overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-150"
                style={{ width: `${campPct}%` }}
              />
            </div>
          </div>

          {/* Guardian Vitality */}
          <div className="mb-2.5">
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="text-emerald-300 font-medium flex items-center gap-1">
                <Shield className="w-3 h-3" /> Guardian
              </span>
              <span className="font-mono-num text-stone-200">
                {state.player.respawnTimer > 0
                  ? `Reviving ${Math.ceil(state.player.respawnTimer)}s`
                  : `${Math.round(state.player.hp)}/${state.player.maxHp}`}
              </span>
            </div>
            <div className="h-2 bg-stone-800 rounded-sm overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-150"
                style={{ width: `${playerPct}%` }}
              />
            </div>
          </div>

          {/* 3 Core Resources (Wood / Stone / Ember) */}
          <div className="grid grid-cols-3 gap-2 pt-2 border-t border-stone-700/70 text-xs font-mono-num">
            <div>
              <div className="text-[10px] text-stone-400">WOOD</div>
              <div className="font-semibold text-amber-200">{Math.round(state.resources.wood)}</div>
            </div>
            <div>
              <div className="text-[10px] text-stone-400">STONE</div>
              <div className="font-semibold text-slate-200">{Math.round(state.resources.stone)}</div>
            </div>
            <div>
              <div className="text-[10px] text-stone-400">EMBER</div>
              <div className="font-semibold text-orange-300">{Math.round(state.resources.ember)}</div>
            </div>
          </div>

          {/* Wave Status / Quick Summon */}
          <div className="mt-2 pt-1.5 border-t border-stone-700/60 flex items-center justify-between gap-3 text-[11px]">
            <span className="font-mono-num text-stone-300 whitespace-nowrap">
              {state.waveActive
                ? `Threats: ${aliveEnemies} · Caves: ${aliveCaves}/4`
                : `Next wave: ${Math.ceil(state.prepTimer)}s · Caves: ${aliveCaves}/4`}
            </span>
            {!state.waveActive && (
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onSummonWave();
                }}
                className="px-2 py-0.5 rounded bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold text-[10px] cursor-pointer whitespace-nowrap"
              >
                Start Wave
              </button>
            )}
          </div>
        </div>

        {/* Center Mission Objective Tag, Boss/Warden Bars & Event Banner */}
        <div className="flex flex-col items-center gap-2 max-w-lg mx-auto">
          <div
            data-testid="mission-objective-tag"
            className="pointer-events-auto px-4 py-2 rounded-md border border-amber-500/40 shadow-lg text-center"
            style={{ backgroundColor: 'rgba(13, 17, 23, 0.88)' }}
          >
            <div className="flex items-center justify-center gap-2 text-xs font-display font-bold text-amber-200">
              <Compass className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{objective.title}</span>
              {objective.distanceMeters > 0 && (
                <span className="font-mono-num text-amber-400">
                  · {objective.distanceMeters}m {objective.direction}
                </span>
              )}
            </div>
            <div className="text-[11px] text-stone-300 mt-0.5">{objective.subtitle}</div>
            <div className="text-[10px] font-mono-num text-stone-400 mt-1">
              Explored {objective.explorationPct}% · Ruins {claimedRuins}/{state.ruins.length} · Relics{' '}
              {state.discoveredRelics.length}/4 · Knights {state.protectors.length}
            </div>
          </div>

          {boss && (
            <div
              className="w-80 px-3 py-1.5 rounded border border-red-500/55"
              style={{ backgroundColor: 'rgba(20, 8, 12, 0.92)' }}
            >
              <div className="flex items-center justify-between text-xs font-display font-bold text-red-200 mb-1">
                <span>Nightmare Lord</span>
                <span className="font-mono-num">{Math.round(boss.hp)}/{boss.maxHp}</span>
              </div>
              <div className="h-2.5 bg-stone-900 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-red-600 transition-all duration-150"
                  style={{ width: `${Math.max(0, (boss.hp / boss.maxHp) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {wardens.map((w) => (
            <div
              key={w.id}
              className="w-72 px-3 py-1.5 rounded border border-orange-500/50"
              style={{ backgroundColor: 'rgba(24, 12, 10, 0.90)' }}
            >
              <div className="flex items-center justify-between text-xs font-display font-bold text-orange-200 mb-1">
                <span>Cave Warden</span>
                <span className="font-mono-num">{Math.round(w.hp)}/{w.maxHp}</span>
              </div>
              <div className="h-2 bg-stone-900 rounded-sm overflow-hidden">
                <div
                  className="h-full bg-orange-500 transition-all duration-150"
                  style={{ width: `${Math.max(0, (w.hp / w.maxHp) * 100)}%` }}
                />
              </div>
            </div>
          ))}

          {banner && (
            <div
              className="px-5 py-2.5 rounded-md border border-amber-500/40 text-center shadow-xl"
              style={{ backgroundColor: 'rgba(13, 17, 23, 0.92)' }}
            >
              <div className="font-display text-base font-bold" style={{ color: banner.color }}>
                {banner.title}
              </div>
              <div className="text-xs text-stone-300">{banner.subtitle}</div>
            </div>
          )}
        </div>

        {/* Top-Right Utility Row + Mini Tactical Radar */}
        <div className="flex flex-col items-end gap-2">
          <div className="pointer-events-auto flex items-center gap-1.5">
            <button
              type="button"
              tabIndex={-1}
              aria-label={muted ? 'Unmute Sound' : 'Mute Sound'}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              className="w-9 h-9 rounded border border-stone-700 bg-stone-900/90 hover:bg-stone-800 flex items-center justify-center text-stone-200 cursor-pointer"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Toggle World Map (G)"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMap();
              }}
              className="w-9 h-9 rounded border border-stone-700 bg-stone-900/90 hover:bg-stone-800 flex items-center justify-center text-stone-200 cursor-pointer"
            >
              <MapIcon className="w-4 h-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Toggle Dragon Lab (F2)"
              title="Dragon Ability Lab [F2]"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleSandbox();
              }}
              className={`w-9 h-9 rounded border flex items-center justify-center cursor-pointer ${
                sandboxOpen
                  ? 'border-amber-400 bg-amber-600 text-stone-950'
                  : 'border-stone-700 bg-stone-900/90 hover:bg-stone-800 text-stone-300'
              }`}
            >
              <FlaskConical className="w-4 h-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Elder Strategist & Media Studio (T)"
              onClick={(e) => {
                e.currentTarget.blur();
                onOpenStudio();
              }}
              className="w-9 h-9 rounded border border-stone-700 bg-stone-900/90 hover:bg-stone-800 flex items-center justify-center text-amber-300 cursor-pointer"
            >
              <Brain className="w-4 h-4" />
            </button>
            <button
              type="button"
              tabIndex={-1}
              aria-label="Pause Game (Esc)"
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              className="w-9 h-9 rounded border border-stone-700 bg-stone-900/90 hover:bg-stone-800 flex items-center justify-center text-stone-200 cursor-pointer"
            >
              <Pause className="w-4 h-4" />
            </button>
          </div>

          {/* Tactical Radar */}
          <div
            className="pointer-events-auto rounded-md border border-stone-700/80 p-1.5"
            style={{ backgroundColor: 'rgba(13, 17, 23, 0.88)' }}
          >
            <svg width={radarSize} height={radarSize} className="block" aria-label="Kingdom Radar">
              <circle
                cx={radarSize / 2}
                cy={radarSize / 2}
                r={radarSize * 0.44}
                fill="#101812"
                stroke="#374151"
                strokeWidth="1"
              />
              {REGION_ROADS.map((road) => {
                const pts = road.points
                  .map(([px, pz]) => {
                    const pt = toRadar(px, pz);
                    return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
                  })
                  .join(' ');
                return (
                  <polyline
                    key={road.id}
                    points={pts}
                    fill="none"
                    stroke="#6b5b45"
                    strokeWidth="1.2"
                    strokeOpacity={0.7}
                  />
                );
              })}
              <circle cx={radarSize / 2} cy={radarSize / 2} r={4} fill="#ff7b24" />
              {state.ruins.map((r) => {
                const pt = toRadar(r.x, r.z);
                return (
                  <rect
                    key={r.id}
                    x={pt.x - 2}
                    y={pt.y - 2}
                    width={4}
                    height={4}
                    fill={r.claimed ? '#62e685' : '#f0c250'}
                  />
                );
              })}
              {state.jails.map((j) => {
                if (j.opened) return null;
                const pt = toRadar(j.x, j.z);
                return (
                  <polygon
                    key={j.id}
                    points={`${pt.x},${pt.y - 3} ${pt.x + 3},${pt.y} ${pt.x},${pt.y + 3} ${pt.x - 3},${pt.y}`}
                    fill={DRAGON_ARCHETYPES[j.element].accentColor}
                  />
                );
              })}
              {state.caves.map((c) => {
                const pt = toRadar(c.x, c.z);
                const isTarget = activeTargetCave?.id === c.id;
                const warded = isCaveWarded(c, state.caves);
                return (
                  <g key={c.id}>
                    {isTarget && (
                      <circle cx={pt.x} cy={pt.y} r={5.2} fill="none" stroke="#ff5a36" strokeWidth="1" />
                    )}
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={3.2}
                      fill={!c.alive ? '#4b5563' : isTarget ? '#ef4444' : warded ? '#7c3aed' : '#b85cff'}
                    />
                  </g>
                );
              })}
              {state.wildEggs.map((egg) => {
                const pt = toRadar(egg.x, egg.z);
                return (
                  <circle
                    key={egg.id}
                    cx={pt.x}
                    cy={pt.y}
                    r={1.7}
                    fill={DRAGON_ARCHETYPES[egg.element].color}
                  />
                );
              })}
              {state.enemies.map((en) => {
                if (en.koTimer > 0) return null;
                const pt = toRadar(en.x, en.z);
                return (
                  <circle
                    key={en.id}
                    cx={pt.x}
                    cy={pt.y}
                    r={en.kind === 'boss' || en.kind === 'warden' ? 3.2 : 1.5}
                    fill="#ef4444"
                  />
                );
              })}
              {state.protectors.map((pr) => {
                if (pr.downTimer > 0) return null;
                const pt = toRadar(pr.x, pr.z);
                return <circle key={pr.id} cx={pt.x} cy={pt.y} r={2} fill="#93c5fd" />;
              })}
              {state.dragons.map((d) => {
                const pt = toRadar(d.x, d.z);
                return (
                  <circle
                    key={d.id}
                    cx={pt.x}
                    cy={pt.y}
                    r={Number((2.2 * (d.sizeScale || 1)).toFixed(2))}
                    fill={DRAGON_ARCHETYPES[d.element].accentColor}
                  />
                );
              })}
              {(() => {
                const pt = toRadar(state.player.x, state.player.z);
                return <circle cx={pt.x} cy={pt.y} r={3.0} fill="#60a5fa" stroke="#fff" strokeWidth="1" />;
              })()}
            </svg>
            <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-mono-num text-stone-300 px-1">
              <span>Squad {state.dragons.length}/{dragonCap}</span>
              <span>{Math.round(squadDps)} DPS</span>
            </div>
          </div>

          {sandboxOpen && (
            <div
              className="pointer-events-auto rounded-md border border-amber-500/45 p-2.5 w-60 shadow-xl"
              style={{ backgroundColor: 'rgba(13, 17, 23, 0.94)' }}
            >
              <div className="flex items-center justify-between text-[11px] font-display font-bold text-amber-300 mb-1.5">
                <span>Dragon Ability Lab</span>
                <span className="font-mono-num text-[10px] text-stone-400">[F2]</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-[10px]">
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSandboxAction('fire');
                  }}
                  className="px-2 py-1 rounded bg-red-950/80 hover:bg-red-900 border border-red-700/60 text-red-200 cursor-pointer text-left"
                >
                  Red Fire [4]
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSandboxAction('ice');
                  }}
                  className="px-2 py-1 rounded bg-sky-950/80 hover:bg-sky-900 border border-sky-700/60 text-sky-200 cursor-pointer text-left"
                >
                  Blue Ice [5]
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSandboxAction('earth');
                  }}
                  className="px-2 py-1 rounded bg-lime-950/80 hover:bg-lime-900 border border-lime-700/60 text-lime-200 cursor-pointer text-left"
                >
                  Green Melee [6]
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSandboxAction('electric');
                  }}
                  className="px-2 py-1 rounded bg-yellow-950/80 hover:bg-yellow-900 border border-yellow-700/60 text-yellow-200 cursor-pointer text-left"
                >
                  Yellow Bolt [7]
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSandboxAction('pack');
                  }}
                  className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 cursor-pointer text-left"
                >
                  Spawn Pack [8]
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSandboxAction('huge');
                  }}
                  className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 cursor-pointer text-left"
                >
                  Siege Golem [9]
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSandboxAction('boss');
                  }}
                  className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-red-300 cursor-pointer text-left"
                >
                  Spawn Boss [0]
                </button>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onSandboxAction('all_sizes');
                  }}
                  className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 text-stone-950 font-semibold cursor-pointer text-left"
                >
                  All 4 Sizes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Center World Map Drawer (toggled via G / Map Icon) */}
      {mapOpen && <WorldMapModal state={state} onClose={onToggleMap} />}

      {/* Bottom Contextual Action Bar + Expandable Build Strip */}
      <div className="flex flex-col items-center gap-2">
        {state.contextHint.kind !== 'none' && (
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onTriggerInteract();
            }}
            className="pointer-events-auto px-4 py-1.5 rounded border border-amber-400/70 bg-stone-900/95 text-amber-200 text-xs font-semibold shadow-lg cursor-pointer"
          >
            {state.contextHint.label}
          </button>
        )}

        {buildMessage && (
          <div
            className="px-3 py-1 rounded border border-amber-500/40 text-xs text-amber-200"
            style={{ backgroundColor: 'rgba(13, 17, 23, 0.92)' }}
          >
            {buildMessage}
          </div>
        )}

        {buildOpen && (
          <div
            className="pointer-events-auto rounded-md border border-stone-700/90 p-2.5 max-w-4xl w-full"
            style={{ backgroundColor: 'rgba(13, 17, 23, 0.94)' }}
          >
            <div className="flex items-center justify-between text-xs text-stone-300 mb-2 px-1">
              <span>
                {state.selectedBuild
                  ? `Click on the 3D ground to place ${BUILDING_DEFS[state.selectedBuild].name} (or press Quick Place)`
                  : 'Select a Kingdom Structure to place'}
              </span>
              <button
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleBuild();
                }}
                className="text-stone-400 hover:text-stone-200 cursor-pointer"
              >
                Close [B]
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
              {BUILDING_ORDER.map((kind) => {
                const def = BUILDING_DEFS[kind];
                const affordable = canAfford(state.resources, def.cost);
                const selected = state.selectedBuild === kind;
                return (
                  <div
                    key={kind}
                    className={`rounded border p-2 flex flex-col justify-between gap-1.5 ${
                      selected
                        ? 'border-amber-400 bg-amber-950/50'
                        : 'border-stone-700 bg-stone-900/90'
                    }`}
                  >
                    <div>
                      <div className="text-xs font-semibold text-stone-100">{def.name}</div>
                      <div className="text-[10px] text-stone-400">{def.role}</div>
                      <div className="text-[10px] font-mono-num text-amber-300 mt-1">
                        {def.cost.wood}W · {def.cost.stone}S{def.cost.ember > 0 ? ` · ${def.cost.ember}E` : ''}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        tabIndex={-1}
                        disabled={!affordable}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          onSelectBuild(selected ? null : kind);
                        }}
                        className="flex-1 px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 disabled:opacity-40 text-[10px] text-stone-100 cursor-pointer"
                      >
                        {selected ? 'Placing' : 'Aim'}
                      </button>
                      <button
                        type="button"
                        tabIndex={-1}
                        disabled={!affordable}
                        onClick={(e) => {
                          e.currentTarget.blur();
                          onQuickBuildAroundCamp(kind);
                        }}
                        className="px-2 py-1 rounded bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-[10px] font-semibold text-stone-950 cursor-pointer"
                        title="Place near Guardian"
                      >
                        Build
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Unified Action Dock */}
        <div
          className="pointer-events-auto flex flex-wrap items-center justify-center gap-1.5 rounded-md border border-stone-700/85 px-2.5 py-1.5 shadow-xl"
          style={{ backgroundColor: 'rgba(13, 17, 23, 0.90)' }}
        >
          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onTriggerAttack();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-xs font-medium text-stone-100 cursor-pointer whitespace-nowrap"
          >
            <Swords className="w-3.5 h-3.5 text-amber-400" />
            Attack <span className="text-[10px] text-stone-400 font-mono-num">[Space]</span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onTriggerDash();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-stone-800 hover:bg-stone-700 text-xs font-medium text-stone-100 cursor-pointer whitespace-nowrap"
          >
            <Wind className="w-3.5 h-3.5 text-sky-300" />
            Dash{' '}
            <span className="text-[10px] text-stone-400 font-mono-num">
              {state.player.dashCooldown > 0 ? `${state.player.dashCooldown.toFixed(1)}s` : '[Shift]'}
            </span>
          </button>

          <button
            type="button"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleBuild();
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium cursor-pointer whitespace-nowrap ${
              buildOpen
                ? 'bg-amber-600 text-stone-950 font-semibold'
                : 'bg-stone-800 hover:bg-stone-700 text-stone-100'
            }`}
          >
            <Hammer className="w-3.5 h-3.5" />
            Build <span className="text-[10px] opacity-75 font-mono-num">[B]</span>
          </button>

          <div className="h-5 w-px bg-stone-700 mx-1" aria-hidden="true" />

          {/* Dragon Squad Commands */}
          {(['follow', 'defend', 'attack'] as DragonCommand[]).map((cmd, idx) => {
            const active = state.squadCommand === cmd;
            const labels: Record<DragonCommand, string> = {
              follow: 'Follow',
              defend: 'Defend',
              attack: 'Attack',
            };
            return (
              <button
                key={cmd}
                type="button"
                tabIndex={-1}
                onClick={(e) => {
                  e.currentTarget.blur();
                  onCommand(cmd);
                }}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-amber-500 text-stone-950 font-semibold'
                    : 'bg-stone-800 hover:bg-stone-700 text-stone-200'
                }`}
              >
                <Sparkles className="w-3 h-3" />
                {labels[cmd]} <span className="text-[10px] opacity-75 font-mono-num">[{idx + 1}]</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
