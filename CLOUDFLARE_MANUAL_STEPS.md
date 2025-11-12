# Cloudflare Deployment - Manual Steps

This document contains the **manual steps you need to perform** on Cloudflare to deploy the 3D Neighborhood application.

All automated setup (code, configs, scripts) has been completed. You just need to run these commands and update a few IDs.

---

## Prerequisites Checklist

- [ ] Have a Cloudflare account (free tier works!)
- [ ] Wrangler CLI installed: `npm install -g wrangler@latest`
- [ ] Wrangler authenticated: `wrangler login`
- [ ] Local data imported (should already be done): `npm run data:import -- --sample`

**Verify local setup:**
```bash
# Check local database has data
sqlite3 scripts/data-pipeline/output/neighborhood.db "SELECT COUNT(*) FROM websites"
# Should show: 548

# Check wrangler is installed
wrangler --version
```

---

## Step 1: Create Production D1 Database

Run this command to create a new D1 database:

```bash
wrangler d1 create neighborhood-db
```

**Expected output:**
```
✅ Successfully created DB 'neighborhood-db'

[[d1_databases]]
binding = "DB"
database_name = "neighborhood-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**ACTION REQUIRED:** Copy the `database_id` value!

---

## Step 2: Update Backend Config with Database ID

Edit `packages/server/wrangler.toml` and replace the placeholder database_id:

**Before:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "neighborhood-db"
database_id = "local-dev-db-id"  # Placeholder
```

**After:**
```toml
[[d1_databases]]
binding = "DB"
database_name = "neighborhood-db"
database_id = "PASTE_YOUR_ACTUAL_DATABASE_ID_HERE"
```

Save the file.

---

## Step 3: Initialize Production Database Schema

Run these commands to create tables in production D1:

```bash
cd packages/server

# Create tables
wrangler d1 execute neighborhood-db --remote --file=./schema.sql

# Apply migrations
wrangler d1 execute neighborhood-db --remote --file=./migrations/001_add_placements.sql
```

**Verify it worked:**
```bash
wrangler d1 execute neighborhood-db --remote --command "SELECT name FROM sqlite_master WHERE type='table'"
```

**Expected output:**
```
websites
chunks
placements
```

---

## Step 4: Export and Import Data to Production

From the root directory:

```bash
# Generate SQL export file
npm run export:production-data
```

This creates: `scripts/data-pipeline/output/production-export.sql`

```bash
# Import to production D1
cd packages/server
wrangler d1 execute neighborhood-db --remote --file=../../scripts/data-pipeline/output/production-export.sql
```

**This will take 2-3 minutes.** You'll see progress output.

**Verify import succeeded:**
```bash
wrangler d1 execute neighborhood-db --remote --command "SELECT COUNT(*) as count FROM websites"
```

**Expected output:** `548`

---

## Step 5: Deploy Backend (Cloudflare Workers)

Deploy the API:

```bash
cd packages/server
npm run deploy
```

**Expected output:**
```
Total Upload: XX.XX KiB / gzip: XX.XX KiB
Uploaded 3d-neighborhood-api (X.XX sec)
Published 3d-neighborhood-api (X.XX sec)
  https://3d-neighborhood-api.YOUR-SUBDOMAIN.workers.dev
```

**ACTION REQUIRED:** Copy the Workers URL!

**Test it:**
```bash
curl https://3d-neighborhood-api.YOUR-SUBDOMAIN.workers.dev/health
```

**Expected response:**
```json
{"status":"ok","timestamp":"2025-11-11T..."}
```

---

## Step 6: Update Frontend Environment Variable

Edit `packages/client/.env.production`:

**Before:**
```env
VITE_API_URL=PLACEHOLDER_REPLACE_WITH_WORKERS_URL
```

**After:**
```env
VITE_API_URL=https://3d-neighborhood-api.YOUR-SUBDOMAIN.workers.dev
```

Save the file.

---

