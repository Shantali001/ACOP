import { app } from './app.js';
import { env } from './config/env.js';
import { verifyDatabaseConnection } from './db/pool.js';
import { runModemAutoHeal } from './modems/routes.js';

process.on('uncaughtException', (error: unknown) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason: unknown) => {
  console.error('Unhandled rejection:', reason);
});

async function bootstrap() {
  if (env.verifyDbOnStartup) {
    await verifyDatabaseConnection();
    console.log('PostgreSQL connection verified.');
  }

  app.listen(env.port, () => {
    console.log(`ACOP backend listening on http://localhost:${env.port}`);
  });

  if (env.modemDriver === 'serial') {
    // Self-heal modem ports automatically: once shortly after boot (so a port
    // that moved while the server was off is fixed before anyone tries to
    // dial), then again on a timer so a port that moves mid-session (cable
    // replugged, driver reassigns COM number, etc.) recovers without anyone
    // having to open the Modems page and click Test.
    const AUTO_HEAL_INTERVAL_MS = 60_000;

    const heal = () => {
      runModemAutoHeal().catch((error: unknown) => {
        console.error('Modem auto-heal run failed:', error);
      });
    };

    setTimeout(heal, 5_000);
    setInterval(heal, AUTO_HEAL_INTERVAL_MS);
  }
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start ACOP backend.');
  console.error(error);
  process.exit(1);
});
