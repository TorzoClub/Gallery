import { loadEnvConfig } from './config'
import { createLogger } from './logger'
import { startServer } from './server'

async function main(): Promise<void> {
  const env = loadEnvConfig()
  const logger = createLogger({
    level: env.log_level,
    pretty: env.app_env !== 'production',
  })

  const started = await startServer({ env, logger })
  let shutting_down = false

  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (shutting_down) {
      return
    }
    shutting_down = true
    logger.info('shutdown requested', { signal })
    try {
      await started.close()
      logger.info('shutdown complete')
      process.exit(0)
    } catch (error) {
      logger.error('shutdown failed', {
        error: error instanceof Error ? error.stack : String(error),
      })
      process.exit(1)
    }
  }

  process.once('SIGINT', () => {
    void shutdown('SIGINT')
  })
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM')
  })

  process.once('uncaughtException', (error) => {
    logger.error('uncaught exception', {
      error: error.stack ?? String(error),
    })
    void shutdown('SIGTERM')
  })

  process.once('unhandledRejection', (reason) => {
    logger.error('unhandled rejection', {
      error: reason instanceof Error ? reason.stack : String(reason),
    })
    void shutdown('SIGTERM')
  })
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
