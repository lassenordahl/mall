import { Canvas } from '@react-three/fiber';
import { Scene } from './components/Scene';
import { World } from './components/World';
import { Player } from './components/Player';
import * as THREE from 'three';
import { useState, useCallback } from 'react';
import type { BuildingData } from '@3d-neighborhood/shared';

/**
 * Main app component
 * Sets up Three.js Canvas and renders the 3D neighborhood
 */
function App() {
  const [buildings, setBuildings] = useState<BuildingData[]>([]);
  const [targetedBuilding, setTargetedBuilding] = useState<BuildingData | null>(null);

  const handleBuildingsLoaded = useCallback((newBuildings: BuildingData[]) => {
    setBuildings(newBuildings);
  }, []);

  const handleTargetChange = useCallback((building: BuildingData | null) => {
    setTargetedBuilding(building);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas
        camera={{
          position: [0, 1.6, 0], // Initial position (Player will move to safe spawn)
          fov: 75,
        }}
        gl={{
          toneMapping: THREE.NoToneMapping, // Disable tone mapping for true white
          outputColorSpace: THREE.SRGBColorSpace,
        }}
      >
        <Scene />
        <World onBuildingsLoaded={handleBuildingsLoaded} />
        <Player buildings={buildings} onTargetChange={handleTargetChange} />
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
