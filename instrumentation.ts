/**
 * Called once by Next.js when the server starts. Boots the proactive
 * scheduler in the same process — no separate daemon, no cron.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startScheduler } = await import('@/lib/scheduler');
    startScheduler();
  }
}
