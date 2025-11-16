# Claude.md - Project Context & Knowledge Base

## Knowledge Base System

The folder `specs/*` is the project's knowledge base.

- **Search there first** when you need information
- **Dump anything useful** you discover there
- Use very descriptive file names in markdown format (e.g., `𝚊_𝚟𝚎𝚛𝚢_𝚍𝚎𝚜𝚌𝚛𝚒𝚙𝚝𝚒𝚟𝚎_𝚏𝚒𝚕𝚎_𝚗𝚊𝚖𝚎.𝚖𝚍`)

## Quick Context

**Project:** 3D Neighborhood - an interactive 3D web visualization of websites organized by semantic similarity

**Tech Stack:**
- Frontend: React + Three.js (3D visualization)
- Backend: Hono (Cloudflare Workers)
- Database: Cloudflare D1 (SQLite)
- Data Pipeline: Modal (scraping, embeddings, descriptions)

**Key Files:**
- `packages/server/schema.sql` - Database schema (single source of truth)
- `packages/server/DB-WORKFLOW.md` - Database workflow documentation
- `specs/*` - Knowledge base (search here first!)

## Recent Work

- Eliminated migrations system (no more incremental migrations)
- Schema is now always fresh, data is imported separately
- Workflow: `npm run db:reset` → choose data source → import → dev

## Useful Commands

```bash
npm run db:reset              # Nuke & create fresh schema
npm run db:seed-test          # Add 15 test websites
npm run db:import-local       # Import from data pipeline
npm run db:pull-production    # Pull 548 real websites
npm run dev                   # Start dev server
```
