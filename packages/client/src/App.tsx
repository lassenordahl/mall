import { Canvas } from '@react-three/fiber';
import { Scene } from './components/Scene';
import { World } from './components/World';
import { Player } from './components/Player';
import { StartScreen } from './components/StartScreen';
import { DebugPanel } from './components/DebugPanel';
import * as THREE from 'three';
import { useState, useCallback, useEffect } from 'react';
import type { BuildingData } from '@3d-neighborhood/shared';

interface SpawnPoint {
  position: [number, number, number];
  lookAt: [number, number, number];
}

/**
 * Main app component
 * Sets up Three.js Canvas and renders the 3D neighborhood
 */
function App() {
  const [buildings, setBuildings] = useState<BuildingData[]>([]);
  const [targetedBuilding, setTargetedBuilding] = useState<BuildingData | null>(null);
  const [spawnPoint, setSpawnPoint] = useState<SpawnPoint | null>(null);
  const [loading, setLoading] = useState(false);
  const [noclip, setNoclip] = useState(false);

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

  const handleStart = async (url: string) => {
    setLoading(true);
    try {
      // Fetch entry point from API
      const res = await fetch('/api/entry-point', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!res.ok) {
        throw new Error('Website not found or not placed yet');
      }

      const data = await res.json();
      setSpawnPoint({
        position: [data.spawnX, data.spawnY, data.spawnZ],
        lookAt: [data.lookAtX, data.lookAtY, data.lookAtZ],
      });
    } catch (error) {
      console.error('Failed to find entry point:', error);
      // Default spawn at origin
      setSpawnPoint({
        position: [0, 1.6, 10],
        lookAt: [0, 10, 0],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBuildingsLoaded = useCallback((newBuildings: BuildingData[]) => {
    setBuildings(newBuildings);
  }, []);

  const handleTargetChange = useCallback((building: BuildingData | null) => {
    setTargetedBuilding(building);
  }, []);

  // Show start screen if no spawn point selected
  if (!spawnPoint) {
    return <StartScreen onStart={handleStart} />;
  }

  // Show loading state
  if (loading) {
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
        <World onBuildingsLoaded={handleBuildingsLoaded} />
        <Player
          buildings={buildings}
          onTargetChange={handleTargetChange}
          spawnPoint={spawnPoint}
          noclip={noclip}
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

      {/* Debug panel - top left */}
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

export default App;
