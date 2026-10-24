export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export type Logger = {
  debug(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
}

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

export function createLogger(options: {
  level: LogLevel
  pretty: boolean
}): Logger {
  const threshold = LEVEL_WEIGHT[options.level]

  const write = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    if (LEVEL_WEIGHT[level] < threshold) {
      return
    }

    if (options.pretty) {
      const suffix = meta === undefined ? '' : ` ${JSON.stringify(meta)}`
      console[level](`[${level}] ${message}${suffix}`)
    } else {
      console[level](JSON.stringify({
        time: new Date().toISOString(),
        level,
        message,
        ...meta,
      }))
    }
  }

  return {
    debug: (message, meta) => write('debug', message, meta),
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta),
  }
}
