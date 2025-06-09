const Client = require('castv2-client').Client;
const DefaultMediaReceiver = require('castv2-client').DefaultMediaReceiver;
const mdns = require('multicast-dns')();

class ChromeCastService {
    constructor(database, wsManager) {
        this.database = database;
        this.wsManager = wsManager;
        this.devices = new Map();
        this.currentCast = null;
        this.mdns = mdns;
    }

    async discoverDevices() {
        return new Promise((resolve, reject) => {
            const devices = [];
            const foundDevices = new Set();
            
            const timeout = setTimeout(() => {
                resolve(devices);
            }, 5000);

            try {
                // ChromeCast サービスを検索
                this.mdns.query({
                    questions: [{
                        name: '_googlecast._tcp.local',
                        type: 'PTR'
                    }]
                });

                this.mdns.on('response', (response) => {
                    response.answers.forEach((answer) => {
                        if (answer.type === 'PTR' && answer.name === '_googlecast._tcp.local') {
                            // SRVレコードを検索
                            this.mdns.query({
                                questions: [{
                                    name: answer.data,
                                    type: 'SRV'
                                }]
                            });
                        }
                        
                        if (answer.type === 'SRV') {
                            // Aレコードを検索
                            this.mdns.query({
                                questions: [{
                                    name: answer.data.target,
                                    type: 'A'
                                }]
                            });
                        }
                        
                        if (answer.type === 'A') {
                            const deviceKey = answer.data;
                            if (foundDevices.has(deviceKey)) {
                                return;
                            }
                            foundDevices.add(deviceKey);

                            // SRVレコードから対応するサービス情報を探す
                            const srvRecord = response.answers.find(a => 
                                a.type === 'SRV' && a.data.target === answer.name
                            );
                            
                            if (srvRecord) {
                                const device = {
                                    name: answer.name.replace('.local', ''),
                                    ip_address: answer.data,
                                    port: srvRecord.data.port || 8009,
                                    host: answer.name
                                };
                                devices.push(device);
                                this.devices.set(device.name, device);
                            }
                        }
                    });
                });

            } catch (error) {
                clearTimeout(timeout);
                reject(error);
            }
        });
    }

    async scanAndSaveDevices() {
        try {
            const discoveredDevices = await this.discoverDevices();
            
            for (const device of discoveredDevices) {
                const existingDevice = await this.database.get(
                    'SELECT * FROM chromecast_devices WHERE ip_address = ?',
                    [device.ip_address]
                );

                if (existingDevice) {
                    await this.database.updateDeviceLastSeen(existingDevice.id);
                } else {
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

    async startCast(videoId, deviceId, scheduleId = null) {
        try {
            const device = await this.getDevice(deviceId);
            if (!device) {
                throw new Error(`Device with ID ${deviceId} not found`);
            }

            if (this.currentCast) {
                await this.stopCast();
            }

            const client = new Client();
            
            await new Promise((resolve, reject) => {
                client.connect(device.ip_address, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;
            
            const media = {
                contentId: youtubeUrl,
                contentType: 'video/mp4',
                streamType: 'LIVE',
                metadata: {
                    type: 0,
                    metadataType: 0,
                    title: 'YouTube Live Stream'
                }
            };

            return new Promise((resolve, reject) => {
                client.launch(DefaultMediaReceiver, (err, player) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    player.load(media, { autoplay: true }, async (err, status) => {
                        if (err) {
                            reject(err);
                            return;
                        }

                        this.currentCast = {
                            videoId,
                            device: device.name,
                            deviceId: device.id,
                            player,
                            client,
                            scheduleId
                        };

                        const logResult = await this.database.createCastLog({
                            schedule_id: scheduleId,
                            video_id: videoId,
                            video_title: media.metadata.title,
                            device_id: device.id,
                            status: 'started'
                        });

                        this.currentCast.logId = logResult.lastID;

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

                        await this.database.updateDeviceLastSeen(device.id);

                        resolve({
                            success: true,
                            videoId,
                            deviceName: device.name,
                            status
                        });
                    });

                    player.on('status', (status) => {
                        console.log('Player status:', status);
                        if (this.wsManager) {
                            this.wsManager.broadcast({
                                type: 'player_status',
                                data: { status, timestamp: new Date() }
                            });
                        }
                    });
                });
            });
        } catch (error) {
            console.error('Cast start error:', error);
            
            if (deviceId) {
                await this.database.createCastLog({
                    schedule_id: scheduleId,
                    video_id: videoId,
                    device_id: deviceId,
                    status: 'error',
                    error_message: error.message
                });
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

            if (this.currentCast.logId) {
                await this.database.updateCastLogEnd(
                    this.currentCast.logId,
                    'stopped'
                );
            }

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
            scheduleId: this.currentCast.scheduleId
        };
    }

    async testDeviceConnection(deviceId) {
        try {
            const device = await this.getDevice(deviceId);
            if (!device) {
                throw new Error(`Device with ID ${deviceId} not found`);
            }

            const client = new Client();
            
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    client.close();
                    reject(new Error('Connection timeout'));
                }, 10000);

                client.connect(device.ip_address, (err) => {
                    clearTimeout(timeout);
                    if (err) {
                        reject(err);
                    } else {
                        client.close();
                        resolve(true);
                    }
                });
            });
        } catch (error) {
            console.error('Device connection test error:', error);
            return false;
        }
    }

    cleanup() {
        if (this.currentCast) {
            this.stopCast('cleanup');
        }
        
        if (this.mdns) {
            this.mdns.destroy();
        }
    }
}

module.exports = ChromeCastService;