const cron = require('node-cron');

class ScheduleService {
    constructor(database, youtubeService, chromecastService, wsManager) {
        this.database = database;
        this.youtubeService = youtubeService;
        this.chromecastService = chromecastService;
        this.wsManager = wsManager;
        this.cronJobs = new Map();
        this.isInitialized = false;
    }

    async initialize() {
        if (this.isInitialized) return;

        try {
            const schedules = await this.database.getActiveSchedules();
            console.log(`Initializing ${schedules.length} schedules`);
            
            for (const schedule of schedules) {
                this.registerCronJob(schedule);
            }
            
            this.isInitialized = true;
            console.log('Schedule service initialized');
        } catch (error) {
            console.error('Schedule service initialization error:', error);
            throw error;
        }
    }

    registerCronJob(schedule) {
        const cronTime = this.convertToCronTime(schedule.day_of_week, schedule.start_time);
        
        if (!cron.validate(cronTime)) {
            console.error(`Invalid cron expression for schedule ${schedule.id}: ${cronTime}`);
            return;
        }

        // 既存のジョブがある場合は停止
        if (this.cronJobs.has(schedule.id)) {
            this.cronJobs.get(schedule.id).stop();
        }

        const job = cron.schedule(cronTime, () => {
            this.executeSchedule(schedule);
        }, {
            scheduled: true,
            timezone: 'Asia/Tokyo'
        });

        this.cronJobs.set(schedule.id, job);
        
        console.log(`Registered cron job for schedule ${schedule.id}: ${cronTime}`);
    }

    convertToCronTime(dayOfWeek, timeString) {
        // timeString format: "09:00"
        const [hour, minute] = timeString.split(':').map(Number);
        
        // cron format: minute hour day month day-of-week
        // day-of-week: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        return `${minute} ${hour} * * ${dayOfWeek}`;
    }

    async executeSchedule(schedule) {
        console.log(`Executing schedule ${schedule.id} for ${schedule.channel_name}`);
        
        try {
            // WebSocketでクライアントに通知
            if (this.wsManager) {
                this.wsManager.broadcast({
                    type: 'schedule_triggered',
                    data: {
                        scheduleId: schedule.id,
                        channelName: schedule.channel_name,
                        startTime: schedule.start_time,
                        timestamp: new Date()
                    }
                });
            }

            // YouTube Live配信をチェック
            const liveStream = await this.youtubeService.checkChannelLive(schedule.channel_id);
            
            if (liveStream) {
                console.log(`Live stream detected: ${liveStream.title}`);
                
                // WebSocketでライブ配信検知を通知
                if (this.wsManager) {
                    this.wsManager.broadcast({
                        type: 'live_detected',
                        data: {
                            videoId: liveStream.videoId,
                            title: liveStream.title,
                            thumbnail: liveStream.thumbnail,
                            channelTitle: liveStream.channelTitle,
                            timestamp: new Date()
                        }
                    });
                }

                // ChromeCastでキャスト開始
                if (schedule.device_id) {
                    try {
                        await this.chromecastService.startCast(
                            liveStream.videoId,
                            schedule.device_id,
                            schedule.id
                        );
                    } catch (castError) {
                        console.error(`Cast failed for schedule ${schedule.id}:`, castError.message);
                        // Cast error should not crash the server, just log it
                        if (this.wsManager) {
                            this.wsManager.broadcast({
                                type: 'cast_failed',
                                data: {
                                    scheduleId: schedule.id,
                                    channelName: schedule.channel_name,
                                    error: castError.message,
                                    timestamp: new Date()
                                }
                            });
                        }
                    }
                } else {
                    console.warn(`No device specified for schedule ${schedule.id}`);
                }
            } else {
                console.log(`No live stream found for channel ${schedule.channel_name}`);
                
                // WebSocketで配信なしを通知
                if (this.wsManager) {
                    this.wsManager.broadcast({
                        type: 'no_live_stream',
                        data: {
                            scheduleId: schedule.id,
                            channelName: schedule.channel_name,
                            timestamp: new Date()
                        }
                    });
                }
            }
        } catch (error) {
            console.error(`Schedule execution error for schedule ${schedule.id}:`, error);
            
            // WebSocketでエラーを通知
            if (this.wsManager) {
                this.wsManager.broadcast({
                    type: 'schedule_error',
                    data: {
                        scheduleId: schedule.id,
                        channelName: schedule.channel_name,
                        error: error.message,
                        timestamp: new Date()
                    }
                });
            }
        }
    }

