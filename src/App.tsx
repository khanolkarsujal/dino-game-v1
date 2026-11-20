import { useCallback, useEffect, useRef, useState } from 'react';
import { GameHud } from './components/GameHud';
import { IntroCutscene } from './components/IntroCutscene';
import { MediaStudioModal } from './components/MediaStudioModal';
import {
  EndModal,
  PauseModal,
  QuitModal,
  SettingsModal,
  UpgradeModal,
} from './components/Modals';
import { TitleOverlay } from './components/TitleOverlay';
import { BUILDING_DEFS, type BuildingKind, type DragonCommand } from './game/data';
import {
  applyUpgradeCard,
  createInitialState,
  type GamePhase,
  type GameState,
  issueDragonCommand,
  placeBuilding,
  stepSimulation,
  summonNextWaveNow,
} from './game/engine';
import { getExplorationPercent } from './game/regionMap';
import { soundEngine } from './three/audio';
import { mountWorldScene, type WorldController } from './three/WorldScene';

function readSavedRecord(): { bestWave: number; victories: number } {
  try {
    const raw = localStorage.getItem('dc_kingdom_best');
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore storage errors
  }
  return { bestWave: 0, victories: 0 };
}

function saveRecord(wave: number, victory: boolean): { bestWave: number; victories: number } {
  const prev = readSavedRecord();
  const next = {
    bestWave: Math.max(prev.bestWave, wave),
    victories: prev.victories + (victory ? 1 : 0),
  };
  try {
    localStorage.setItem('dc_kingdom_best', JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  return next;
}

export default function App() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const worldRef = useRef<WorldController | null>(null);
  const stateRef = useRef<GameState>(createInitialState());

  const [tick, setTick] = useState(0);
  void tick;
  const [buildOpen, setBuildOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [sandboxOpen, setSandboxOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [studioOpen, setStudioOpen] = useState(false);
  const [quitOpen, setQuitOpen] = useState(false);
  const [muted, setMuted] = useState(() => soundEngine.isMuted());
  const [playIntroOnStart, setPlayIntroOnStart] = useState(true);
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [banner, setBanner] = useState<{ title: string; subtitle: string; color: string } | null>(null);
  const [buildMsg, setBuildMsg] = useState<string | null>(null);
  const [record, setRecord] = useState(readSavedRecord);

  const bannerTimerRef = useRef<number>(0);
  const buildMsgTimerRef = useRef<number>(0);
  const recordedEndRef = useRef(false);

  const forceSync = useCallback(() => {
    const st = stateRef.current;
    if ((st.phase === 'victory' || st.phase === 'gameover') && !recordedEndRef.current) {
      recordedEndRef.current = true;
      setRecord(saveRecord(st.wave, st.phase === 'victory'));
    }
    setTick((n) => (n + 1) % 1000000);
  }, []);

  const showBanner = useCallback((title: string, subtitle: string, color: string) => {
    setBanner({ title, subtitle, color });
    window.clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = window.setTimeout(() => setBanner(null), 3200);
  }, []);

  const showBuildMessage = useCallback((msg: string) => {
    setBuildMsg(msg);
    window.clearTimeout(buildMsgTimerRef.current);
    buildMsgTimerRef.current = window.setTimeout(() => setBuildMsg(null), 2200);
  }, []);

  // Sync document.body.dataset.state for testability & game shell state machine
  const phase: GamePhase = stateRef.current.phase;
  useEffect(() => {
    const mapped =
      phase === 'victory' || phase === 'gameover'
        ? 'gameover'
        : phase === 'choosing'
          ? 'paused'
          : phase;
    document.body.dataset.state = mapped;
  }, [phase]);

  // Mount Three.js World once
  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1') {
      stateRef.current.phase = 'playing';
      document.body.dataset.state = 'playing';
    }

    const ctrl = mountWorldScene(
      el,
      stateRef,
      forceSync,
      showBanner,
      (res) => {
        if (!res.ok && res.reason) showBuildMessage(res.reason);
      },
    );
    worldRef.current = ctrl;
    forceSync();

    return () => {
      ctrl.dispose();
      worldRef.current = null;
    };
  }, [forceSync, showBanner, showBuildMessage]);

  const startNewRun = useCallback(
    (withIntro: boolean) => {
      soundEngine.unlock();
      (document.activeElement as HTMLElement | null)?.blur?.();
      const speed = stateRef.current.gameSpeed;
      const fresh = createInitialState(Date.now() & 0x7fffffff);
      fresh.gameSpeed = speed;
      fresh.phase = withIntro ? 'intro' : 'playing';
      stateRef.current = fresh;
      recordedEndRef.current = false;
      setBuildOpen(false);
      setMapOpen(false);
      setSandboxOpen(false);
      setQuitOpen(false);
      setSettingsOpen(false);
      setStudioOpen(false);
      worldRef.current?.resetGame();
      forceSync();
    },
    [forceSync],
  );

  const returnToTitle = useCallback(() => {
    const speed = stateRef.current.gameSpeed;
    const fresh = createInitialState();
    fresh.gameSpeed = speed;
    fresh.phase = 'title';
    stateRef.current = fresh;
    recordedEndRef.current = false;
    setBuildOpen(false);
    setMapOpen(false);
    setSandboxOpen(false);
    setQuitOpen(false);
    setSettingsOpen(false);
    setStudioOpen(false);
    worldRef.current?.resetGame();
    forceSync();
  }, [forceSync]);

  // Global keyboard shortcuts (Title Enter/Space, Pause Esc/P, Build B, Map G, Mute M, Studio T)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.repeat) return;

      const k = e.key.toLowerCase();
      const curPhase = stateRef.current.phase;

      if (curPhase === 'title' && !settingsOpen && !studioOpen && !quitOpen) {
        if (k === 'enter' || k === ' ') {
          e.preventDefault();
          startNewRun(playIntroOnStart);
          return;
        }
      }

      if (curPhase === 'intro') {
        return;
      }

      if (k === 'm') {
        const next = !soundEngine.isMuted();
        soundEngine.setMuted(next);
        setMuted(next);
        return;
      }

      if (curPhase === 'playing' || curPhase === 'paused') {
        if (k === 'escape' || k === 'p') {
          if (studioOpen) {
            setStudioOpen(false);
            return;
          }
          if (settingsOpen) {
            setSettingsOpen(false);
            return;
          }
          if (mapOpen) {
            setMapOpen(false);
            return;
          }
          if (buildOpen) {
            setBuildOpen(false);
            worldRef.current?.setBuildPlacementMode(null);
            return;
          }
          stateRef.current.phase = curPhase === 'playing' ? 'paused' : 'playing';
          forceSync();
          return;
        }
      }

      if (curPhase === 'playing') {
        if (k === 'b') {
          setBuildOpen((prev) => {
            const next = !prev;
            if (!next) worldRef.current?.setBuildPlacementMode(null);
            return next;
          });
        } else if (k === 'g') {
          setMapOpen((prev) => !prev);
        } else if (e.key === 'F2') {
          e.preventDefault();
          setSandboxOpen((prev) => !prev);
        } else if (k === 't') {
          setBuildOpen(false);
          setMapOpen(false);
          worldRef.current?.setBuildPlacementMode(null);
          stateRef.current.phase = 'paused';
          setStudioOpen(true);
          forceSync();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    buildOpen,
    forceSync,
    mapOpen,
    playIntroOnStart,
    quitOpen,
    settingsOpen,
    startNewRun,
    studioOpen,
  ]);

  const handleQuickBuildAroundCamp = (kind: BuildingKind) => {
    const st = stateRef.current;
    const p = st.player;
    // Try placing 3.5m in front of Guardian, or search nearby ring around camp
    const candidates: Array<{ x: number; z: number }> = [
      { x: p.x + p.facingX * 3.5, z: p.z + p.facingZ * 3.5 },
    ];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      candidates.push({ x: Math.cos(a) * 8.5, z: Math.sin(a) * 8.5 });
      candidates.push({ x: Math.cos(a) * 12.5, z: Math.sin(a) * 12.5 });
    }
    for (const pt of candidates) {
      const res = placeBuilding(st, kind, pt.x, pt.z);
      if (res.ok) {
        soundEngine.playBuild();
        showBuildMessage(`${BUILDING_DEFS[kind].name} constructed!`);
        forceSync();
        return;
      }
    }
    showBuildMessage('No open build space nearby or insufficient resources.');
  };

  const triggerSingleInput = (action: 'attack' | 'dash' | 'interact') => {
    const st = stateRef.current;
    if (st.phase !== 'playing') return;
    soundEngine.unlock();
    stepSimulation(st, 0.016, {
      moveX: 0,
      moveZ: 0,
      attackJustPressed: action === 'attack',
      dashJustPressed: action === 'dash',
      interactJustPressed: action === 'interact',
      commandJustPressed: null,
    });
    forceSync();
  };

  const st = stateRef.current;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0e1318]">
      {/* Isolated WebGL Canvas Mount */}
      <div
        ref={mountRef}
        data-testid="three-canvas-container"
        className="fixed inset-0 w-full h-full"
      />

      {st.phase === 'title' && !quitOpen && (
        <TitleOverlay
          bestWave={record.bestWave}
          victories={record.victories}
          onPlayWithStory={() => startNewRun(playIntroOnStart)}
          onQuickPlay={() => startNewRun(false)}
          onOpenStudio={() => setStudioOpen(true)}
          onOpenSettings={() => setSettingsOpen(true)}
          onQuit={() => setQuitOpen(true)}
        />
      )}

      {st.phase === 'intro' && (
        <IntroCutscene
          customVideoUrl={customVideoUrl}
          onChapterChange={(idx) => worldRef.current?.setIntroChapter(idx)}
          onVideoGenerated={(url) => setCustomVideoUrl(url)}
          onFinishIntro={() => {
            (document.activeElement as HTMLElement | null)?.blur?.();
            stateRef.current.phase = 'playing';
            forceSync();
          }}
        />
      )}

      {(st.phase === 'playing' || st.phase === 'paused' || st.phase === 'choosing') && (
        <GameHud
          state={st}
          muted={muted}
          buildOpen={buildOpen}
          mapOpen={mapOpen}
          sandboxOpen={sandboxOpen}
          banner={banner}
          buildMessage={buildMsg}
          onToggleMute={() => {
            const next = !soundEngine.isMuted();
            soundEngine.setMuted(next);
            setMuted(next);
          }}
          onToggleMap={() => setMapOpen((v) => !v)}
          onToggleSandbox={() => setSandboxOpen((v) => !v)}
          onSandboxAction={(action) => {
            const ctrl = worldRef.current;
            if (!ctrl) return;
            if (action === 'all_sizes') {
              ctrl.debugEnsureAllDragons();
              showBanner('All 4 Dragons Spawned', 'Green 1.4x · Red 1.15x · Blue 1.0x · Yellow 0.8x', '#ffd266');
            } else if (action === 'pack' || action === 'huge' || action === 'boss') {
              ctrl.debugSpawnEnemies(action);
            } else {
              ctrl.debugTriggerAbility(action);
            }
          }}
          onOpenStudio={() => {
            setBuildOpen(false);
            setMapOpen(false);
            worldRef.current?.setBuildPlacementMode(null);
            stateRef.current.phase = 'paused';
            setStudioOpen(true);
            forceSync();
          }}
          onPause={() => {
            setBuildOpen(false);
            setMapOpen(false);
            worldRef.current?.setBuildPlacementMode(null);
            stateRef.current.phase = st.phase === 'playing' ? 'paused' : 'playing';
            forceSync();
          }}
          onToggleBuild={() => {
            setBuildOpen((prev) => {
              const next = !prev;
              if (!next) worldRef.current?.setBuildPlacementMode(null);
              return next;
            });
          }}
          onSelectBuild={(kind) => worldRef.current?.setBuildPlacementMode(kind)}
          onQuickBuildAroundCamp={handleQuickBuildAroundCamp}
          onCommand={(cmd: DragonCommand) => {
            issueDragonCommand(stateRef.current, cmd);
            forceSync();
          }}
          onTriggerAttack={() => triggerSingleInput('attack')}
          onTriggerDash={() => triggerSingleInput('dash')}
          onTriggerInteract={() => triggerSingleInput('interact')}
          onSummonWave={() => {
            summonNextWaveNow(stateRef.current);
            forceSync();
          }}
        />
      )}

      {st.phase === 'choosing' && st.upgradeChoices.length > 0 && (
        <UpgradeModal
          choices={st.upgradeChoices}
          wave={st.wave}
          onSelect={(id) => {
            applyUpgradeCard(stateRef.current, id);
            forceSync();
          }}
        />
      )}

      {st.phase === 'paused' && !settingsOpen && !studioOpen && !quitOpen && (
        <PauseModal
          onResume={() => {
            stateRef.current.phase = 'playing';
            forceSync();
          }}
          onRestart={() => startNewRun(false)}
          onOpenSettings={() => setSettingsOpen(true)}
          onMainMenu={returnToTitle}
          onQuit={() => setQuitOpen(true)}
        />
      )}

      {(st.phase === 'victory' || st.phase === 'gameover') && !quitOpen && (
        <EndModal
          victory={st.phase === 'victory'}
          wave={st.wave}
          stats={st.stats}
          explorationPct={getExplorationPercent(st.fogGrid)}
          relicsCount={st.discoveredRelics.length}
          dragonsCount={st.dragons.length}
          protectorsCount={st.protectors.length}
          onPlayAgain={() => startNewRun(false)}
          onMainMenu={returnToTitle}
          onQuit={() => setQuitOpen(true)}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          gameSpeed={st.gameSpeed}
          muted={muted}
          playIntroOnStart={playIntroOnStart}
          onChangeSpeed={(spd) => {
            stateRef.current.gameSpeed = spd;
            forceSync();
          }}
          onToggleMute={() => {
            const next = !soundEngine.isMuted();
            soundEngine.setMuted(next);
            setMuted(next);
          }}
          onToggleIntroOnStart={() => setPlayIntroOnStart((v) => !v)}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {studioOpen && (
        <MediaStudioModal
          gameState={st}
          onVideoCreated={(url) => setCustomVideoUrl(url)}
          onClose={() => setStudioOpen(false)}
        />
      )}

      {quitOpen && (
        <QuitModal
          onReturnToTitle={() => {
            setQuitOpen(false);
            returnToTitle();
          }}
        />
      )}
    </div>
  );
}