## Step 7: Build and Deploy Frontend (Cloudflare Pages)

From root directory:

```bash
# Build frontend (production mode)
npm run build:client
```

**Deploy to Pages:**
```bash
cd packages/client
wrangler pages deploy dist --project-name=3d-neighborhood
```

**On first deployment, you'll be asked:**
- Create a new project? → **Yes**
- Project name → **3d-neighborhood**

**Expected output:**
```
✨ Deployment complete! Take a peek over at
  https://XXXXXXXXX.3d-neighborhood.pages.dev
```

**ACTION REQUIRED:** Copy the Pages URL!

---

## Step 8: Test Your Deployment

1. **Open your Pages URL** in a browser
2. **Test search:** Type a website name (e.g., "google")
3. **Test spawn:** Click a website from search results
4. **Navigate:** Use WASD + mouse to explore
5. **Check console:** Open DevTools (F12) → Console, look for errors

**If you see the 3D world and can navigate:** 🎉 **Success!**

---

## Optional: Add Custom Domain

1. Go to: https://dash.cloudflare.com/
2. Navigate to: **Pages** → **3d-neighborhood** → **Custom domains**
3. Click: **Set up a custom domain**
4. Enter your domain: `neighborhood.yourdomain.com`
5. Follow DNS instructions

---

## Troubleshooting

### Problem: "Failed to fetch chunk" errors in console

**Solution:**
- Verify `VITE_API_URL` in `.env.production` is correct
- Rebuild frontend: `npm run build:client`
- Redeploy: `cd packages/client && wrangler pages deploy dist`

### Problem: Database queries return empty results

**Solution:**
- Check data was imported:
  ```bash
  wrangler d1 execute neighborhood-db --remote --command "SELECT COUNT(*) FROM websites"
  ```
- If 0, re-run Step 4

### Problem: Workers deployment fails

**Solution:**
- Verify `database_id` in `packages/server/wrangler.toml` is correct
- Check authentication: `wrangler whoami`
- Update Wrangler: `npm install -g wrangler@latest`

### Problem: CORS errors

**Solution:**
- Backend already has CORS enabled
- Ensure you're using the correct API URL (no trailing slash)
- Check browser console for exact error

---

## Quick Command Reference

```bash
# View Workers logs (real-time)
cd packages/server && wrangler tail

# Check production database
wrangler d1 execute neighborhood-db --remote --command "SELECT * FROM websites LIMIT 5"

# Redeploy backend
cd packages/server && npm run deploy

# Redeploy frontend
npm run deploy:frontend

# Deploy both
npm run deploy:all
```

---

## Your Deployment URLs

After completing the steps above, fill this in:

**Backend (Workers):**
```
https://3d-neighborhood-api.YOUR-SUBDOMAIN.workers.dev
```

**Frontend (Pages):**
```
https://XXXXXXXXX.3d-neighborhood.pages.dev
```

**Custom Domain (optional):**
```
https://neighborhood.yourdomain.com
```

---

## Cost

**Cloudflare Free Tier:**
- Workers: 100,000 requests/day
- D1: 5GB storage, 5M reads/day
- Pages: Unlimited bandwidth

**Your usage (548 websites):**
- Workers: ~100-500 requests/day initially
- D1: ~2MB storage
- Pages: Free

**You'll stay within the free tier. No credit card required.**

---

## Next Steps After Deployment

- [ ] Share your deployed URL!
- [ ] Monitor in Cloudflare dashboard
- [ ] Add more websites (scale to 10K+)
- [ ] Set up analytics
- [ ] Configure custom domain

---

## Support

- **Cloudflare Docs:** https://developers.cloudflare.com/
- **Wrangler CLI:** https://developers.cloudflare.com/workers/wrangler/
- **D1 Database:** https://developers.cloudflare.com/d1/

---

**Need help?** Open an issue or check the Cloudflare Community forum.

**Deployed successfully?** 🚀 Congratulations!
