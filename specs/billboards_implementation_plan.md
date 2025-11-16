# Billboard System - Implementation Plan

## Overview
Interactive billboard system for the 3D neighborhood where users can purchase ad space on buildings, upload images, and display them to all visitors.

## High-Level Architecture

### Components
1. **Billboard Rendering** - Three.js planes with textures on building faces
2. **Billboard Mode** - Press 'B' to enter purchase/management mode
3. **User System** - Authentication for ownership
4. **Image Upload** - WebP images uploaded to Cloudflare
5. **Payment** - Stripe integration for $1 purchases
6. **Moderation** - Content safety checks

## Database Schema

### `billboards` Table
```sql
CREATE TABLE billboards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  building_url TEXT NOT NULL,           -- FK to websites(url)
  face TEXT NOT NULL,                   -- 'north', 'south', 'east', 'west', 'top'
  position_x REAL NOT NULL,             -- Relative % (0.0-1.0) on face
  position_y REAL NOT NULL,             -- Relative % (0.0-1.0) on face
  width REAL NOT NULL,                  -- Billboard width in world units
  height REAL NOT NULL,                 -- Billboard height in world units
  image_url TEXT,                       -- Cloudflare Images URL (null = available)
  owner_user_id INTEGER,                -- FK to users(id) (null = unclaimed)
  purchased_at TEXT,                    -- ISO timestamp
  expires_at TEXT,                      -- NULL = forever, or ISO timestamp
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (building_url) REFERENCES websites(url),
  FOREIGN KEY (owner_user_id) REFERENCES users(id)
);

CREATE INDEX idx_billboards_building ON billboards(building_url);
CREATE INDEX idx_billboards_owner ON billboards(owner_user_id);
```

### `users` Table (Future Phase 3)
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,         -- bcrypt hash
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login TEXT
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
```

## Coordinate System Design

### Billboard Placement Strategy
- **Per Building**: 1 billboard per building face (5 total: north, south, east, west, top)
- **Face Definition**:
  - North: -Z direction (negative Z normal)
  - South: +Z direction (positive Z normal)
  - East: +X direction (positive X normal)
  - West: -X direction (negative X normal)
  - Top: +Y direction (on roof)

### Relative Positioning
Billboards use **relative coordinates** (0.0-1.0) on their assigned face:
- `position_x: 0.5` = centered horizontally on face
- `position_y: 0.75` = 75% up the face height
- `width/height` in world units (e.g., 8 units wide × 6 units tall)

### World Position Calculation
Given a building at `(worldX, worldY, worldZ)` with dimensions `(width, height, depth)`:

```typescript
function calculateBillboardWorldPosition(
  building: BuildingData,
  billboard: BillboardData
): { position: [number, number, number], rotation: [number, number, number] } {
  const { worldX, worldZ, width, height } = building;
  const { face, position_x, position_y, width: bWidth, height: bHeight } = billboard;

  const baseY = 0; // Ground level
  const centerY = baseY + height / 2;
  const halfWidth = width / 2;

  switch (face) {
    case 'north': // -Z face
      return {
        position: [
          worldX + (position_x - 0.5) * width,
          baseY + position_y * height,
          worldZ - halfWidth + 0.1 // Offset slightly to avoid z-fighting
        ],
        rotation: [0, 0, 0] // Face toward +Z
      };
    case 'south': // +Z face
      return {
        position: [
          worldX + (position_x - 0.5) * width,
          baseY + position_y * height,
          worldZ + halfWidth - 0.1
        ],
        rotation: [0, Math.PI, 0] // Face toward -Z
      };
    case 'east': // +X face
      return {
        position: [
          worldX + halfWidth - 0.1,
          baseY + position_y * height,
          worldZ + (position_x - 0.5) * width
        ],
        rotation: [0, -Math.PI / 2, 0] // Face toward -X
      };
    case 'west': // -X face
      return {
        position: [
          worldX - halfWidth + 0.1,
          baseY + position_y * height,
          worldZ + (position_x - 0.5) * width
        ],
        rotation: [0, Math.PI / 2, 0] // Face toward +X
      };
    case 'top': // +Y face (roof)
      return {
        position: [
          worldX + (position_x - 0.5) * width,
          baseY + height + 0.1,
          worldZ + (position_y - 0.5) * width
        ],
        rotation: [-Math.PI / 2, 0, 0] // Face upward
      };
  }
}
```

## Data Flow

### Current Architecture
```
Client                     Server (Hono)              Database (D1)
  |                             |                           |
  | GET /api/chunks/:cx/:cz     |                           |
  |----------------------------->|                           |
  |                             | SELECT from chunks cache  |
  |                             |-------------------------->|
  |                             |<--------------------------|
  |                             | (if miss: generate chunk) |
  |                             | - Get buildings           |
  |                             | - Run k-NN                |
  |                             | - Create placements       |
  |<--- ChunkResponse ---------|                           |
  |                             |                           |
  | Render buildings            |                           |
