/**
 * Simple logger utility for the application
 * Logs messages to console with appropriate severity levels
 * In production, this can be easily extended to use Winston, Pino, or other logging libraries
 */

declare const process: any;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enableDebug: boolean;
}

const DEFAULT_CONFIG: LoggerConfig = {
  enableDebug: typeof process !== 'undefined' 
    ? (process.env?.NODE_ENV ?? 'development') !== 'production' || (process.env?.DEBUG ?? 'false') === 'true'
    : false,
};

class Logger {
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level.toUpperCase()}] ${message}${
      data ? ' ' + JSON.stringify(data) : ''
    }`;
  }

  debug(message: string, data?: unknown): void {
    if (this.config.enableDebug) {
      console.log(this.formatMessage('debug', message, data));
    }
  }

  info(message: string, data?: unknown): void {
    console.log(this.formatMessage('info', message, data));
  }

  warn(message: string, data?: unknown): void {
    console.warn(this.formatMessage('warn', message, data));
  }

  error(message: string, error?: unknown): void {
    console.error(this.formatMessage('error', message));
    if (error instanceof Error) {
      console.error(`Error: ${error.message}`);
      if (typeof process !== 'undefined' && (process.env?.NODE_ENV ?? 'development') !== 'production') {
        console.error(error.stack);
      }
    } else if (error) {
      console.error('Error details:', error);
    }
  }
}

export const logger = new Logger();
export default logger;
