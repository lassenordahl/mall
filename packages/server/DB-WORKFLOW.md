# Database Workflow

This project uses a **no-migrations** approach: the schema is always fresh, and data is imported via separate commands.

## Quick Start

```bash
# Reset to fresh schema and seed with test data
npm run db:reset
npm run db:seed-test
npm run dev
```

## Philosophy

- **Schema is declarative**: `schema.sql` is the single source of truth
- **Always nuke and reimport**: No incremental migrations, always fresh start
- **Data is separate from schema**: Import data after schema reset
- **Easy to evolve**: Add new fields to schema, tooling handles scraped data import

## Commands

### Local Development

```bash
# 1. Always start with reset to get fresh schema
npm run db:reset

# 2. Choose ONE data source to import:

# Option A: Import test data (15 websites, fastest)
npm run db:seed-test

# Option B: Import from local data pipeline
npm run db:import-local

# Option C: Import from production (548 websites)
npm run db:pull-production

# 3. Start dev server
npm run dev
```

### Production Sync

```bash
npm run db:push-production    # Push local data to production
```

## Typical Workflows

### Quick Testing (30 seconds)
```bash
npm run db:reset
npm run db:seed-test
npm run dev
```

### Full Feature Testing (1-2 minutes)
```bash
npm run db:reset
npm run db:import-local    # Uses data pipeline database
npm run dev
```

### Production Verification
```bash
npm run db:reset
npm run db:pull-production
npm run dev
```

## Schema Validation

The dev server checks database health on startup:
- Validates schema exists and is correct
- Checks if database has data
- Helpful error messages with fix commands
- Won't start if DB is misconfigured

Check manually: `npm run db:init-local`

## Adding New Fields

When you need to add new fields to the schema:

1. **Update `schema.sql`** with the new column(s)
2. **Run schema reset**: `npm run db:reset`
3. **Update data pipeline** to populate new field(s)
4. **Re-import data**: `npm run db:import-local` or `npm run db:pull-production`

The data pipeline will be built with tooling to automatically map scraped data to your new schema.
