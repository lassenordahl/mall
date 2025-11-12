# 3D Neighborhood - Deployment Guide

This guide walks you through deploying the 3D Neighborhood application to Cloudflare.

## Prerequisites

- Cloudflare account (sign up at https://dash.cloudflare.com/)
- Wrangler CLI installed and authenticated
  ```bash
  npm install -g wrangler
  wrangler login
  ```
- Local development environment working

## Architecture

**Deployment Stack:**
- **Frontend**: Cloudflare Pages (React + Three.js)
- **Backend**: Cloudflare Workers (Hono API)
- **Database**: Cloudflare D1 (SQLite)

## Step 1: Create Production D1 Database

Create a new D1 database for production:

```bash
wrangler d1 create neighborhood-db
```

**Output will look like:**
```
✅ Successfully created DB 'neighborhood-db'

[[d1_databases]]
binding = "DB"
database_name = "neighborhood-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**IMPORTANT**: Copy the `database_id` from the output!

## Step 2: Update Backend Configuration

Update `packages/server/wrangler.toml` with your database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "neighborhood-db"
database_id = "PASTE_YOUR_DATABASE_ID_HERE"  # ← Replace this!
```

## Step 3: Initialize Production Database

Run these commands to create the schema and apply migrations:

```bash
cd packages/server

# Initialize schema
wrangler d1 execute neighborhood-db --remote --file=./schema.sql

# Apply migrations
wrangler d1 execute neighborhood-db --remote --file=./migrations/001_add_placements.sql
```

**Verify it worked:**
```bash
wrangler d1 execute neighborhood-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```

You should see: `websites`, `chunks`, `placements`

## Step 4: Import Data to Production

Export local data to SQL format:

```bash
npm run export:production-data
```

This creates: `scripts/data-pipeline/output/production-export.sql`

Import to production D1:

```bash
cd packages/server
wrangler d1 execute neighborhood-db --remote --file=../../scripts/data-pipeline/output/production-export.sql
```

**This may take 2-3 minutes for 548 websites.**

**Verify data imported:**
```bash
wrangler d1 execute neighborhood-db --remote --command "SELECT COUNT(*) as count FROM websites"
```

Should return: `548`

## Step 5: Deploy Backend (Workers)

Deploy the API to Cloudflare Workers:

```bash
cd packages/server
npm run deploy
```

**Output will show your deployed URL:**
```
Published 3d-neighborhood-api (X.XX sec)
  https://3d-neighborhood-api.YOUR-SUBDOMAIN.workers.dev
```

**IMPORTANT**: Copy this URL!

**Test the API:**
```bash
curl https://3d-neighborhood-api.YOUR-SUBDOMAIN.workers.dev/health
```

Should return: `{"status":"ok","timestamp":"..."}`

## Step 6: Configure Frontend Environment

Update `packages/client/.env.production` with your Workers URL:

```env
VITE_API_URL=https://3d-neighborhood-api.YOUR-SUBDOMAIN.workers.dev
```

## Step 7: Build Frontend

Build the production frontend:

```bash
cd packages/client
npm run build
```

This creates the `dist/` directory with optimized assets.

## Step 8: Deploy Frontend (Pages)

Deploy to Cloudflare Pages:

```bash
cd packages/client
wrangler pages deploy dist --project-name=3d-neighborhood
```

**First deployment will ask:**
- Create a new project? → **Yes**
- Project name → **3d-neighborhood**

**Output will show your deployed URL:**
```
✨ Deployment complete! Take a peek over at
  https://3d-neighborhood.pages.dev
```

## Step 9: Test Your Deployment

1. **Visit your Pages URL**: `https://3d-neighborhood.pages.dev`
2. **Test website search**: Type a website name
3. **Test 3D navigation**: Click a website to spawn
4. **Check browser console**: Look for any errors

**If everything works**: 🎉 You're deployed!

## Step 10 (Optional): Custom Domain

Add a custom domain in the Cloudflare dashboard:

1. Go to https://dash.cloudflare.com/
2. Navigate to **Pages** → **3d-neighborhood** → **Custom domains**
3. Click **Set up a custom domain**
4. Enter your domain (e.g., `neighborhood.yourdomain.com`)
5. Follow DNS instructions

## Troubleshooting

### API Returns 404 or CORS Errors

- Check `VITE_API_URL` in `.env.production` matches your Workers URL
- Rebuild frontend: `cd packages/client && npm run build`
- Redeploy: `wrangler pages deploy dist`

### Database Empty or Queries Fail

- Verify data imported: `wrangler d1 execute neighborhood-db --remote --command "SELECT COUNT(*) FROM websites"`
- Re-run import if needed (Step 4)

### Workers Deployment Fails

- Check `wrangler.toml` has correct `database_id`
- Run `wrangler whoami` to verify authentication
- Check Wrangler version: `wrangler --version` (update if old)

### Frontend Shows "Loading..." Forever

- Open browser console (F12) → Check for errors
- Verify API URL is correct
- Test API directly: `curl YOUR_WORKERS_URL/health`

## Updating Your Deployment

### Update Frontend Only

```bash
cd packages/client
npm run build
wrangler pages deploy dist
```

### Update Backend Only

```bash
cd packages/server
npm run deploy
```

### Update Both

```bash
npm run deploy:all
```

## Monitoring & Logs

**View Workers logs (real-time):**
```bash
cd packages/server
wrangler tail
```

**View Workers dashboard:**
https://dash.cloudflare.com/ → Workers & Pages → 3d-neighborhood-api

**View Pages dashboard:**
https://dash.cloudflare.com/ → Pages → 3d-neighborhood

## Cost Estimates

**Cloudflare Free Tier (generous limits):**
- Workers: 100,000 requests/day
- D1: 5GB storage, 5M reads/day, 100K writes/day
- Pages: Unlimited bandwidth, 500 builds/month

**Expected usage for 548 websites:**
- Workers: ~100-500 requests/day (initially)
- D1: ~2MB storage
- Pages: Static hosting (free)

**You should stay well within the free tier.**

## Next Steps

- Add more websites (scale to 1K, 10K, 100K+)
- Set up custom domain
- Enable analytics in Cloudflare dashboard
- Implement Cloudflare Vectorize for larger datasets (100K+ sites)

## Support

- Cloudflare Docs: https://developers.cloudflare.com/
- Wrangler CLI: https://developers.cloudflare.com/workers/wrangler/
- D1 Database: https://developers.cloudflare.com/d1/
- Pages: https://developers.cloudflare.com/pages/

---

**Deployed?** Share your URL! 🚀