    async addSchedule(scheduleData) {
        try {
            const result = await this.database.createSchedule(scheduleData);
            const newSchedule = await this.database.get(
                'SELECT * FROM schedules WHERE id = ?',
                [result.lastID]
            );
            
            if (newSchedule && newSchedule.is_active) {
                this.registerCronJob(newSchedule);
            }
            
            return newSchedule;
        } catch (error) {
            console.error('Add schedule error:', error);
            throw error;
        }
    }

    async updateSchedule(scheduleId, scheduleData) {
        try {
            await this.database.updateSchedule(scheduleId, scheduleData);
            
            // 既存のcronジョブを停止
            if (this.cronJobs.has(scheduleId)) {
                this.cronJobs.get(scheduleId).stop();
                this.cronJobs.delete(scheduleId);
            }
            
            // 更新されたスケジュールを取得
            const updatedSchedule = await this.database.get(
                'SELECT * FROM schedules WHERE id = ?',
                [scheduleId]
            );
            
            // アクティブな場合は新しいcronジョブを登録
            if (updatedSchedule && updatedSchedule.is_active) {
                this.registerCronJob(updatedSchedule);
            }
            
            return updatedSchedule;
        } catch (error) {
            console.error('Update schedule error:', error);
            throw error;
        }
    }

    async deleteSchedule(scheduleId) {
        try {
            // cronジョブを停止・削除
            if (this.cronJobs.has(scheduleId)) {
                this.cronJobs.get(scheduleId).stop();
                this.cronJobs.delete(scheduleId);
            }
            
            await this.database.deleteSchedule(scheduleId);
            
            return true;
        } catch (error) {
            console.error('Delete schedule error:', error);
            throw error;
        }
    }

    getActiveJobs() {
        return Array.from(this.cronJobs.keys()).map(scheduleId => ({
            scheduleId,
            isRunning: this.cronJobs.get(scheduleId).running
        }));
    }

    async getNextSchedule() {
        try {
            const schedules = await this.database.getActiveSchedules();
            const now = new Date();
            const currentDay = now.getDay();
            const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            
            let nextSchedule = null;
            let minTimeDiff = Infinity;
            
            for (const schedule of schedules) {
                const scheduleDay = schedule.day_of_week;
                const scheduleTime = schedule.start_time;
                
                // 今日以降の最も近いスケジュールを探す
                let dayDiff = (scheduleDay - currentDay + 7) % 7;
                
                // 今日の場合、時刻もチェック
                if (dayDiff === 0 && scheduleTime <= currentTime) {
                    dayDiff = 7; // 来週の同じ曜日
                }
                
                const [hour, minute] = scheduleTime.split(':').map(Number);
                const totalMinutes = dayDiff * 24 * 60 + hour * 60 + minute;
                
                if (totalMinutes < minTimeDiff) {
                    minTimeDiff = totalMinutes;
                    nextSchedule = {
                        ...schedule,
                        nextExecution: this.calculateNextExecution(scheduleDay, scheduleTime)
                    };
                }
            }
            
            return nextSchedule;
        } catch (error) {
            console.error('Get next schedule error:', error);
            return null;
        }
    }

    calculateNextExecution(dayOfWeek, timeString) {
        const now = new Date();
        const [hour, minute] = timeString.split(':').map(Number);
        
        const nextExecution = new Date();
        nextExecution.setHours(hour, minute, 0, 0);
        
        // 現在の曜日から目標曜日までの日数を計算
        const currentDay = now.getDay();
        let dayDiff = (dayOfWeek - currentDay + 7) % 7;
        
        // 今日の場合、時刻もチェック
        if (dayDiff === 0 && nextExecution <= now) {
            dayDiff = 7; // 来週の同じ曜日
        }
        
        nextExecution.setDate(nextExecution.getDate() + dayDiff);
        
        return nextExecution;
    }

    async refreshSchedules() {
        try {
            // 全てのcronジョブを停止
            for (const job of this.cronJobs.values()) {
                job.stop();
            }
            this.cronJobs.clear();
            
            // スケジュールを再読み込みして再登録
            const schedules = await this.database.getActiveSchedules();
            for (const schedule of schedules) {
                this.registerCronJob(schedule);
            }
            
            console.log(`Refreshed ${schedules.length} schedules`);
        } catch (error) {
            console.error('Refresh schedules error:', error);
            throw error;
        }
    }

    stopAllJobs() {
        for (const job of this.cronJobs.values()) {
            job.stop();
        }
        this.cronJobs.clear();
        console.log('All cron jobs stopped');
    }

    getScheduleStatus() {
        return {
            isInitialized: this.isInitialized,
            activeJobs: this.cronJobs.size,
            jobs: this.getActiveJobs()
        };
    }
}

module.exports = ScheduleService;