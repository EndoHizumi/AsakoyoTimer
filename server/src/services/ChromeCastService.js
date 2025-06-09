const Client = require('castv2-client').Client;
const DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;
const Youtube = require('youtube-castv2-client').Youtube;
const bonjour = require('bonjour')();
const NetworkScanner = require('../utils/networkScanner');

class ChromeCastService {
    constructor(database, wsManager) {
        this.database = database;
        this.wsManager = wsManager;
        this.devices = new Map();
        this.currentCast = null;
        this.browser = null;
        this.lastCastAttempt = null;
    }

    async discoverDevices() {
        return new Promise((resolve, reject) => {
            const devices = [];
            const foundDevices = new Set(); // 重複排除用
            
            const timeout = setTimeout(() => {
                if (this.browser) {
                    this.browser.stop();
                }
                resolve(devices);
            }, 5000); // 5秒でタイムアウト

            try {
                this.browser = bonjour.find({ type: 'googlecast' });
                
                this.browser.on('up', (service) => {
                    // 重複チェック
                    const deviceKey = `${service.referer.address}:${service.port}`;
                    if (foundDevices.has(deviceKey)) {
                        return;
                    }
                    foundDevices.add(deviceKey);

                    const device = {
                        name: service.name || service.fqdn,
                        ip_address: service.referer.address,
                        port: service.port || 8009,
                        host: service.host
                    };
                    devices.push(device);
                    this.devices.set(device.name, device);
                });

                this.browser.on('error', (error) => {
                    console.error('Bonjour browser error:', error);
                    clearTimeout(timeout);
                    reject(error);
                });

                // ブラウザーを開始
                this.browser.start();
            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }

    async scanAndSaveDevices() {
        try {
            let discoveredDevices = [];
            
            // 最初にBonjour mDNSで検索
            try {
                discoveredDevices = await this.discoverDevices();
                console.log(`Bonjour found ${discoveredDevices.length} devices`);
            } catch (error) {
                console.warn('Bonjour scan failed, falling back to network scan:', error.message);
            }
            
            // mDNSで見つからない場合はネットワークスキャンを実行
            if (discoveredDevices.length === 0) {
                try {
                    discoveredDevices = await NetworkScanner.scanChromecastDevices();
                    console.log(`Network scan found ${discoveredDevices.length} devices`);
                } catch (error) {
                    console.error('Network scan also failed:', error);
                }
            }
            
            for (const device of discoveredDevices) {
                // データベースに既存のデバイスがあるかチェック
                const existingDevice = await this.database.get(
                    'SELECT * FROM chromecast_devices WHERE ip_address = ?',
                    [device.ip_address]
                );

                if (existingDevice) {
                    // 既存デバイスの最終確認時刻を更新
                    await this.database.updateDeviceLastSeen(existingDevice.id);
                } else {
                    // 新しいデバイスを保存
                    await this.database.createDevice(device);
                }
            }

            return discoveredDevices;
        } catch (error) {
            console.error('Device scan error:', error);
            throw error;
        }
    }

    async getDevice(deviceId) {
        return await this.database.get(
            'SELECT * FROM chromecast_devices WHERE id = ? AND is_active = 1',
            [deviceId]
        );
    }

    async getTargetDevice(deviceId) {
        let device;
        
        // 1. 指定されたデバイスを検索
        if (deviceId) {
            device = await this.getDevice(deviceId);
            if (device) {
                console.log(`Using specified device: ${device.name} (ID: ${device.id})`);
                return device;
            }
            console.warn(`Specified device ID ${deviceId} not found or inactive, falling back...`);
        }
        
        // 2. デフォルトデバイスを検索
        device = await this.database.get(
            'SELECT * FROM chromecast_devices WHERE is_default = 1 AND is_active = 1'
        );
        if (device) {
            console.log(`Using default device: ${device.name} (ID: ${device.id})`);
            return device;
        }
        
        // 3. 最初のアクティブデバイスを選択
        device = await this.database.get(
            'SELECT * FROM chromecast_devices WHERE is_active = 1 ORDER BY last_seen DESC LIMIT 1'
        );
        if (device) {
            console.log(`Using first available device: ${device.name} (ID: ${device.id})`);
            return device;
        }
        
        throw new Error('No available ChromeCast device found. Please scan for devices or ensure at least one device is active.');
    }

    async startCast(videoId, deviceId, scheduleId = null) {
        try {
            // キャスト試行情報を記録
            this.lastCastAttempt = { videoId, deviceId, scheduleId };
            
            const device = await this.getTargetDevice(deviceId);

            // 既存のキャストがある場合は停止
            if (this.currentCast) {
                await this.stopCast();
            }

            const client = new Client();
            
            // Resolve hostname to IP if needed
            let targetIP = device.ip_address;
            if (device.ip_address.endsWith('.local')) {
                console.log(`Resolving .local hostname: ${device.ip_address}`);
                try {
                    const dns = require('dns').promises;
                    const result = await dns.lookup(device.ip_address);
                    targetIP = result.address;
                    console.log(`Resolved ${device.ip_address} to ${targetIP}`);
                } catch (dnsError) {
                    console.error(`Failed to resolve ${device.ip_address}:`, dnsError.message);
                    throw new Error(`Cannot resolve device hostname: ${device.ip_address}`);
                }
            }
            
            await new Promise((resolve, reject) => {
                const connectionTimeout = setTimeout(() => {
                    reject(new Error(`Connection timeout to ${targetIP}`));
                }, 10000);
                
                client.connect(targetIP, (err) => {
                    clearTimeout(connectionTimeout);
                    if (err) {
                        console.error(`Connection failed to ${targetIP}:`, err);
                        reject(err);
                    } else {
                        console.log(`Connected successfully to ${targetIP}`);
                        resolve();
                    }
                });
            });

            console.log('ChromeCast接続成功');

            return new Promise((resolve, reject) => {
                client.launch(Youtube, (err, player) => {
                    if (err) {
                        console.error('YouTube app launch failed:', err);
                        reject(err);
                        return;
                    }

                    console.log('YouTube app launched successfully');

                    // プレイヤーイベントのリスニングを先に設定
                    player.on('status', (status) => {
                        console.log('Player status:', JSON.stringify(status, null, 2));
                        if (this.wsManager) {
                            this.wsManager.broadcast({
                                type: 'player_status',
                                data: { status, timestamp: new Date() }
                            });
                        }
                    });

                    // エラーイベントのリスニング
                    player.on('error', (error) => {
                        console.error('Player error:', error);
                    });

                    // YouTube動画IDの形式チェック
                    if (!videoId || typeof videoId !== 'string' || videoId.length < 10) {
                        reject(new Error(`Invalid YouTube video ID: ${videoId}`));
                        return;
                    }

                    console.log(`Loading YouTube video ID: ${videoId}`);

                    // YouTube動画IDを直接指定してcast
                    player.load(videoId, async (err, status) => {
                        if (err) {
                            console.error('Video load failed:', err);
                            reject(err);
                            return;
                        }

                        console.log(`YouTube配信開始成功: ${videoId}`);
                        console.log('Load status:', JSON.stringify(status, null, 2));

                        this.currentCast = {
                            videoId,
                            device: device.name,
                            deviceId: device.id,
                            player,
                            client,
                            scheduleId
                        };

                        // ログに記録
                        const logResult = await this.database.createCastLog({
                            schedule_id: scheduleId,
                            video_id: videoId,
                            video_title: 'YouTube Live Stream',
                            device_id: device.id,
                            status: 'started'
                        });

                        this.currentCast.logId = logResult.lastID;

                        // WebSocketでクライアントに通知
                        if (this.wsManager) {
                            this.wsManager.broadcast({
                                type: 'cast_started',
                                data: {
                                    videoId,
                                    deviceName: device.name,
                                    timestamp: new Date(),
                                    status
                                }
                            });
                        }

                        // デバイスの最終確認時刻を更新
                        await this.database.updateDeviceLastSeen(device.id);

                        // 動画が実際に再生されているかを確認するための追加ログ
                        setTimeout(() => {
                            if (this.currentCast && this.currentCast.player) {
                                this.currentCast.player.getStatus((err, status) => {
                                    if (err) {
                                        console.error('Failed to get player status:', err);
                                    } else {
                                        console.log('Current player status after 3s:', JSON.stringify(status, null, 2));
                                    }
                                });
                            }
                        }, 3000);

                        resolve({
                            success: true,
                            videoId,
                            deviceName: device.name,
                            status
                        });
                    });
                });
            });
        } catch (error) {
            console.error('YouTube Cast失敗:', error);
            
            // エラーログを記録
            try {
                if (deviceId) {
                    await this.database.createCastLog({
                        schedule_id: scheduleId,
                        video_id: videoId,
                        device_id: deviceId,
                        status: 'error',
                        error_message: error.message
                    });
                }
            } catch (logError) {
                console.error('Failed to log cast error:', logError);
            }

            // WebSocketでエラーを通知
            if (this.wsManager) {
                try {
                    this.wsManager.broadcast({
                        type: 'cast_error',
                        data: {
                            error: error.message,
                            videoId,
                            deviceId,
                            timestamp: new Date()
                        }
                    });
                } catch (wsError) {
                    console.error('Failed to broadcast error:', wsError);
                }
            }

            throw error;
        }
    }

    async stopCast(reason = 'manual') {
        if (!this.currentCast) {
            return { success: false, message: 'No active cast to stop' };
        }

        try {
            if (this.currentCast.player) {
                this.currentCast.player.stop();
            }
            
            if (this.currentCast.client) {
                this.currentCast.client.close();
            }

            // ログを更新
            if (this.currentCast.logId) {
                await this.database.updateCastLogEnd(
                    this.currentCast.logId,
                    'stopped'
                );
            }

            // WebSocketでクライアントに通知
            if (this.wsManager) {
                this.wsManager.broadcast({
                    type: 'cast_stopped',
                    data: {
                        reason,
                        timestamp: new Date(),
                        deviceName: this.currentCast.device
                    }
                });
            }

            const stoppedCast = this.currentCast;
            this.currentCast = null;

            return {
                success: true,
                message: `Cast stopped on ${stoppedCast.device}`,
                reason
            };
        } catch (error) {
            console.error('Cast stop error:', error);
            
            // エラーでも現在のキャストをクリア
            if (this.currentCast && this.currentCast.logId) {
                await this.database.updateCastLogEnd(
                    this.currentCast.logId,
                    'error',
                    error.message
                );
            }
            
            this.currentCast = null;
            throw error;
        }
    }

    getCastStatus() {
        if (!this.currentCast) {
            return {
                isActive: false,
                message: 'No active cast'
            };
        }

        return {
            isActive: true,
            videoId: this.currentCast.videoId,
            deviceName: this.currentCast.device,
            deviceId: this.currentCast.deviceId,
            scheduleId: this.currentCast.scheduleId,
            lastCastAttempt: this.lastCastAttempt
        };
    }

    async retryCast(maxRetries = 3, retryDelay = 5000) {
        if (!this.lastCastAttempt) {
            throw new Error('No previous cast attempt found. Cannot retry without initial cast parameters.');
        }

        const { videoId, deviceId, scheduleId } = this.lastCastAttempt;
        
        // WebSocketでリトライ開始を通知
        if (this.wsManager) {
            this.wsManager.broadcast({
                type: 'cast_retry_started',
                data: {
                    videoId,
                    deviceId,
                    maxRetries,
                    timestamp: new Date()
                }
            });
        }

        let lastError;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`キャストリトライ試行 ${attempt}/${maxRetries}: ${videoId}`);
                
                // WebSocketでリトライ試行を通知
                if (this.wsManager) {
                    this.wsManager.broadcast({
                        type: 'cast_retry_attempt',
                        data: {
                            attempt,
                            maxRetries,
                            videoId,
                            timestamp: new Date()
                        }
                    });
                }

                const result = await this.startCast(videoId, deviceId, scheduleId);
                
                // 成功時の通知
                if (this.wsManager) {
                    this.wsManager.broadcast({
                        type: 'cast_retry_success',
                        data: {
                            attempt,
                            result,
                            timestamp: new Date()
                        }
                    });
                }

                console.log(`キャストリトライ成功: ${attempt}回目の試行で成功`);
                return result;

            } catch (error) {
                lastError = error;
                console.error(`キャストリトライ試行 ${attempt} 失敗:`, error.message);

                // 最後の試行でなければ待機
                if (attempt < maxRetries) {
                    console.log(`${retryDelay}ms待機後に再試行...`);
                    await new Promise(resolve => setTimeout(resolve, retryDelay));
                }
            }
        }

        // すべての試行が失敗した場合
        const finalError = new Error(`キャストリトライが${maxRetries}回すべて失敗しました。最後のエラー: ${lastError.message}`);
        
        // WebSocketで失敗を通知
        if (this.wsManager) {
            this.wsManager.broadcast({
                type: 'cast_retry_failed',
                data: {
                    maxRetries,
                    error: finalError.message,
                    lastError: lastError.message,
                    timestamp: new Date()
                }
            });
        }

        throw finalError;
    }

