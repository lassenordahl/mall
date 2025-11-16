# Database Workflow

## Quick Start

```bash
# Reset and seed with test data
npm run db:reset
npm run db:seed-test
npm run dev
```

## Commands

### Local Development

```bash
npm run db:reset              # Nuke and recreate schema
npm run db:seed-test          # Add 15 test websites (fast)
npm run db:pull-production    # Pull 548 real websites from production
```

### Production Sync

```bash
npm run db:push-production    # Push local data to production
```

## Workflow

### 1. Iterate Locally
- Modify data in local D1
- Test 3D mall layouts
- Experiment with website placements

### 2. Push to Production
```bash
npm run db:push-production
```

## Schema Validation

The dev server checks database health on startup:
- `/health` endpoint validates schema and data
- Helpful error messages with fix commands
- Won't start if DB is misconfigured

## Data Sources

- **Production**: 548 websites (live data)
- **Test seed**: 15 popular websites (quick testing)
- **Custom**: Edit `.wrangler/test-seed.sql` for your own test data
