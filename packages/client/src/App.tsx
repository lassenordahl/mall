import { Canvas } from '@react-three/fiber';
import { Scene } from './components/Scene';
import { World } from './components/World';
import { Player } from './components/Player';
import { StartScreen } from './components/StartScreen';
import { DebugPanel } from './components/DebugPanel';
import { StatsPanel } from './components/StatsPanel';
import { Minimap } from './components/Minimap';
import { QueryProvider } from './providers/QueryProvider';
import { usePlayerPosition } from './hooks/usePlayerPosition';
import { useEntryPoint } from './hooks/api';
import * as THREE from 'three';
import { useState, useCallback, useEffect, useRef } from 'react';
import type { BuildingData, EntryPointResponse } from '@3d-neighborhood/shared';

interface SpawnPoint {
  position: [number, number, number];
  lookAt: [number, number, number];
}

/**
 * Main app component (wrapped in QueryProvider)
 */
function AppContent() {
  const [buildings, setBuildings] = useState<BuildingData[]>([]);
  const [targetedBuilding, setTargetedBuilding] = useState<BuildingData | null>(null);
  const [spawnPoint, setSpawnPoint] = useState<SpawnPoint | null>(null);
  const [noclip, setNoclip] = useState(false);
  const [newChunksThisSession, setNewChunksThisSession] = useState(0);
  const newChunkKeysRef = useRef<string[]>([]);

  // Track player position for dynamic chunk loading
  const { position: playerPosition, updatePosition } = usePlayerPosition();
  const [cameraYaw, setCameraYaw] = useState<number>(0);

  // Use entry point mutation
  const { mutate: getEntryPoint, isPending: isLoadingEntryPoint } = useEntryPoint();

  // Check for URL parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    // Check for start URL
    const startUrl = params.get('start');
    if (startUrl) {
      handleStart(startUrl);
    }

    // Check for noclip mode
    const noclipParam = params.get('noclip');
    if (noclipParam !== null) {
      setNoclip(noclipParam === 'true' || noclipParam === '1' || noclipParam === '');
    }
  }, []);

  const handleStart = useCallback((url: string) => {
    console.log(`[App] Fetching entry point for URL: ${url}`);

    getEntryPoint(url, {
      onSuccess: (data: EntryPointResponse) => {
        console.log('[App] Entry point response:', data);
        console.log(`[App] Spawn position: (${data.spawnX}, ${data.spawnY}, ${data.spawnZ})`);
        console.log(`[App] Building chunk: (${data.chunkX}, ${data.chunkZ})`);
        console.log(`[App] Look at: (${data.lookAtX}, ${data.lookAtY}, ${data.lookAtZ})`);

        setSpawnPoint({
          position: [data.spawnX, data.spawnY, data.spawnZ],
          lookAt: [data.lookAtX, data.lookAtY, data.lookAtZ],
        });
      },
      onError: (error: Error) => {
        console.error('[App] Failed to find entry point:', error);
        // Default spawn at origin
        console.log('[App] Using default spawn at origin');
        setSpawnPoint({
          position: [0, 1.6, 10],
          lookAt: [0, 10, 0],
        });
      },
    });
  }, [getEntryPoint]);

  const handleBuildingsLoaded = useCallback((newBuildings: BuildingData[]) => {
    console.log(`[App] Buildings loaded: ${newBuildings.length} buildings`);
    if (newBuildings.length > 0) {
      const minX = Math.min(...newBuildings.map(b => b.worldX));
      const maxX = Math.max(...newBuildings.map(b => b.worldX));
      const minZ = Math.min(...newBuildings.map(b => b.worldZ));
      const maxZ = Math.max(...newBuildings.map(b => b.worldZ));
      console.log(`[App] Buildings worldX range: ${minX.toFixed(1)} to ${maxX.toFixed(1)}`);
      console.log(`[App] Buildings worldZ range: ${minZ.toFixed(1)} to ${maxZ.toFixed(1)}`);
    }
    setBuildings(newBuildings);
  }, []);

  const handleTargetChange = useCallback((building: BuildingData | null) => {
    setTargetedBuilding(building);
  }, []);

  const handleNewChunksChange = useCallback((count: number, keys: string[]) => {
    setNewChunksThisSession(count);
    newChunkKeysRef.current = keys;
  }, []);

  // Show start screen if no spawn point selected
  if (!spawnPoint) {
    return <StartScreen onStart={handleStart} />;
  }

  // Show loading state
  if (isLoadingEntryPoint) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading world...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        camera={{
          position: spawnPoint.position,
          fov: 75,
        }}
        gl={{
          toneMapping: THREE.NoToneMapping, // Disable tone mapping for true white
          outputColorSpace: THREE.SRGBColorSpace,
        }}
      >
        <Scene />
        <World
          onBuildingsLoaded={handleBuildingsLoaded}
          spawnPosition={spawnPoint.position}
          onNewChunksChange={handleNewChunksChange}
          playerPosition={playerPosition || undefined}
        />
        <Player
          buildings={buildings}
          onTargetChange={handleTargetChange}
          spawnPoint={spawnPoint}
          noclip={noclip}
          onPositionChange={updatePosition}
          onRotationChange={setCameraYaw}
        />
      </Canvas>

      {/* Crosshair in center of screen */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '20px',
          height: '20px',
          pointerEvents: 'none',
        }}
      >
        {/* Crosshair lines */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '0',
            width: '100%',
            height: '2px',
            backgroundColor: targetedBuilding ? '#000' : '#666',
            transform: 'translateY(-50%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '0',
            width: '2px',
            height: '100%',
            backgroundColor: targetedBuilding ? '#000' : '#666',
            transform: 'translateX(-50%)',
          }}
        />
      </div>

      {/* Targeted building URL - top right */}
      <div
        style={{
          position: 'absolute',
          top: 20,
          right: 20,
          color: '#000',
          fontFamily: 'monospace',
          fontSize: '16px',
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '10px 15px',
          borderRadius: '5px',
          pointerEvents: 'none',
          minWidth: '200px',
          textAlign: 'right',
        }}
      >
        {targetedBuilding ? (
          <div style={{ fontWeight: 'bold' }}>{targetedBuilding.url}</div>
        ) : (
          <div style={{ color: '#999' }}>No target</div>
        )}
      </div>

      {/* Stats panel - top left */}
      <StatsPanel newChunksThisSession={newChunksThisSession} />

      {/* Minimap - bottom right */}
      <Minimap
        newChunkKeys={newChunkKeysRef.current}
        playerPosition={playerPosition ? [playerPosition.x, playerPosition.y, playerPosition.z] : spawnPoint.position}
        cameraYaw={cameraYaw}
      />

      {/* Debug panel - moved to avoid stats panel */}
      <DebugPanel noclip={noclip} onNoclipChange={setNoclip} />

      {/* Instructions overlay - bottom left */}
      <div
        style={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          color: '#333',
          fontFamily: 'monospace',
          fontSize: '14px',
          background: 'rgba(255, 255, 255, 0.9)',
          padding: '10px 15px',
          borderRadius: '5px',
          pointerEvents: 'none',
        }}
      >
        <div>Click to lock pointer</div>
        <div>WASD to move</div>
        <div>Mouse to look around</div>
        <div>ESC to unlock</div>
      </div>
    </div>
  );
}

/**
 * Main app component with QueryProvider wrapper
 */
function App() {
  return (
    <QueryProvider>
      <AppContent />
    </QueryProvider>
  );
}

export default App;
