const logger = require('./logger');

class ErrorHandler {
    static handleDatabaseError(error, context) {
        logger.error('Database', `Database error in ${context}`, error);
        
        if (error.code === 'SQLITE_CORRUPT') {
            return {
                status: 500,
                message: 'データベースが破損しています。管理者にお問い合わせください。'
            };
        } else if (error.code === 'SQLITE_READONLY') {
            return {
                status: 500,
                message: 'データベースへの書き込み権限がありません。'
            };
        } else if (error.code === 'SQLITE_BUSY') {
            return {
                status: 503,
                message: 'データベースがビジー状態です。しばらく待ってから再試行してください。'
            };
        }
        
        return {
            status: 500,
            message: 'データベースエラーが発生しました。'
        };
    }

    static handleYouTubeAPIError(error, context) {
        logger.error('YouTube', `YouTube API error in ${context}`, error);
        
        if (error.code === 403) {
            return {
                status: 403,
                message: 'YouTube API の使用量制限に達しました。しばらく待ってから再試行してください。'
            };
        } else if (error.code === 400) {
            return {
                status: 400,
                message: 'YouTube API への要求が正しくありません。'
            };
        } else if (error.code === 401) {
            return {
                status: 401,
                message: 'YouTube API キーが無効です。設定を確認してください。'
            };
        }
        
        return {
            status: 500,
            message: 'YouTube API でエラーが発生しました。'
        };
    }

    static handleChromecastError(error, context) {
        logger.error('Chromecast', `Chromecast error in ${context}`, error);
        
        if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
            return {
                status: 408,
                message: 'ChromeCast デバイスへの接続がタイムアウトしました。デバイスの電源とネットワーク接続を確認してください。'
            };
        } else if (error.message.includes('ECONNREFUSED') || error.message.includes('connection refused')) {
            return {
                status: 503,
                message: 'ChromeCast デバイスに接続できません。デバイスの電源とネットワーク接続を確認してください。'
            };
        } else if (error.message.includes('ENOTFOUND') || error.message.includes('not found')) {
            return {
                status: 404,
                message: 'ChromeCast デバイスが見つかりません。IPアドレスを確認してください。'
            };
        }
        
        return {
            status: 500,
            message: 'ChromeCast でエラーが発生しました。'
        };
    }

    static handleScheduleError(error, context) {
        logger.error('Schedule', `Schedule error in ${context}`, error);
        
        if (error.message.includes('cron')) {
            return {
                status: 400,
                message: 'スケジュール設定が正しくありません。時刻と曜日を確認してください。'
            };
        }
        
        return {
            status: 500,
            message: 'スケジュール処理でエラーが発生しました。'
        };
    }

    static handleWebSocketError(error, context) {
        logger.error('WebSocket', `WebSocket error in ${context}`, error);
        
        return {
            status: 500,
            message: 'WebSocket 接続でエラーが発生しました。'
        };
    }

    static handleGenericError(error, context = 'Unknown') {
        logger.error('System', `Generic error in ${context}`, error);
        
        if (error.code === 'EACCES') {
            return {
                status: 403,
                message: 'アクセス権限がありません。'
            };
        } else if (error.code === 'ENOENT') {
            return {
                status: 404,
                message: 'ファイルまたはディレクトリが見つかりません。'
            };
        } else if (error.code === 'EMFILE' || error.code === 'ENFILE') {
            return {
                status: 503,
                message: 'システムリソースが不足しています。しばらく待ってから再試行してください。'
            };
        }
        
        return {
            status: 500,
            message: process.env.NODE_ENV === 'production' 
                ? '内部サーバーエラーが発生しました。'
                : error.message
        };
    }

    static createExpressErrorHandler() {
        return (error, req, res, next) => {
            let errorInfo;
            
            // エラーの種類に応じて適切なハンドラーを選択
            if (error.message.includes('sqlite') || error.code?.startsWith('SQLITE_')) {
                errorInfo = this.handleDatabaseError(error, `${req.method} ${req.path}`);
            } else if (error.message.includes('YouTube') || error.message.includes('youtube')) {
                errorInfo = this.handleYouTubeAPIError(error, `${req.method} ${req.path}`);
            } else if (error.message.includes('cast') || error.message.includes('Cast')) {
                errorInfo = this.handleChromecastError(error, `${req.method} ${req.path}`);
            } else if (error.message.includes('schedule') || error.message.includes('cron')) {
                errorInfo = this.handleScheduleError(error, `${req.method} ${req.path}`);
            } else {
                errorInfo = this.handleGenericError(error, `${req.method} ${req.path}`);
            }
            
            res.status(errorInfo.status).json({
                error: errorInfo.message,
                timestamp: new Date().toISOString(),
                path: req.path
            });
        };
    }

    static wrapAsyncHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    static logAndBroadcastError(wsManager, error, context) {
        const errorInfo = this.handleGenericError(error, context);
        
        if (wsManager) {
            wsManager.broadcastError({
                message: errorInfo.message,
                context: context,
                timestamp: new Date(),
                level: 'error'
            });
        }
        
        return errorInfo;
    }
}

module.exports = ErrorHandler;