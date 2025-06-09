const express = require('express');
const router = express.Router();

function createApiRoutes(database, youtubeService, chromecastService, scheduleService, wsManager) {
    
    // スケジュール管理API
    router.get('/schedules', async (req, res) => {
        try {
            const schedules = await database.all('SELECT * FROM schedules ORDER BY day_of_week, start_time');
            res.json(schedules);
        } catch (error) {
            console.error('Get schedules error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/schedules', async (req, res) => {
        try {
            const { channel_id, channel_name, day_of_week, start_time, duration_minutes, device_id } = req.body;
            
            // 入力値検証
            if (!channel_id || !channel_name || day_of_week === undefined || !start_time) {
                return res.status(400).json({ error: 'Required fields missing' });
            }

            if (day_of_week < 0 || day_of_week > 6) {
                return res.status(400).json({ error: 'Invalid day_of_week (0-6)' });
            }

            const schedule = await scheduleService.addSchedule({
                channel_id,
                channel_name,
                day_of_week: parseInt(day_of_week),
                start_time,
                duration_minutes: duration_minutes || 120,
                device_id: device_id || null
            });

            // お気に入りチャンネルの最終使用時刻を更新
            await database.updateFavoriteChannelLastUsed(channel_id);

            res.status(201).json(schedule);
        } catch (error) {
            console.error('Create schedule error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/schedules/:id', async (req, res) => {
        try {
            const schedule = await database.get('SELECT * FROM schedules WHERE id = ?', [req.params.id]);
            if (!schedule) {
                return res.status(404).json({ error: 'Schedule not found' });
            }
            res.json(schedule);
        } catch (error) {
            console.error('Get schedule error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/schedules/:id', async (req, res) => {
        try {
            const scheduleId = parseInt(req.params.id);
            const updateData = req.body;

            const updatedSchedule = await scheduleService.updateSchedule(scheduleId, updateData);
            if (!updatedSchedule) {
                return res.status(404).json({ error: 'Schedule not found' });
            }

            res.json(updatedSchedule);
        } catch (error) {
            console.error('Update schedule error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/schedules/:id', async (req, res) => {
        try {
            const scheduleId = parseInt(req.params.id);
            await scheduleService.deleteSchedule(scheduleId);
            res.json({ success: true });
        } catch (error) {
            console.error('Delete schedule error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // デバイス管理API
    router.get('/devices', async (req, res) => {
        try {
            const devices = await database.getDevices();
            res.json(devices);
        } catch (error) {
            console.error('Get devices error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/devices/scan', async (req, res) => {
        try {
            const devices = await chromecastService.scanAndSaveDevices();
            
            // WebSocketでクライアントに通知
            if (wsManager) {
                wsManager.broadcastDevicesFound(devices);
            }

            res.json({ devices, count: devices.length });
        } catch (error) {
            console.error('Device scan error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.put('/devices/:id', async (req, res) => {
        try {
            const deviceId = parseInt(req.params.id);
            const { name, is_default, is_active } = req.body;

            await database.run(
                'UPDATE chromecast_devices SET name = ?, is_default = ?, is_active = ? WHERE id = ?',
                [name, is_default, is_active, deviceId]
            );

            const updatedDevice = await database.get(
                'SELECT * FROM chromecast_devices WHERE id = ?',
                [deviceId]
            );

            res.json(updatedDevice);
        } catch (error) {
            console.error('Update device error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/devices/:id/test', async (req, res) => {
        try {
            const deviceId = parseInt(req.params.id);
            const isConnectable = await chromecastService.testDeviceConnection(deviceId);
            
            res.json({ 
                deviceId, 
                isConnectable, 
                timestamp: new Date() 
            });
        } catch (error) {
            console.error('Device test error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // キャスト制御API
    router.post('/cast/start', async (req, res) => {
        try {
            const { video_id, device_id } = req.body;

            if (!video_id || !device_id) {
                return res.status(400).json({ error: 'video_id and device_id are required' });
            }

            const result = await chromecastService.startCast(video_id, device_id);
            res.json(result);
        } catch (error) {
            console.error('Manual cast start error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/cast/stop', async (req, res) => {
        try {
            const result = await chromecastService.stopCast('manual');
            res.json(result);
        } catch (error) {
            console.error('Cast stop error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/cast/status', async (req, res) => {
        try {
            const status = chromecastService.getCastStatus();
            res.json(status);
        } catch (error) {
            console.error('Get cast status error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // YouTube API
    router.get('/youtube/search', async (req, res) => {
        try {
            const { q, type = 'channel', maxResults = 10 } = req.query;

            if (!q) {
                return res.status(400).json({ error: 'Query parameter "q" is required' });
            }

            if (type === 'channel') {
                const channels = await youtubeService.searchChannels(q, parseInt(maxResults));
                res.json(channels);
            } else {
                res.status(400).json({ error: 'Only channel search is supported' });
            }
        } catch (error) {
            console.error('YouTube search error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/youtube/channel/:id', async (req, res) => {
        try {
            const channelInfo = await youtubeService.getChannelInfo(req.params.id);
            if (!channelInfo) {
                return res.status(404).json({ error: 'Channel not found' });
            }
            res.json(channelInfo);
        } catch (error) {
            console.error('Get channel info error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/youtube/channel/:id/live', async (req, res) => {
        try {
            const liveStream = await youtubeService.checkChannelLive(req.params.id);
            res.json({ 
                isLive: !!liveStream, 
                liveStream: liveStream || null 
            });
        } catch (error) {
            console.error('Check channel live error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // ログ管理API
    router.get('/logs', async (req, res) => {
        try {
            const { limit = 50 } = req.query;
            const logs = await database.getCastLogs(parseInt(limit));
            res.json(logs);
        } catch (error) {
            console.error('Get logs error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // システム状態API
    router.get('/status', async (req, res) => {
        try {
            const scheduleStatus = scheduleService.getScheduleStatus();
            const castStatus = chromecastService.getCastStatus();
            const wsStatus = wsManager.getStatus();
            const nextSchedule = await scheduleService.getNextSchedule();

            res.json({
                timestamp: new Date(),
                schedule: scheduleStatus,
                cast: castStatus,
                websocket: wsStatus,
                nextSchedule: nextSchedule,
                youtube: {
                    apiKeyConfigured: youtubeService.validateApiKey(),
                    apiKeyExists: !!process.env.YOUTUBE_API_KEY,
                    apiKeyLength: process.env.YOUTUBE_API_KEY ? process.env.YOUTUBE_API_KEY.length : 0
                }
            });
        } catch (error) {
            console.error('Get system status error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // スケジュール手動リフレッシュ
    router.post('/schedules/refresh', async (req, res) => {
        try {
            await scheduleService.refreshSchedules();
            res.json({ success: true, message: 'Schedules refreshed' });
        } catch (error) {
            console.error('Refresh schedules error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    // お気に入りチャンネル管理API
    router.get('/favorites', async (req, res) => {
        try {
            const favorites = await database.getFavoriteChannels();
            res.json(favorites);
        } catch (error) {
            console.error('Get favorites error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/favorites', async (req, res) => {
        try {
            const { channel_id, channel_name, thumbnail, description, subscriber_count } = req.body;
            
            if (!channel_id || !channel_name) {
                return res.status(400).json({ error: 'channel_id and channel_name are required' });
            }

            await database.addFavoriteChannel({
                channel_id,
                channel_name,
                thumbnail,
                description,
                subscriber_count
            });

            res.json({ success: true, message: 'Channel added to favorites' });
        } catch (error) {
            console.error('Add favorite error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.delete('/favorites/:channelId', async (req, res) => {
        try {
            const channelId = req.params.channelId;
            await database.removeFavoriteChannel(channelId);
            res.json({ success: true, message: 'Channel removed from favorites' });
        } catch (error) {
            console.error('Remove favorite error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.get('/recent-channels', async (req, res) => {
        try {
            const { limit = 10 } = req.query;
            const recentChannels = await database.getRecentlyUsedChannels(parseInt(limit));
            res.json(recentChannels);
        } catch (error) {
            console.error('Get recent channels error:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
}

module.exports = createApiRoutes;