```

### With Billboards (Phase 1)
```
Client                     Server (Hono)              Database (D1)
  |                             |                           |
  | GET /api/chunks/:cx/:cz     |                           |
  |----------------------------->|                           |
  |                             | SELECT from chunks cache  |
  |                             |-------------------------->|
  |                             |<--------------------------|
  |                             | (if miss: generate chunk) |
  |                             | - Get buildings           |
  |                             | - Generate billboards     |
  |                             | - Run k-NN                |
  |                             | - Create placements       |
  |                             | - Create billboard records|
  |                             |-------------------------->|
  |<--- ChunkResponse ---------|                           |
  | (includes billboard data)   |                           |
  |                             |                           |
  | Render buildings            |                           |
  | + Render billboards         |                           |
```

### Updated ChunkResponse Type
```typescript
interface BillboardData {
  id: number;
  buildingUrl: string;
  face: 'north' | 'south' | 'east' | 'west' | 'top';
  positionX: number;        // 0.0-1.0
  positionY: number;        // 0.0-1.0
  width: number;            // World units
  height: number;           // World units
  imageUrl: string | null;  // Null = placeholder/available
  ownerUserId: number | null;
  purchasedAt: string | null;
  expiresAt: string | null;
}

interface BuildingData {
  url: string;
  title: string;
  description: string;
  worldX: number;
  worldZ: number;
  width: number;
  height: number;
  isNew: boolean;
  isAnchor: boolean;
  billboards?: BillboardData[]; // NEW: Billboard data for this building
}

