import { createLogger, format, transports } from 'winston'
import path from 'path'

const logDir = path.resolve(__dirname, '../../logs')
const logFile = path.join(logDir, 'desktop.log')

const logger = createLogger({
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    format: format.combine(
        format.printf(({ level, message, ...meta }) => {
            return `[${level}] ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`
        })
    ),
    transports: [
        new transports.File({ filename: logFile, maxsize: 1024 * 1024 * 5, maxFiles: 5 }),
        new transports.Console({ format: format.simple() })
    ]
})

export default logger
