const fs = require('fs');
const path = require('path');

class Logger {
    constructor(logLevel = 'info') {
        this.logLevel = logLevel;
        this.logLevels = {
            'debug': 0,
            'info': 1,
            'warn': 2,
            'error': 3
        };
        
        this.logDir = path.join(__dirname, '../../logs');
        this.ensureLogDir();
    }

    ensureLogDir() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    shouldLog(level) {
        return this.logLevels[level] >= this.logLevels[this.logLevel];
    }

    formatMessage(level, component, message, extra = null) {
        const timestamp = new Date().toISOString();
        const upperLevel = level.toUpperCase();
        const upperComponent = component.toUpperCase();
        
        let logMessage = `[${timestamp}] [${upperLevel}] [${upperComponent}] ${message}`;
        
        if (extra) {
            if (extra instanceof Error) {
                logMessage += `\n${extra.stack}`;
            } else if (typeof extra === 'object') {
                logMessage += `\n${JSON.stringify(extra, null, 2)}`;
            } else {
                logMessage += ` ${extra}`;
            }
        }
        
        return logMessage;
    }

    writeToFile(level, message) {
        const date = new Date().toISOString().split('T')[0];
        const filename = `autocast-${date}.log`;
        const filepath = path.join(this.logDir, filename);
        
        try {
            fs.appendFileSync(filepath, message + '\n');
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    log(level, component, message, extra = null) {
        if (!this.shouldLog(level)) {
            return;
        }

        const formattedMessage = this.formatMessage(level, component, message, extra);
        
        // コンソール出力
        if (level === 'error') {
            console.error(formattedMessage);
        } else if (level === 'warn') {
            console.warn(formattedMessage);
        } else {
            console.log(formattedMessage);
        }
        
        // ファイル出力
        this.writeToFile(level, formattedMessage);
    }

    debug(component, message, extra = null) {
        this.log('debug', component, message, extra);
    }

    info(component, message, extra = null) {
        this.log('info', component, message, extra);
    }

    warn(component, message, extra = null) {
        this.log('warn', component, message, extra);
    }

    error(component, message, extra = null) {
        this.log('error', component, message, extra);
    }

    // システム起動ログ
    startup(component, message, extra = null) {
        this.info(component, `🚀 ${message}`, extra);
    }

    // システム停止ログ
    shutdown(component, message, extra = null) {
        this.info(component, `🛑 ${message}`, extra);
    }

    // スケジュール実行ログ
    schedule(component, message, extra = null) {
        this.info(component, `⏰ ${message}`, extra);
    }

    // Cast操作ログ
    cast(component, message, extra = null) {
        this.info(component, `📺 ${message}`, extra);
    }

    // YouTube API ログ
    youtube(component, message, extra = null) {
        this.info(component, `🔴 ${message}`, extra);
    }

    // WebSocket ログ
    websocket(component, message, extra = null) {
        this.info(component, `🔌 ${message}`, extra);
    }

    // API アクセスログ
    api(component, message, extra = null) {
        this.info(component, `🌐 ${message}`, extra);
    }
}

// シングルトンインスタンス
const logger = new Logger(process.env.LOG_LEVEL || 'info');

module.exports = logger;