interface ChunkResponse {
  chunkX: number;
  chunkZ: number;
  buildings: BuildingData[];
  // billboards are nested in buildings array
}
```

## Implementation Phases

### Phase 1: Static Billboard Rendering (MVP) ✅ COMPLETED
**Goal**: Render billboards on buildings with proper 3D positioning and sizing

**Tasks Completed**:
- [✅] Add `billboards` table to `schema.sql`
- [✅] Billboards created as fixture data in seed script (not auto-generated during chunk creation)
  - 5 test billboards created for: google.com, github.com, youtube.com, reddit.com, amazon.com
  - Random face selection ('north', 'south', 'east', 'west', 'top')
  - Centered position (0.5, 0.75) for MVP
  - **Dynamic sizing**: 80% of building width with 4:3 aspect ratio
- [✅] Add test billboard image to `/packages/client/public/billboards/test.svg`
- [✅] Update `BillboardData` type in `shared/types.ts` and export
- [✅] Update `/api/chunks/:cx/:cz` endpoint to fetch billboard data via JOIN
- [✅] Create `<Billboard>` component in `packages/client/src/components/Billboard.tsx`
  - **3D panel structure**: Black backing box (0.2 units thick) + image plane
  - **Proper positioning**: Floats 0.5 units OUTSIDE building wall
  - **Face culling fix**: Plane rotated 180° to show texture facing outward
  - **Dynamic sizing**: Billboard width = building.width × 0.8, height = width × 0.75
  - Texture loaded via `useTexture` hook from `@react-three/drei`
- [✅] Update `<Building>` component to render billboard if purchased
- [✅] Billboard only renders when `imageUrl` is not null

**Testing**:
```bash
npm run db:reset      # Reset database
npm run db:seed-test  # Seed 15 websites + 5 billboards
npm run dev           # Start server
# Visit site, search for google/github/youtube/reddit/amazon
# See large billboards on building exteriors!
```

**Implementation Decisions Made**:
1. ✅ **Billboard as fixtures**: Billboards are now created as seed data, not auto-generated during chunk creation
2. ✅ **Caching strategy**: Always query `billboards` table separately from chunk cache for fresh data
3. ✅ **Rendering strategy**: No billboard rendering until purchased (invisible when `imageUrl` is null)
4. ✅ **Dynamic sizing**: Billboards scale to 80% of building width (looks better on varied building sizes)
5. ✅ **3D structure**: Black backing panel provides depth, image plane in front
6. ✅ **Face direction**: Image plane rotated to face outward from building

**Technical Details**:
- **Billboard positioning**: Calculated relative to building face with offset to prevent z-fighting
- **Coordinate system**: Uses building's world position + face normal direction
- **Rendering layers**:
  1. Black box backing (z = PANEL_DEPTH/2)
  2. Image plane (z = -PANEL_DEPTH/2 - 0.01, rotated 180° on Y-axis)
- **Texture format**: SVG (scales perfectly, small file size)

**Bugs Fixed During Implementation**:
1. ✅ React hooks violation - `useTexture` called conditionally (fixed by always calling hooks)
2. ✅ Billboard inside building - offset direction backwards (reversed offset calculation)
3. ✅ Billboard too small - fixed 8 units (changed to 80% of building width)
4. ✅ Black billboards - image on wrong side of panel (flipped Z positions and rotated plane)
5. ✅ Search API error - database instance mismatch (restarted server after reset)

**Known Issues**:
- ⚠️ No UNIQUE constraint on `building_url` in billboards table
- ⚠️ Billboard images served from `/public` - need Cloudflare Images integration (Phase 5)
- ⚠️ `recordBillboards` function still exists but unused (cleanup needed)

### Phase 2: Billboard Mode (UI)
**Goal**: Press 'B' to enter billboard browsing/purchase mode

**Tasks**:
- [ ] Add keyboard listener for 'B' key in `<Player>` component
- [ ] Create billboard mode state management
- [ ] Create `<BillboardMode>` overlay component
  - Show all billboards on targeted building
  - Highlight available (unclaimed) billboards
  - Show purchase button (stubbed for now)
- [ ] Update raycasting to detect billboard clicks
- [ ] Add billboard info panel (owner, price, status)

**Testing**:
- Press 'B' while looking at building
- See overlay showing billboards
- Click "Purchase" → stubbed success message

### Phase 3: User System (Auth)
**Goal**: Users can register, login, and own billboards

**Tasks**:
- [ ] Add `users` table to schema
- [ ] Create `/api/auth/register` endpoint
- [ ] Create `/api/auth/login` endpoint (JWT or session cookies)
- [ ] Create `/api/auth/me` endpoint (get current user)
- [ ] Add auth middleware to protect routes
- [ ] Create login/register UI components
- [ ] Add user session state management
- [ ] Show logged-in username in UI

**Testing**:
- Register new user
- Login
- See username displayed
- Logout → redirected to login

### Phase 4: Image Upload (Local Storage)
**Goal**: Upload billboard images to local file system

**Tasks**:
- [ ] Add file input to billboard purchase flow
- [ ] Validate image on client (format, size, dimensions)
- [ ] Create `/api/billboards/upload` endpoint
  - Validate image server-side
  - Save to `/packages/server/public/billboards/:id.webp`
  - Update billboard record with image path
- [ ] Update billboard rendering to use uploaded image
- [ ] Add image preview before purchase

**Testing**:
- Purchase billboard
- Upload test image (512×512 WebP)
- See image rendered on building
- Other players see the same image

### Phase 5: Cloudflare Images Integration
**Goal**: Store billboard images in Cloudflare Images CDN

**Tasks**:
- [ ] Set up Cloudflare Images account
- [ ] Add Cloudflare Images API credentials to wrangler.toml
- [ ] Update `/api/billboards/upload` to use Cloudflare API
- [ ] Update image URLs to Cloudflare delivery URLs
- [ ] Add image variant config (resize to standard dimensions)
- [ ] Migrate existing local images to Cloudflare

**Testing**:
- Upload image → stored in Cloudflare
- Image served via Cloudflare CDN
- Fast global delivery

### Phase 6: Stripe Payment Integration
**Goal**: Charge $1 for billboard purchases

**Tasks**:
- [ ] Set up Stripe account (test mode)
- [ ] Add Stripe API keys to environment
- [ ] Create `/api/payment/create-intent` endpoint
- [ ] Add Stripe Elements to purchase UI
- [ ] Handle payment success webhook
- [ ] Update billboard ownership on successful payment
- [ ] Add payment history to user profile

**Testing**:
- Attempt billboard purchase
- Stripe checkout flow (test card)
- Payment success → billboard owned
- Payment failure → billboard still available

### Phase 7: Content Moderation
**Goal**: Block inappropriate billboard images

**Tasks**:
- [ ] Set up Cloudflare AI Workers
- [ ] Add moderation check to upload flow
- [ ] Reject unsafe images before storing
- [ ] Add manual review queue for edge cases
- [ ] Allow reporting of inappropriate billboards
- [ ] Admin tools to remove violating content

**Testing**:
- Upload safe image → accepted
- Upload NSFW test image → rejected
- Report billboard → flagged for review

## Technical Considerations

### Performance
- **Texture Loading**: Use `THREE.TextureLoader` with caching to avoid re-downloading
- **LOD (Level of Detail)**: Only render billboard textures within N chunks of player
- **Placeholder Strategy**: Show low-res placeholder until high-res loads

### Scalability
- **Chunk Cache**: Billboard data stored in `chunks.data` JSON for fast loads
- **Image Delivery**: Cloudflare Images CDN handles global distribution
- **Database Indexes**: Index on `building_url` for fast billboard lookups

### Security
- **Image Validation**: Check file type, size, dimensions server-side
- **Content Moderation**: AI-powered NSFW detection
- **Rate Limiting**: Prevent spam uploads
- **Authentication**: Secure JWT tokens or HTTP-only cookies

### Billboard Pricing & Economics
- **Initial Price**: $1 per billboard
- **Future**: Dynamic pricing based on building traffic/popularity
- **Renewals**: Optional expiration + renewal system
- **Revenue**: Stripe handles payments, 2.9% + $0.30 fee per transaction

## Open Design Questions

### For Phase 1 (Need to Decide):
1. **Billboard generation strategy**:
   - Generate billboards deterministically during chunk creation (like buildings)?
   - Or pre-populate billboards table when websites are placed?

2. **Billboard density**:
   - 1 billboard per building (Phase 1)?
   - Up to 5 billboards per building (1 per face)?
   - Configurable based on building size?

3. **Placeholder rendering**:
   - Show "AVAILABLE" image for unclaimed billboards?
   - Or invisible until purchased?

4. **Caching strategy**:
   - Include billboards in `chunks.data` JSON (faster, stale data risk)?
   - Or always query `billboards` table (slower, always fresh)?

### For Future Phases:
- **Ownership duration**: Forever, or time-limited (e.g., 30 days)?
- **Billboard trading**: Can users sell/transfer billboards?
- **Analytics**: Track billboard impressions (views)?
- **Prime locations**: Auction system for high-traffic areas?

## MVP Success Criteria (Phase 1)

✅ **Definition of Done**:
- Every building in the neighborhood has 1 billboard
- Billboards render as textured planes on building faces
- Billboard positions are deterministic (same building = same billboard location)
- Test image loads and displays correctly
- No performance degradation (maintains 60fps)
- Billboard data flows through existing chunk API

---

**Next Steps**: Implement Phase 1 tasks, then iterate based on learnings about data model and rendering performance.
