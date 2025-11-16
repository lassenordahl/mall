/**
 * Database health check
 * Validates schema and provides helpful error messages
 */

export async function checkDatabase(db: D1Database): Promise<{ healthy: boolean; message?: string }> {
  try {
    // Check if websites table exists
    const result = await db.prepare('SELECT name FROM sqlite_master WHERE type="table" AND name="websites"').all();

    if (result.results.length === 0) {
      return {
        healthy: false,
        message: `❌ Database not initialized!

Run these commands to set up your local database:

  cd packages/server
  npm run db:reset           # Reset database
  npm run db:seed-test       # Quick: 15 test websites
  npm run db:pull-production # Full: Pull 548 websites from production

Then restart your dev server.`
      };
    }

    // Check if table has data
    const count = await db.prepare('SELECT COUNT(*) as count FROM websites').first<{ count: number }>();

    if (count?.count === 0) {
      return {
        healthy: false,
        message: `⚠️  Database is empty!

Run one of these commands to populate your database:

  npm run db:seed-test       # Quick: 15 test websites
  npm run db:pull-production # Full: Pull 548 websites from production

Then restart your dev server.`
      };
    }

    return { healthy: true };
  } catch (error) {
    return {
      healthy: false,
      message: `❌ Database error: ${error}

Run these commands to fix:

  cd packages/server
  npm run db:reset
  npm run db:seed-test`
    };
  }
}
