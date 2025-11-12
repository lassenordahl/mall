# Multiplayer Specification - 3D Neighborhood

**Version**: 1.0
**Date**: 2025-11-11
**Status**: PROPOSAL - Not yet implemented

---

## Table of Contents

1. [Project Context](#project-context)
2. [Multiplayer Overview](#multiplayer-overview)
3. [Architecture Options](#architecture-options)
4. [Recommended Architecture](#recommended-architecture)
5. [Implementation Plan](#implementation-plan)
6. [Technical Deep Dive](#technical-deep-dive)
7. [Infrastructure & Costs](#infrastructure--costs)
8. [Testing Strategy](#testing-strategy)
9. [Open Questions](#open-questions)

---

## Project Context

### What We're Building

**3D Neighborhood** is an explorable 3D web environment where websites are represented as buildings in an infinite procedurally-generated city. Users walk around in first-person view (WASD + mouse look) to discover and visit websites organized by semantic similarity.

### Current System Architecture

**Frontend (Client)**:
- React + Three.js (via @react-three/fiber)
- Vite dev server (port 3001 in development)
- First-person camera controls (PointerLockControls)
- Canvas-based minimap with real-time position tracking
- Building rendering with deterministic colors

**Backend (Server)**:
- Cloudflare Workers + Hono API framework
- D1 database (SQLite) with 548 websites + embeddings
- In-memory k-NN semantic similarity
- Chunk generation and caching
- Entry point system for spawning at specific URLs

**World Structure**:
- **Chunk-based**: World divided into 150×150 unit chunks
- **Grid Layout**: Each chunk has 5×5 cell grid with cross-pattern roads
- **Buildings**: 16 buildings per chunk (4×4 grid, roads at center row/col)
- **Cell Size**: 30×30 units per cell
- **Building Dimensions**: Width 15-28 units, Height 25-120 units
- **Player**: Eye height 1.6 units, moves at 50 units/second
- **Semantic Organization**: Buildings in nearby chunks are semantically similar (k-NN based)

**Current Player State**:
```typescript
interface PlayerPosition {
  x: number;        // World X coordinate
  y: number;        // World Y coordinate (always 1.6 - eye height)
  z: number;        // World Z coordinate
  chunkX: number;   // Current chunk X
  chunkZ: number;   // Current chunk Z
}

// Camera also tracks:
// - Rotation (yaw/pitch) for direction
// - Velocity for movement
// - Targeted building (raycasting)
```

**Key Files**:
- `packages/client/src/components/Player.tsx` - Camera controls, movement, collision
- `packages/client/src/hooks/usePlayerPosition.ts` - Position tracking
- `packages/server/src/index.ts` - API server
- `packages/shared/src/types.ts` - Shared types

---

## Multiplayer Overview

### What is Multiplayer? (Educational Primer)

Multiplayer in web applications means multiple users interact in a shared environment in real-time. For 3D environments like ours, this involves:

**Key Concepts**:

1. **State Synchronization**: Each player's position/rotation must be shared with all other players
2. **Real-Time Communication**: Low-latency updates (ideally <100ms) for smooth movement
3. **Authority**: Who decides what's "true"? (Server-authoritative vs client-authoritative)
4. **Interpolation**: Smoothing out network lag by predicting movement between updates
5. **Persistence**: Who's currently online? Session management and presence

**Common Challenges**:

- **Network Latency**: Updates take time to travel across the internet (50-200ms typical)
- **Bandwidth**: Sending position updates for many players can be expensive
- **Consistency**: Ensuring all players see the same world state
- **Cheating**: Clients can lie about their position/actions
- **Scalability**: More players = exponentially more complexity

### Multiplayer Levels (Complexity Scale)

**Level 1: Presence Only** (Simplest)
- See other players' dots on minimap
- No 3D models, just indicators
- ~10 lines of code + WebSocket connection

**Level 2: Basic Avatars** (What you're asking for)
- Simple 3D model for each player
- Position + rotation syncing
- Name labels
- This spec focuses here

**Level 3: Interactions**
- Gestures, emotes
- Voice chat
- Shared state (e.g., all see same building changes)

**Level 4: Physics**
- Collisions between players
- Pushing objects
- Server-authoritative physics

---

## Architecture Options

### Option A: Cloudflare Durable Objects + WebSockets

**How It Works**:
```
Client 1 ←→ WebSocket ←→ Durable Object (Room) ←→ WebSocket ←→ Client 2
                              ↓
                         D1 Database
```

- Each "room" (or region) is a Durable Object (DO)
- Players connect to the room via WebSocket
- DO maintains player list and broadcasts position updates
- Cloudflare Workers native, stays on their edge network

**Pros**:
- ✅ Stays within Cloudflare ecosystem (we're already using Workers + D1)
- ✅ Global edge network (low latency worldwide)
- ✅ Automatic scaling (Cloudflare handles it)
- ✅ WebSocket support built-in
- ✅ Persistent state in DO for room management
- ✅ No separate server infrastructure needed

**Cons**:
- ⚠️ Durable Objects have CPU limits (100ms per request)
- ⚠️ Limited to 32 WebSocket connections per DO (need sharding for >32 players)
- ⚠️ Billing: WebSocket connections count as "requests" + DO duration charges
- ⚠️ Harder to debug than traditional servers

**Best For**: 10-100 concurrent players, global audience, tight Cloudflare integration

**Cost Estimate**: $5-20/month for 50-100 concurrent players

---

### Option B: Separate WebSocket Server (Node.js + Socket.io)

**How It Works**:
```
Client 1 ←→ Socket.io ←→ Node.js Server ←→ Socket.io ←→ Client 2
                              ↓
                     Redis (optional, for scaling)
```

- Traditional WebSocket server (e.g., Express + Socket.io)
- Deployed on Railway, Render, or AWS
- Handles rooms, broadcasting, presence

**Pros**:
- ✅ More flexible (no CPU/connection limits)
- ✅ Easier to debug and develop locally
- ✅ Rich ecosystem (Socket.io has tons of features)
- ✅ Can scale horizontally with Redis adapter
- ✅ Familiar to most developers

**Cons**:
- ⚠️ Need separate hosting (another service to manage)
- ⚠️ Not on edge network (higher latency for global users)
- ⚠️ WebSocket connection pooling requires load balancer
- ⚠️ More infrastructure to maintain

**Best For**: 100+ concurrent players, complex interactions, custom logic

**Cost Estimate**: $10-30/month (Railway/Render starter tier)

---

### Option C: WebRTC (Peer-to-Peer)

**How It Works**:
```
Client 1 ←→ Direct P2P Connection ←→ Client 2
         ↘                       ↗
          Signaling Server (just for handshake)
```

- Players connect directly to each other (no central server for data)
- Signaling server only helps establish initial connection
- Each client broadcasts to all other clients

**Pros**:
- ✅ Lowest latency possible (direct connection)
- ✅ No server bandwidth costs (data goes peer-to-peer)
- ✅ Very scalable for small groups (<10 players)

**Cons**:
- ⚠️ Doesn't scale well (10+ players = exponential connections)
- ⚠️ NAT traversal issues (firewalls can block)
- ⚠️ No authority (clients can cheat easily)
- ⚠️ Complex to implement correctly
- ⚠️ Requires STUN/TURN servers for reliability

**Best For**: Small groups (2-8 players), low-latency experiences, no server costs

**Cost Estimate**: $0-5/month (just signaling server)

---

### Option D: Dedicated Game Server (Colyseus, Photon, PlayFab)

**How It Works**:
```
Client 1 ←→ Game Server Framework ←→ Client 2
                   ↓
            State Synchronization
            Physics Simulation
            Room Management
```

- Use a pre-built multiplayer framework
- Handles state sync, rooms, matchmaking
- Examples: Colyseus (Node.js), Photon, PlayFab

**Pros**:
- ✅ Battle-tested for games
- ✅ Built-in room management, state sync, interpolation
- ✅ Less code to write

**Cons**:
- ⚠️ Another service/dependency
- ⚠️ May be overkill for simple use case
- ⚠️ Pricing can be expensive at scale
- ⚠️ Lock-in to their ecosystem

**Best For**: Complex multiplayer games, teams with no networking experience

**Cost Estimate**: $20-100/month depending on service

---

## Recommended Architecture

### Choice: **Option A - Cloudflare Durable Objects + WebSockets**

**Rationale**:
1. ✅ **Already on Cloudflare**: Minimal new infrastructure
2. ✅ **Global Edge Network**: Low latency for worldwide users
3. ✅ **Automatic Scaling**: Don't worry about server capacity
4. ✅ **Cost-Effective**: Pay only for what you use
5. ✅ **Spatial Partitioning**: Durable Objects naturally map to chunk-based rooms

**Key Insight**: Our world is already chunk-based! Each chunk (or small grid of chunks) can be its own Durable Object "room". Players only connect to rooms for chunks they're near.

### Spatial Partitioning Strategy

**Concept**: Instead of one giant room with all players, divide the world into **regions**:

```
Region (-1,0)    Region (0,0)     Region (1,0)
[Chunks -1..0    [Chunks 0..2     [Chunks 3..5
 in X, 0..2      in X, 0..2       in X, 0..2
 in Z]           in Z]            in Z]
    ↓               ↓                ↓
Durable Object  Durable Object   Durable Object
   (Room 1)        (Room 2)         (Room 3)
```

**Benefits**:
- ✅ **Scalability**: Each region handles only nearby players (e.g., 10-20 players)
- ✅ **Efficiency**: Only sync positions within visible range
- ✅ **Natural Sharding**: World naturally divides into independent regions
- ✅ **Bypass DO Limits**: 32 connection limit per DO, but can have unlimited regions

**Implementation**:
- **Region Size**: 3×3 chunks (450×450 units) - reasonable render distance
- **Connection**: Client connects to room based on current chunk position
- **Transitions**: When player crosses region boundary, disconnect from old room, connect to new
- **Nearby Regions**: Client can optionally connect to adjacent regions for smooth transitions

---

## Implementation Plan

### Phase 1: Foundation (Server-Side)

**Goal**: Set up Durable Object rooms and WebSocket handling

#### Step 1.1: Create Durable Object Class

**File**: `packages/server/src/room.ts`

```typescript
// Durable Object that manages a region of the world
export class WorldRegion {
  state: DurableObjectState;
  sessions: Map<string, PlayerSession>; // playerId -> session

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.sessions = new Map();
  }

  async fetch(request: Request) {
    // Upgrade HTTP to WebSocket
    const upgradeHeader = request.headers.get('Upgrade');
    if (upgradeHeader !== 'websocket') {
      return new Response('Expected WebSocket', { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    await this.handleSession(server, request);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async handleSession(websocket: WebSocket, request: Request) {
    websocket.accept();

    // Extract player ID from URL or generate
    const url = new URL(request.url);
    const playerId = url.searchParams.get('playerId') || crypto.randomUUID();

    const session: PlayerSession = {
      websocket,
      playerId,
      position: { x: 0, y: 1.6, z: 0 },
      rotation: { yaw: 0, pitch: 0 },
      name: url.searchParams.get('name') || 'Anonymous',
      lastUpdate: Date.now(),
    };

    this.sessions.set(playerId, session);

    // Send current players to new player
    this.sendPlayerList(session);

    // Broadcast new player to others
    this.broadcast({
      type: 'player-joined',
      player: {
        id: playerId,
        name: session.name,
        position: session.position,
        rotation: session.rotation,
      }
    }, playerId); // exclude sender

    // Handle incoming messages
    websocket.addEventListener('message', (msg) => {
      this.handleMessage(playerId, JSON.parse(msg.data));
    });

    // Handle disconnect
    websocket.addEventListener('close', () => {
      this.sessions.delete(playerId);
      this.broadcast({
        type: 'player-left',
        playerId,
      });
    });
  }

  handleMessage(playerId: string, data: any) {
    const session = this.sessions.get(playerId);
    if (!session) return;

    switch (data.type) {
      case 'position-update':
        // Update player position
        session.position = data.position;
        session.rotation = data.rotation;
        session.lastUpdate = Date.now();

        // Broadcast to other players (with throttling)
        this.broadcast({
          type: 'player-moved',
          playerId,
          position: data.position,
          rotation: data.rotation,
        }, playerId);
        break;
    }
  }

  broadcast(message: any, excludePlayerId?: string) {
    const payload = JSON.stringify(message);
    for (const [id, session] of this.sessions) {
      if (id !== excludePlayerId) {
        session.websocket.send(payload);
      }
    }
  }

  sendPlayerList(session: PlayerSession) {
    const players = Array.from(this.sessions.values())
      .filter(s => s.playerId !== session.playerId)
      .map(s => ({
        id: s.playerId,
        name: s.name,
        position: s.position,
        rotation: s.rotation,
      }));

    session.websocket.send(JSON.stringify({
      type: 'player-list',
      players,
    }));
  }
}

interface PlayerSession {
  websocket: WebSocket;
  playerId: string;
  position: { x: number; y: number; z: number };
  rotation: { yaw: number; pitch: number };
  name: string;
  lastUpdate: number;
}
```

#### Step 1.2: Register Durable Object in wrangler.toml

**File**: `packages/server/wrangler.toml`

```toml
[[durable_objects.bindings]]
name = "WORLD_REGIONS"
class_name = "WorldRegion"
script_name = "server"

[[migrations]]
tag = "v1"
new_classes = ["WorldRegion"]
```

#### Step 1.3: Add WebSocket Connection Endpoint

**File**: `packages/server/src/index.ts`

```typescript
// Add route to connect to region
app.get('/multiplayer/region/:regionX/:regionZ', async (c) => {
  const { regionX, regionZ } = c.req.param();

  // Get Durable Object ID for this region
  const regionId = c.env.WORLD_REGIONS.idFromName(`region:${regionX}:${regionZ}`);
  const region = c.env.WORLD_REGIONS.get(regionId);

  // Forward WebSocket upgrade to Durable Object
  return region.fetch(c.req.raw);
});
```

---

### Phase 2: Client Integration

**Goal**: Connect to WebSocket and send position updates

#### Step 2.1: Create Multiplayer Hook

**File**: `packages/client/src/hooks/useMultiplayer.ts`

```typescript
import { useEffect, useRef, useState } from 'react';

export interface RemotePlayer {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotation: { yaw: number; pitch: number };
}

export function useMultiplayer(playerPosition?: { x: number; y: number; z: number }, cameraYaw?: number) {
  const [remotePlayers, setRemotePlayers] = useState<Map<string, RemotePlayer>>(new Map());
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const currentRegionRef = useRef<{ x: number; z: number } | null>(null);

  // Calculate which region we're in (3x3 chunk regions)
  const getRegionForPosition = (x: number, z: number) => {
    const REGION_SIZE = 450; // 3 chunks * 150 units
    return {
      x: Math.floor(x / REGION_SIZE),
      z: Math.floor(z / REGION_SIZE),
    };
  };

  // Connect to region
  const connectToRegion = (regionX: number, regionZ: number) => {
    // Disconnect from old region
    if (wsRef.current) {
      wsRef.current.close();
    }

    // Generate or retrieve player ID
    let playerId = localStorage.getItem('playerId');
    if (!playerId) {
      playerId = crypto.randomUUID();
      localStorage.setItem('playerId', playerId);
    }

    const playerName = localStorage.getItem('playerName') || 'Anonymous';

    // Connect to WebSocket
    const ws = new WebSocket(
      `ws://localhost:8787/multiplayer/region/${regionX}/${regionZ}?playerId=${playerId}&name=${encodeURIComponent(playerName)}`
    );

    ws.onopen = () => {
      console.log(`[Multiplayer] Connected to region (${regionX}, ${regionZ})`);
      setConnected(true);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);

      switch (data.type) {
        case 'player-list':
          // Initial list of players in region
          const playerMap = new Map<string, RemotePlayer>();
          data.players.forEach((p: RemotePlayer) => {
            playerMap.set(p.id, p);
          });
          setRemotePlayers(playerMap);
          break;

        case 'player-joined':
          // New player joined
          setRemotePlayers(prev => {
            const next = new Map(prev);
            next.set(data.player.id, data.player);
            return next;
          });
          break;

        case 'player-left':
          // Player left
          setRemotePlayers(prev => {
            const next = new Map(prev);
            next.delete(data.playerId);
            return next;
          });
          break;

        case 'player-moved':
          // Player position update
          setRemotePlayers(prev => {
            const next = new Map(prev);
            const player = next.get(data.playerId);
            if (player) {
              next.set(data.playerId, {
                ...player,
                position: data.position,
                rotation: data.rotation,
              });
            }
            return next;
          });
          break;
      }
    };

    ws.onclose = () => {
      console.log('[Multiplayer] Disconnected');
      setConnected(false);
      setRemotePlayers(new Map());
    };

    wsRef.current = ws;
    currentRegionRef.current = { x: regionX, z: regionZ };
  };

  // Send position updates
  useEffect(() => {
    if (!wsRef.current || !playerPosition || cameraYaw === undefined) return;
    if (wsRef.current.readyState !== WebSocket.OPEN) return;

    // Throttle updates to 10 per second
    const interval = setInterval(() => {
      wsRef.current?.send(JSON.stringify({
        type: 'position-update',
        position: playerPosition,
        rotation: { yaw: cameraYaw, pitch: 0 }, // Add pitch if needed
      }));
    }, 100); // 10 updates/sec

    return () => clearInterval(interval);
  }, [playerPosition, cameraYaw]);

  // Handle region changes
  useEffect(() => {
    if (!playerPosition) return;

    const newRegion = getRegionForPosition(playerPosition.x, playerPosition.z);

    // Check if we need to change regions
    if (!currentRegionRef.current ||
        newRegion.x !== currentRegionRef.current.x ||
        newRegion.z !== currentRegionRef.current.z) {
      console.log(`[Multiplayer] Moving to region (${newRegion.x}, ${newRegion.z})`);
      connectToRegion(newRegion.x, newRegion.z);
    }
  }, [playerPosition]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return {
    remotePlayers: Array.from(remotePlayers.values()),
    connected,
  };
}
```

#### Step 2.2: Integrate into App

**File**: `packages/client/src/App.tsx`

```typescript
import { useMultiplayer } from './hooks/useMultiplayer';

function App() {
  // ... existing code ...

  const { remotePlayers, connected } = useMultiplayer(playerPosition, cameraYaw);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Canvas>
        <Scene />
        <World />
        <Player />

        {/* Render remote players */}
        {remotePlayers.map(player => (
          <RemotePlayerAvatar
            key={player.id}
            player={player}
          />
        ))}
      </Canvas>

      {/* Show connection status */}
      <div style={{ position: 'absolute', top: 10, left: 10 }}>
        {connected ? '🟢 Online' : '🔴 Offline'}
        {remotePlayers.length > 0 && ` - ${remotePlayers.length} players nearby`}
      </div>
    </div>
  );
}
```

---

### Phase 3: Player Avatars

**Goal**: Render other players as 3D models

#### Step 3.1: Create RemotePlayerAvatar Component

**File**: `packages/client/src/components/RemotePlayerAvatar.tsx`

```typescript
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { RemotePlayer } from '../hooks/useMultiplayer';

interface RemotePlayerAvatarProps {
  player: RemotePlayer;
}

export function RemotePlayerAvatar({ player }: RemotePlayerAvatarProps) {
  const groupRef = useRef<THREE.Group>(null);
  const targetPosition = useRef(new THREE.Vector3());
  const targetRotation = useRef(0);

  // Interpolate position for smooth movement
  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Update target from player data
    targetPosition.current.set(player.position.x, player.position.y, player.position.z);
    targetRotation.current = player.rotation.yaw;

    // Smoothly interpolate (lerp) to target
    groupRef.current.position.lerp(targetPosition.current, delta * 10);

    // Smoothly rotate to target
    const currentYaw = groupRef.current.rotation.y;
    const deltaYaw = targetRotation.current - currentYaw;
    groupRef.current.rotation.y += deltaYaw * delta * 10;
  });

  return (
    <group ref={groupRef} position={[player.position.x, player.position.y, player.position.z]}>
      {/* Simple avatar: capsule for body */}
      <mesh position={[0, 0, 0]}>
        <capsuleGeometry args={[0.3, 0.8, 8, 16]} />
        <meshStandardMaterial color="#4488ff" />
      </mesh>

      {/* Head */}
      <mesh position={[0, 0.9, 0]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshStandardMaterial color="#ffcc88" />
      </mesh>

      {/* Direction indicator (nose/arrow) */}
      <mesh position={[0, 0.9, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[0.08, 0.15, 8]} />
        <meshStandardMaterial color="#ff6666" />
      </mesh>

      {/* Name label */}
      <Text
        position={[0, 1.5, 0]}
        fontSize={0.15}
        color="white"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.02}
        outlineColor="#000000"
      >
        {player.name}
      </Text>
    </group>
  );
}
```

**Simple Avatar Design**:
- Capsule body (blue)
- Sphere head (skin tone)
- Cone nose (red) - shows which way they're facing
- Name label floating above head

---

### Phase 4: Optimization & Polish

#### Step 4.1: Position Update Throttling

**Problem**: Sending position every frame (60fps) = 60 updates/sec = wasteful

**Solution**: Client-side throttling (already in useMultiplayer hook - 10 updates/sec)

**Server-side improvement**: Only broadcast to nearby players

```typescript
// In room.ts handleMessage
broadcast(message: any, excludePlayerId?: string, maxDistance?: number) {
  const payload = JSON.stringify(message);

  for (const [id, session] of this.sessions) {
    if (id === excludePlayerId) continue;

    // If maxDistance specified, only send to nearby players
    if (maxDistance && message.position) {
      const senderSession = this.sessions.get(excludePlayerId || '');
      if (senderSession) {
        const dist = Math.hypot(
          session.position.x - senderSession.position.x,
          session.position.z - senderSession.position.z
        );
        if (dist > maxDistance) continue; // Too far away
      }
    }

    session.websocket.send(payload);
  }
}
```

#### Step 4.2: Interpolation & Prediction

**Problem**: Network updates come in bursts, causing jittery movement

**Solution**: Client-side interpolation (already implemented with `lerp` in RemotePlayerAvatar)

**Advanced**: Dead reckoning (predict future position based on velocity)

```typescript
// Track velocity for prediction
interface RemotePlayer {
  // ... existing fields
  velocity?: { x: number; z: number };
  lastUpdateTime?: number;
}

// In useFrame of RemotePlayerAvatar
useFrame((state, delta) => {
  if (!groupRef.current) return;

  // If we haven't received update recently, predict position
  const timeSinceUpdate = Date.now() - (player.lastUpdateTime || 0);
  if (timeSinceUpdate > 200 && player.velocity) {
    // Predict position based on velocity
    targetPosition.current.x += player.velocity.x * delta;
    targetPosition.current.z += player.velocity.z * delta;
  } else {
    // Use actual position
    targetPosition.current.set(player.position.x, player.position.y, player.position.z);
  }

  // ... rest of interpolation
});
```

#### Step 4.3: Presence Indicator on Minimap

**File**: `packages/client/src/components/Minimap.tsx`

```typescript
// Add remotePlayers prop
interface MinimapProps {
  // ... existing props
  remotePlayers?: RemotePlayer[];
}

// In render loop (after drawing player position)
if (remotePlayers) {
  for (const remotePlayer of remotePlayers) {
    const [worldX, , worldZ] = remotePlayer.position;
    const rpChunkX = Math.floor(worldX / 150);
    const rpChunkZ = Math.floor(worldZ / 150);

    const rpx = offsetX + (rpChunkX - minX) * scale + scale / 2;
    const rpy = offsetY + (rpChunkZ - minZ) * scale + scale / 2;

    // Draw other player as blue dot
    ctx.fillStyle = '#4488ff';
    ctx.beginPath();
    ctx.arc(rpx, rpy, 2, 0, Math.PI * 2);
    ctx.fill();

    // Small label
    ctx.fillStyle = '#4488ff';
    ctx.font = '8px monospace';
    ctx.fillText(remotePlayer.name, rpx + 5, rpy);
  }
}
```

---

## Technical Deep Dive

### Network Protocol Design

**Message Types** (Client → Server):

```typescript
// Position update
{
  type: 'position-update',
  position: { x: number, y: number, z: number },
  rotation: { yaw: number, pitch: number }
}
```

**Message Types** (Server → Client):

```typescript
// Initial player list
{
  type: 'player-list',
  players: Array<{ id, name, position, rotation }>
}

// Player joined
{
  type: 'player-joined',
  player: { id, name, position, rotation }
}

// Player left
{
  type: 'player-left',
  playerId: string
}

// Player moved
{
  type: 'player-moved',
  playerId: string,
  position: { x, y, z },
  rotation: { yaw, pitch }
}
```

### Bandwidth Estimation

**Per Player Position Update**:
```
{
  "type": "player-moved",
  "playerId": "uuid",
  "position": { "x": 123.45, "y": 1.6, "z": 67.89 },
  "rotation": { "yaw": 1.23, "pitch": 0 }
}
```

- JSON size: ~120 bytes
- 10 updates/sec per player
- 10 players in region: 10 × 10 × 120 bytes = 12 KB/sec per client
- **Bandwidth per client**: ~12 KB/sec down, ~1.2 KB/sec up

**Optimization**: Binary protocol (WebSocket binary frames)
- Position: 3 floats (12 bytes)
- Rotation: 2 floats (8 bytes)
- Player ID: 1 byte (index)
- Total: ~21 bytes per update (5.7x smaller!)

### Latency Handling

**Target Metrics**:
- Update rate: 10 Hz (every 100ms)
- Acceptable latency: <150ms (imperceptible)
- Max latency: <300ms (noticeable but playable)

**Techniques**:
1. **Client-side prediction**: Local player moves instantly, server confirms later
2. **Interpolation**: Smooth out position updates with lerp
3. **Dead reckoning**: Predict other players' positions between updates
4. **Regional servers**: Use Cloudflare edge locations for low latency

### Authority Model

**Recommendation**: **Server-authoritative** (with client-side prediction)

**What this means**:
- Server is source of truth for all positions
- Client predicts own movement instantly (feels responsive)
- Server validates and corrects if needed
- Other players' positions always come from server

**Why not client-authoritative?**
- Easy to cheat (client lies about position)
- No conflict resolution
- Good for non-competitive, trust-based experiences only

**Implementation**:
```typescript
// Client-side prediction (in Player.tsx)
// Move immediately without waiting for server
camera.position.add(velocity.current);

// Send to server for validation
sendPositionUpdate(camera.position);

// If server disagrees, correct (rare)
if (Math.abs(serverPosition.x - camera.position.x) > 5) {
  camera.position.set(serverPosition.x, serverPosition.y, serverPosition.z);
}
```

---

## Infrastructure & Costs

### Cloudflare Pricing (Estimated)

**Durable Objects**:
- $0.15 per million requests
- $12.50 per million GB-seconds of duration
- WebSocket connections count as requests

**Scenario**: 50 concurrent players, avg 30 min session
- 50 regions active (1 player per region avg)
- Each region runs for 30 min = 1800 seconds
- 50 × 1800 = 90,000 seconds = 0.025 GB-seconds (assuming 1KB state)
- Cost: ~$0.30/day = **$9/month**

**WebSocket Requests**:
- Each connection = 1 request
- Each message = 1 request
- 50 players × 10 updates/sec × 1800 sec = 900,000 requests
- Cost: ~$0.14/day = **$4.20/month**

**Total**: ~$13-15/month for 50 concurrent players

### Scaling Estimates

| Players | Regions | Cost/Month |
|---------|---------|------------|
| 10      | 5       | $3-5       |
| 50      | 25      | $13-15     |
| 100     | 50      | $25-30     |
| 500     | 250     | $120-150   |
| 1000    | 500     | $240-300   |

**Note**: These are rough estimates. Actual costs depend on:
- Message frequency (10/sec vs 20/sec)
- Region size (how many players per region)
- Session length
- WebSocket keepalive overhead

---

## Testing Strategy

### Local Testing (Development)

**Step 1**: Run server locally with Wrangler
```bash
cd packages/server
npm run dev  # Starts on localhost:8787
```

**Step 2**: Open multiple browser tabs
- Each tab = different player
- Move around and verify you see other tabs' avatars

**Step 3**: Test region transitions
- Walk far enough to cross region boundary (450 units)
- Verify WebSocket reconnects to new region
- Verify players in old region disappear

### Production Testing (Staging)

**Step 1**: Deploy to Cloudflare
```bash
cd packages/server
wrangler deploy
```

**Step 2**: Share URL with friends
- Have 3-5 people connect
- Walk around together
- Test latency and smoothness

**Step 3**: Monitor metrics
- Cloudflare dashboard: WebSocket connection count
- Durable Object duration
- Request rates

### Load Testing

**Tool**: Artillery, k6, or custom script

**Test scenario**: Simulate 100 concurrent players
```yaml
# artillery.yml
config:
  target: 'wss://your-worker.workers.dev'
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - engine: ws
    flow:
      - connect:
          url: '/multiplayer/region/0/0'
      - think: 1
      - send:
          payload: '{"type":"position-update","position":{"x":0,"y":1.6,"z":0},"rotation":{"yaw":0,"pitch":0}}'
      - think: 0.1
```

---

## Open Questions

### Product Questions

1. **Player Limit per Region**: How many players should be visible at once?
   - Recommendation: 10-20 for clean visuals, up to 50 technically feasible

2. **Avatar Customization**: Should players choose color/name/appearance?
   - Phase 1: Just name (localStorage)
   - Phase 2: Color picker
   - Phase 3: Model variations

3. **Persistence**: Should player names/IDs persist across sessions?
   - Recommendation: Yes, use localStorage for player ID

4. **Chat**: Should players be able to text chat?
   - Defer to later phase (increases complexity)

5. **Interactions**: Can players interact? (Wave, point, etc.)
   - Defer to later phase

### Technical Questions

1. **Binary Protocol**: Should we use binary WebSocket frames instead of JSON?
   - Recommendation: Start with JSON (easier to debug), optimize to binary later if needed

2. **Collision Between Players**: Should players collide with each other?
   - Recommendation: No (ghost mode) - simplifies physics and feels more exploratory

3. **Nearby Regions**: Should client connect to multiple adjacent regions?
   - Recommendation: Start with single region, add later for smoother transitions

4. **Offline Fallback**: What happens if WebSocket disconnects?
   - Recommendation: Show "offline" indicator, keep local gameplay working

5. **Authentication**: Should we require login?
   - Phase 1: Anonymous (just localStorage ID)
   - Phase 2: Optional login (save name/avatar across devices)

---

## Implementation Checklist

### Phase 1: Foundation
- [ ] Create `WorldRegion` Durable Object class
- [ ] Register Durable Object in `wrangler.toml`
- [ ] Add WebSocket connection endpoint
- [ ] Test WebSocket connection with Postman/wscat
- [ ] Handle player join/leave
- [ ] Broadcast position updates

### Phase 2: Client Integration
- [ ] Create `useMultiplayer` hook
- [ ] Handle WebSocket connection
- [ ] Send position updates (throttled)
- [ ] Receive remote player data
- [ ] Handle region transitions
- [ ] Show connection status in UI

### Phase 3: Avatars
- [ ] Create `RemotePlayerAvatar` component
- [ ] Render simple 3D model (capsule + sphere)
- [ ] Add name labels
- [ ] Implement position interpolation
- [ ] Test with multiple clients

### Phase 4: Polish
- [ ] Add remote players to minimap
- [ ] Improve avatar appearance
- [ ] Add connection indicators
- [ ] Optimize bandwidth (binary protocol?)
- [ ] Add reconnection logic
- [ ] Load testing

---

## Next Steps

**After reviewing this spec**:

1. **Decide on approach**: Confirm Cloudflare Durable Objects or choose alternative
2. **Set priorities**: Which phase to start with?
3. **Adjust design**: Any changes to room size, update rate, etc.?
4. **Begin implementation**: Start with Phase 1 (server foundation)

**Questions to answer before coding**:
- Should we start with Durable Objects or prototype with Socket.io first?
- What's the target number of concurrent players?
- Any privacy concerns with multiplayer? (all positions visible to all players)
- Should we add authentication or stay anonymous?

---

## References

**Cloudflare Docs**:
- [Durable Objects](https://developers.cloudflare.com/durable-objects/)
- [WebSockets](https://developers.cloudflare.com/workers/runtime-apis/websockets/)

**Multiplayer Patterns**:
- [Fast-Paced Multiplayer (Gabriel Gambetta)](https://www.gabrielgambetta.com/client-server-game-architecture.html)
- [Source Multiplayer Networking (Valve)](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking)

**Similar Projects**:
- [Gather.town](https://gather.town) - 2D multiplayer space
- [Mozilla Hubs](https://hubs.mozilla.com) - 3D VR multiplayer
- [WorkAdventure](https://workadventu.re) - 2D office space

---

**End of Specification**

This document is meant to be iterated on. Feel free to adjust any technical decisions, architecture choices, or implementation priorities based on your specific needs.
