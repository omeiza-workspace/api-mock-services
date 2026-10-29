/**
 * Graceful shutdown manager.
 *
 * Registers signal handlers and tracks all mock servers for clean shutdown.
 * Prevents the test runner from hanging due to open handles.
 */

const servers = new Set()

/** Register a server for tracking. */
export function trackServer(server) {
  servers.add(server)
}

/** Unregister a server. */
export function untrackServer(server) {
  servers.delete(server)
}

/** Close all tracked servers gracefully. */
export async function closeAllServers() {
  const promises = [...servers].map(async (server) => {
    try {
      await server.close()
    } catch {
      // Ignore errors during shutdown
    }
  })
  await Promise.all(promises)
  servers.clear()
}

/** Force close all tracked servers (emergency). */
export async function forceCloseAllServers() {
  const promises = [...servers].map(async (server) => {
    try {
      await server.forceClose?.()
    } catch {
      // Ignore
    }
  })
  await Promise.all(promises)
  servers.clear()
}

/** Install signal handlers for graceful shutdown. */
export function installSignalHandlers() {
  const signals = ['SIGTERM', 'SIGINT', 'SIGHUP']

  for (const signal of signals) {
    process.on(signal, async () => {
      console.error(`[shutdown] Received ${signal}, closing servers...`)
      await closeAllServers()
      process.exit(0)
    })
  }

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('[shutdown] Uncaught exception:', error)
    await forceCloseAllServers()
    process.exit(1)
  })

  process.on('unhandledRejection', async (reason) => {
    console.error('[shutdown] Unhandled rejection:', reason)
    await forceCloseAllServers()
    process.exit(1)
  })
}

export const shutdownManager = {
  trackServer,
  untrackServer,
  closeAllServers,
  forceCloseAllServers,
  installSignalHandlers,
}
