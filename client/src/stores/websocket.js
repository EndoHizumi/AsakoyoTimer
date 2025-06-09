import { writable } from 'svelte/store';

export const connected = writable(false);
export const systemStatus = writable(null);
export const castStatus = writable({ isActive: false });
export const scheduleStatus = writable({ isInitialized: false, activeJobs: 0 });
export const nextSchedule = writable(null);
export const devices = writable([]);
export const logs = writable([]);

class WebSocketService {
    constructor() {
        this.ws = null;
        this.reconnectTimeout = null;
        this.reconnectInterval = 5000;
        this.maxReconnectAttempts = 10;
        this.reconnectAttempts = 0;
    }

    connect() {
        try {
            // 開発環境では直接ポート指定、本番環境では相対パス
            const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const wsUrl = isDev 
                ? `ws://localhost:3001`
                : `ws://${window.location.hostname}:3001`;
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('WebSocket connected');
                connected.set(true);
                this.reconnectAttempts = 0;
                this.requestStatus();
            };

            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleMessage(data);
                } catch (error) {
                    console.error('WebSocket message parse error:', error);
                }
            };

            this.ws.onclose = () => {
                console.log('WebSocket disconnected');
                connected.set(false);
                this.scheduleReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
                connected.set(false);
            };
        } catch (error) {
            console.error('WebSocket connection error:', error);
            this.scheduleReconnect();
        }
    }

    handleMessage(data) {
        console.log('WebSocket message:', data);

        switch (data.type) {
            case 'connection_established':
                console.log('WebSocket connection established');
                break;

            case 'system_status':
                systemStatus.set(data.data);
                break;

            case 'status_response':
                if (data.data.cast) castStatus.set(data.data.cast);
                if (data.data.schedule) scheduleStatus.set(data.data.schedule);
                if (data.data.nextSchedule) nextSchedule.set(data.data.nextSchedule);
                break;

            case 'schedule_triggered':
                console.log('Schedule triggered:', data.data);
                // スケジュール実行通知の処理
                break;

            case 'live_detected':
                console.log('Live stream detected:', data.data);
                // ライブ配信検知通知の処理
                break;

            case 'cast_started':
                console.log('Cast started:', data.data);
                castStatus.update(status => ({
                    ...status,
                    isActive: true,
                    videoId: data.data.videoId,
                    deviceName: data.data.deviceName
                }));
                break;

            case 'cast_stopped':
                console.log('Cast stopped:', data.data);
                castStatus.update(status => ({
                    ...status,
                    isActive: false,
                    videoId: null,
                    deviceName: null
                }));
                break;

            case 'devices_found':
                console.log('Devices found:', data.data);
                if (data.data.devices) {
                    devices.set(data.data.devices);
                }
                break;

            case 'cast_retry_started':
                console.log('Cast retry started:', data.data);
                break;

            case 'cast_retry_attempt':
                console.log('Cast retry attempt:', data.data);
                break;

            case 'cast_retry_success':
                console.log('Cast retry success:', data.data);
                castStatus.update(status => ({
                    ...status,
                    isActive: true,
                    videoId: data.data.result?.videoId,
                    deviceName: data.data.result?.deviceName
                }));
                break;

            case 'cast_retry_failed':
                console.error('Cast retry failed:', data.data);
                break;

            case 'error':
                console.error('WebSocket error message:', data.data);
                break;

            case 'pong':
                console.log('Pong received');
                break;

            default:
                console.warn('Unknown WebSocket message type:', data.type);
                break;
        }
    }

    send(message) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('WebSocket not connected');
        }
    }

    requestStatus() {
        this.send({ type: 'get_status' });
    }

    startManualCast(videoId, deviceId) {
        this.send({
            type: 'manual_cast',
            data: { video_id: videoId, device_id: deviceId }
        });
    }

    stopCast() {
        this.send({ type: 'stop_cast' });
    }

    scanDevices() {
        this.send({ type: 'scan_devices' });
    }

    ping() {
        this.send({ type: 'ping' });
    }

    scheduleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectTimeout = setTimeout(() => {
                console.log(`Attempting to reconnect... (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
                this.reconnectAttempts++;
                this.connect();
            }, this.reconnectInterval);
        } else {
            console.error('Max reconnection attempts reached');
        }
    }

    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        if (this.ws) {
            this.ws.close();
        }
    }
}

export const wsService = new WebSocketService();