    async testDeviceConnection(deviceId) {
        try {
            const device = await this.getDevice(deviceId);
            if (!device) {
                throw new Error(`Device with ID ${deviceId} not found`);
            }

            console.log(`Testing connection to device: ${device.name} (${device.ip_address}:${device.port})`);

            const client = new Client();
            
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    console.log('Connection test timeout');
                    client.close();
                    reject(new Error('Connection timeout'));
                }, 10000);

                client.connect(device.ip_address, (err) => {
                    clearTimeout(timeout);
                    if (err) {
                        console.error('Connection test failed:', err);
                        reject(err);
                    } else {
                        console.log('Connection test successful');
                        
                        // YouTube アプリのテスト起動
                        client.launch(Youtube, (err, player) => {
                            if (err) {
                                console.error('YouTube app launch test failed:', err);
                                client.close();
                                reject(new Error(`YouTube app launch failed: ${err.message}`));
                                return;
                            }
                            
                            console.log('YouTube app launch test successful');
                            client.close();
                            resolve(true);
                        });
                    }
                });

                client.on('error', (err) => {
                    clearTimeout(timeout);
                    console.error('Client error during test:', err);
                    reject(err);
                });
            });
        } catch (error) {
            console.error('Device connection test error:', error);
            return false;
        }
    }

    cleanup() {
        if (this.browser) {
            this.browser.stop();
        }
        
        if (this.currentCast) {
            this.stopCast('cleanup');
        }
        
        // Bonjourサービスを破棄
        if (bonjour) {
            bonjour.destroy();
        }
    }
}

module.exports = ChromeCastService;