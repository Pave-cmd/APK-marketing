import winston from 'winston';
import { format } from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// Vytvoření složky pro logy, pokud neexistuje
const logDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Konfigurace formátu logů
const customFormat = format.combine(
  format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `[${timestamp}] [${level.toUpperCase()}]: ${message} ${metaStr}`;
  })
);

// Vytvoření transportů pro různé typy logů
const dailyRotateFileTransport = new DailyRotateFile({
  filename: path.join(logDir, '%DATE%-app.log'),
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d'
});

// Transport pro chyby
const errorFileTransport = new winston.transports.File({
  filename: path.join(logDir, 'exceptions.log'),
  level: 'error'
});

// Transport pro unhandled promise rejections
const rejectionFileTransport = new winston.transports.File({
  filename: path.join(logDir, 'rejections.log')
});

// Vytvoření loggeru
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: customFormat,
  transports: [
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        customFormat
      )
    }),
    dailyRotateFileTransport,
    errorFileTransport
  ],
  exceptionHandlers: [
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        customFormat
      )
    }),
    errorFileTransport
  ],
  rejectionHandlers: [
    rejectionFileTransport
  ],
  exitOnError: false
});

// Vytvoříme speciální funkci pro logování operací webových stránek
const webLog = (message: string, data: any = {}): void => {
  logger.info(`[WEBSITE] ${message}`, data);
};

// Exportujeme logger a speciální funkce
export { logger, webLog };