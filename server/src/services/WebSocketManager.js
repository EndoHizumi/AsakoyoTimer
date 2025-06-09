const WebSocket = require('ws');

class WebSocketManager {
    constructor(port = 3001) {
        this.port = port;
        this.wss = null;
        this.clients = new Set();
    }

    initialize() {
        this.wss = new WebSocket.Server({ port: this.port });
        
        this.wss.on('connection', (ws, req) => {
            console.log('New WebSocket client connected from:', req.socket.remoteAddress);
            this.clients.add(ws);

            // クライアントからのメッセージ処理
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleClientMessage(ws, data);
                } catch (error) {
                    console.error('WebSocket message parse error:', error);
                    this.sendToClient(ws, {
                        type: 'error',
                        data: { message: 'Invalid message format' }
                    });
                }
            });

            // クライアント切断時の処理
            ws.on('close', () => {
                console.log('WebSocket client disconnected');
                this.clients.delete(ws);
            });

            // エラー処理
            ws.on('error', (error) => {
                console.error('WebSocket client error:', error);
                this.clients.delete(ws);
            });

            // 接続確認メッセージを送信
            this.sendToClient(ws, {
                type: 'connection_established',
                data: { timestamp: new Date() }
            });
        });

        console.log(`WebSocket server started on port ${this.port}`);
    }

    handleClientMessage(ws, data) {
        console.log('Received WebSocket message:', data);

        switch (data.type) {
            case 'ping':
                this.sendToClient(ws, {
                    type: 'pong',
                    data: { timestamp: new Date() }
                });
                break;

            case 'manual_cast':
                // 手動キャスト要求
                this.emit('manual_cast_request', data.data);
                break;

            case 'stop_cast':
                // キャスト停止要求
                this.emit('stop_cast_request', data.data);
                break;

            case 'get_status':
                // 状態取得要求
                this.emit('status_request', ws);
                break;

            case 'scan_devices':
                // デバイススキャン要求
                this.emit('scan_devices_request', data.data);
                break;

            default:
                this.sendToClient(ws, {
                    type: 'error',
                    data: { message: `Unknown message type: ${data.type}` }
                });
                break;
        }
    }

    sendToClient(ws, message) {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(message));
            } catch (error) {
                console.error('WebSocket send error:', error);
            }
        }
    }

    broadcast(message) {
        const messageStr = JSON.stringify(message);
        
        this.clients.forEach(ws => {
            if (ws.readyState === WebSocket.OPEN) {
                try {
                    ws.send(messageStr);
                } catch (error) {
                    console.error('WebSocket broadcast error:', error);
                    this.clients.delete(ws);
                }
            } else {
                this.clients.delete(ws);
            }
        });
    }

    // イベントエミッター的な機能を提供
    emit(eventType, data) {
        if (this.eventHandlers && this.eventHandlers[eventType]) {
            this.eventHandlers[eventType](data);
        }
    }

    setEventHandlers(handlers) {
        this.eventHandlers = handlers;
    }

    // システム状態をブロードキャスト
    broadcastSystemStatus(status) {
        this.broadcast({
            type: 'system_status',
            data: status
        });
    }

    // スケジュール実行通知
    broadcastScheduleTriggered(scheduleData) {
        this.broadcast({
            type: 'schedule_triggered',
            data: scheduleData
        });
    }

    // ライブ配信検知通知
    broadcastLiveDetected(liveData) {
        this.broadcast({
            type: 'live_detected',
            data: liveData
        });
    }

    // キャスト開始通知
    broadcastCastStarted(castData) {
        this.broadcast({
            type: 'cast_started',
            data: castData
        });
    }

    // キャスト停止通知
    broadcastCastStopped(stopData) {
        this.broadcast({
            type: 'cast_stopped',
            data: stopData
        });
    }

    // エラー通知
    broadcastError(errorData) {
        this.broadcast({
            type: 'error',
            data: errorData
        });
    }

    // デバイススキャン結果通知
    broadcastDevicesFound(devices) {
        this.broadcast({
            type: 'devices_found',
            data: { devices, timestamp: new Date() }
        });
    }

    // 接続中のクライアント数を取得
    getConnectedClientsCount() {
        return this.clients.size;
    }

    // WebSocketサーバーを停止
    close() {
        if (this.wss) {
            this.clients.forEach(ws => {
                ws.close();
            });
            this.wss.close();
            console.log('WebSocket server closed');
        }
    }

    // ヘルスチェック用の状態取得
    getStatus() {
        return {
            isRunning: this.wss !== null,
            port: this.port,
            connectedClients: this.clients.size,
            timestamp: new Date()
        };
    }
}

module.exports = WebSocketManager;