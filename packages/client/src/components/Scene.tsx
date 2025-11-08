import { DEFAULT_WORLD_CONFIG } from '@3d-neighborhood/shared';

/**
 * Scene environment setup (Liminal aesthetic)
 * - Fog: White fog from 150 to 300 units
 * - Lighting: Ambient only (no shadows for liminal feel)
 * - Ground: Large white plane
 */
export function Scene() {
  const fogColor = '#ffffff';
  const fogStart = DEFAULT_WORLD_CONFIG.fogStart;
  const fogEnd = DEFAULT_WORLD_CONFIG.fogEnd;

  return (
    <>
      {/* Fog */}
      <fog attach="fog" args={[fogColor, fogStart, fogEnd]} />

      {/* Background color */}
      <color attach="background" args={[fogColor]} />

      {/* Lighting - ambient only for liminal aesthetic */}
      <ambientLight intensity={1.0} />

      {/* Ground plane - large white plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[2000, 2000]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </>
  );
}
