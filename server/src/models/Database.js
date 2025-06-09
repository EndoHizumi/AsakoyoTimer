const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

class Database {
    constructor(dbPath = process.env.DB_PATH || './database/autocast.db') {
        this.dbPath = dbPath;
        this.db = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            // データベースディレクトリが存在しない場合は作成
            const dbDir = path.dirname(this.dbPath);
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
            }

            this.db = new sqlite3.Database(this.dbPath, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('SQLite database connected');
                    this.initializeSchema().then(resolve).catch(reject);
                }
            });
        });
    }

    async initializeSchema() {
        const schemaPath = path.join(__dirname, '../../database/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        return new Promise((resolve, reject) => {
            this.db.exec(schema, (err) => {
                if (err) {
                    reject(err);
                } else {
                    console.log('Database schema initialized');
                    resolve();
                }
            });
        });
    }

    async run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve({ lastID: this.lastID, changes: this.changes });
                }
            });
        });
    }

    async get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    close() {
        if (this.db) {
            this.db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                } else {
                    console.log('Database connection closed');
                }
            });
        }
    }

    // スケジュール関連
    async getActiveSchedules() {
        return this.all('SELECT * FROM schedules WHERE is_active = 1');
    }

    async createSchedule(data) {
        const { channel_id, channel_name, day_of_week, start_time, duration_minutes, device_id } = data;
        return this.run(
            `INSERT INTO schedules (channel_id, channel_name, day_of_week, start_time, duration_minutes, device_id)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [channel_id, channel_name, day_of_week, start_time, duration_minutes, device_id]
        );
    }

    async updateSchedule(id, data) {
        const { channel_id, channel_name, day_of_week, start_time, duration_minutes, device_id, is_active } = data;
        return this.run(
            `UPDATE schedules 
             SET channel_id = ?, channel_name = ?, day_of_week = ?, start_time = ?, 
                 duration_minutes = ?, device_id = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [channel_id, channel_name, day_of_week, start_time, duration_minutes, device_id, is_active, id]
        );
    }

    async deleteSchedule(id) {
        return this.run('DELETE FROM schedules WHERE id = ?', [id]);
    }

    // デバイス関連
    async getDevices() {
        return this.all('SELECT * FROM chromecast_devices WHERE is_active = 1');
    }

    async createDevice(data) {
        const { name, ip_address, port, is_default } = data;
        return this.run(
            `INSERT INTO chromecast_devices (name, ip_address, port, is_default, last_seen)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [name, ip_address, port || 8009, is_default || false]
        );
    }

    async updateDeviceLastSeen(id) {
        return this.run(
            'UPDATE chromecast_devices SET last_seen = CURRENT_TIMESTAMP WHERE id = ?',
            [id]
        );
    }

    // ログ関連
    async createCastLog(data) {
        const { schedule_id, video_id, video_title, device_id, status, error_message } = data;
        return this.run(
            `INSERT INTO cast_logs (schedule_id, video_id, video_title, device_id, status, error_message, started_at)
             VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [schedule_id, video_id, video_title, device_id, status, error_message]
        );
    }

    async updateCastLogEnd(id, status, error_message = null) {
        return this.run(
            'UPDATE cast_logs SET status = ?, error_message = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?',
            [status, error_message, id]
        );
    }

    async getCastLogs(limit = 50) {
        return this.all(
            `SELECT cl.*, s.channel_name, cd.name as device_name
             FROM cast_logs cl
             LEFT JOIN schedules s ON cl.schedule_id = s.id
             LEFT JOIN chromecast_devices cd ON cl.device_id = cd.id
             ORDER BY cl.started_at DESC
             LIMIT ?`,
            [limit]
        );
    }

    // お気に入りチャンネル関連
    async getFavoriteChannels() {
        return this.all(
            'SELECT * FROM favorite_channels WHERE is_favorite = 1 ORDER BY last_used DESC, channel_name ASC'
        );
    }

    async addFavoriteChannel(data) {
        const { channel_id, channel_name, thumbnail, description, subscriber_count } = data;
        return this.run(
            `INSERT OR REPLACE INTO favorite_channels 
             (channel_id, channel_name, thumbnail, description, subscriber_count, last_used, updated_at)
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [channel_id, channel_name, thumbnail, description, subscriber_count]
        );
    }

    async updateFavoriteChannelLastUsed(channelId) {
        return this.run(
            'UPDATE favorite_channels SET last_used = CURRENT_TIMESTAMP WHERE channel_id = ?',
            [channelId]
        );
    }

    async removeFavoriteChannel(channelId) {
        return this.run(
            'UPDATE favorite_channels SET is_favorite = 0 WHERE channel_id = ?',
            [channelId]
        );
    }

    async getRecentlyUsedChannels(limit = 10) {
        return this.all(
            `SELECT DISTINCT channel_id, channel_name, MAX(created_at) as last_used
             FROM schedules 
             GROUP BY channel_id, channel_name
             ORDER BY last_used DESC
             LIMIT ?`,
            [limit]
        );
    }
}

module.exports = Database;