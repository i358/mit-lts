import * as fs from 'fs';
import * as path from 'path';

export enum LogLevel {
    ERROR = 'error',
    WARN = 'warn', 
    INFO = 'info',
    DEBUG = 'debug',
    VERBOSE = 'verbose'
}

interface LoggerOptions {
    logLevel: LogLevel;
    writeToFile?: boolean;
    logFilePath?: string;
    module?: string;
}

class Logger {
    private logLevel: LogLevel;
    private writeToFile: boolean;
    private logFilePath?: string;
    private module: string;
    private logLevelPriority: { [key in LogLevel]: number } = {
        [LogLevel.ERROR]: 0,
        [LogLevel.WARN]: 1,
        [LogLevel.INFO]: 2,
        [LogLevel.DEBUG]: 3,
        [LogLevel.VERBOSE]: 4
    };

    constructor(options: LoggerOptions) {
        this.logLevel = options.logLevel;
        this.writeToFile = options.writeToFile || false;
        this.logFilePath = options.logFilePath;
        this.module = options.module || 'SYSTEM';
        
        
        if (this.writeToFile && this.logFilePath) {
            const logDir = path.dirname(this.logFilePath);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
        }
    }

    private shouldLog(level: LogLevel): boolean {
        return this.logLevelPriority[level] <= this.logLevelPriority[this.logLevel];
    }

    private getCallerInfo(): string {
        const error = {};
        const originalPrepareStackTrace = Error.prepareStackTrace;
        let callerInfo = 'unknown:0';

        try {
            Error.prepareStackTrace = (_, callSites) => callSites;
            Error.captureStackTrace(error);
            const stack = (error as any).stack as NodeJS.CallSite[];

            
            let skipFrames = 0;
            while (
                skipFrames < stack.length && 
                stack[skipFrames].getFileName()?.includes('logger.js')
            ) {
                skipFrames++;
            }

            
            for (let i = skipFrames; i < stack.length; i++) {
                const call = stack[i];
                const fileName = call.getFileName();
                
                if (!fileName) continue;

                
                if (
                    fileName.includes('internal/') ||
                    fileName.includes('node:') ||
                    fileName.includes('node_modules/')
                ) {
                    continue;
                }

                
                let srcFile = fileName;
                const lineNumber = call.getLineNumber();

                
                if (srcFile.includes('dist/')) {
                    srcFile = srcFile
                        .replace(/dist[\\/]/, '')  
                        .replace(/\.js$/, '.ts');  
                }

                
                const srcPathMatch = srcFile.match(/src[\\/](.+)$/);
                if (srcPathMatch) {
                    callerInfo = `${srcPathMatch[1]}:${lineNumber}`;
                    break;
                }

                
                callerInfo = `${path.basename(srcFile)}:${lineNumber}`;
                break;
            }
        } finally {
            Error.prepareStackTrace = originalPrepareStackTrace;
        }

        return callerInfo;
    }

    private formatMessage(level: LogLevel, message: string, data?: any): string {
        const timestamp = new Date().toISOString();
        const levelStr = level.toUpperCase();
        const moduleStr = this.module;
        const callerInfo = this.getCallerInfo();

        let formattedMessage = `(${callerInfo}) [${timestamp}] [${levelStr}] [${moduleStr}]  ${message}`;

        if (data !== undefined) {
            if (typeof data === 'object') {
                formattedMessage += `\n${JSON.stringify(data, null, 2)}`;
            } else {
                formattedMessage += ` ${data}`;
            }
        }
        
        return formattedMessage;
    }

    private writeLog(formattedMessage: string): void {
        
        console.log(formattedMessage);
        
        
        if (this.writeToFile && this.logFilePath) {
            try {
                fs.appendFileSync(this.logFilePath, formattedMessage + '\n', 'utf8');
            } catch (error) {
                console.error('Log dosyasına yazılamadı:', error);
            }
        }
    }

    private log(level: LogLevel, message: string, data?: any): void {
        if (!this.shouldLog(level)) {
            return;
        }

        const formattedMessage = this.formatMessage(level, message, data);
        
        
        switch (level) {
            case LogLevel.ERROR:
                console.error(`\x1b[31m${formattedMessage}\x1b[0m`);
                break;
            case LogLevel.WARN:
                console.warn(`\x1b[33m${formattedMessage}\x1b[0m`);
                break;
            case LogLevel.INFO:
                console.info(`\x1b[36m${formattedMessage}\x1b[0m`);
                break;
            case LogLevel.DEBUG:
                console.debug(`\x1b[35m${formattedMessage}\x1b[0m`);
                break;
            case LogLevel.VERBOSE:
                console.log(`\x1b[37m${formattedMessage}\x1b[0m`);
                break;
            default:
                console.log(formattedMessage);
        }

        
        if (this.writeToFile && this.logFilePath) {
            try {
                fs.appendFileSync(this.logFilePath, formattedMessage + '\n', 'utf8');
            } catch (error) {
                console.error('Log dosyasına yazılamadı:', error);
            }
        }
    }

    error(message: string, data?: any): void {
        this.log(LogLevel.ERROR, message, data);
    }

    warn(message: string, data?: any): void {
        this.log(LogLevel.WARN, message, data);
    }

    info(message: string, data?: any): void {
        this.log(LogLevel.INFO, message, data);
    }

    debug(message: string, data?: any): void {
        this.log(LogLevel.DEBUG, message, data);
    }

    verbose(message: string, data?: any): void {
        this.log(LogLevel.VERBOSE, message, data);
    }

    
    setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    
    setModule(module: string): void {
        this.module = module;
    }
}


export function createLogger(options: LoggerOptions): Logger {
    return new Logger(options);
}


export const systemLogger = createLogger({
    logLevel: LogLevel.INFO,
    writeToFile: true,
    logFilePath: './logs/system.log',
    module: 'SYSTEM'
});

export const apiLogger = createLogger({
    logLevel: LogLevel.INFO,
    writeToFile: true,
    logFilePath: './logs/api.log',
    module: 'API'
});

export const proxyLogger = createLogger({
    logLevel: LogLevel.INFO,
    writeToFile: true,
    logFilePath: './logs/proxy.log',
    module: 'PROXY'
});

export const discordLogger = createLogger({
    logLevel: LogLevel.INFO,
    writeToFile: true,
    logFilePath: './logs/discord.log',
    module: 'DISCORD'
});

export { Logger };
