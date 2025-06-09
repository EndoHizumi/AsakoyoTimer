-- 配信スケジュール
CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL,
    channel_name TEXT NOT NULL,
    day_of_week INTEGER NOT NULL, -- 0:日曜 〜 6:土曜
    start_time TEXT NOT NULL,     -- "09:00" 形式
    duration_minutes INTEGER DEFAULT 120,
    device_id INTEGER,
    is_active BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES chromecast_devices(id)
);

-- ChromeCastデバイス
CREATE TABLE IF NOT EXISTS chromecast_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    ip_address TEXT NOT NULL,
    port INTEGER DEFAULT 8009,
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_seen DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- キャストログ
CREATE TABLE IF NOT EXISTS cast_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER,
    video_id TEXT,
    video_title TEXT,
    device_id INTEGER,
    status TEXT, -- 'started', 'stopped', 'error'
    error_message TEXT,
    started_at DATETIME,
    ended_at DATETIME,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id),
    FOREIGN KEY (device_id) REFERENCES chromecast_devices(id)
);

-- お気に入りチャンネル
CREATE TABLE IF NOT EXISTS favorite_channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id TEXT NOT NULL UNIQUE,
    channel_name TEXT NOT NULL,
    thumbnail TEXT,
    description TEXT,
    subscriber_count TEXT,
    is_favorite BOOLEAN DEFAULT true,
    last_used DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_schedules_day_time ON schedules(day_of_week, start_time);
CREATE INDEX IF NOT EXISTS idx_cast_logs_status ON cast_logs(status);
CREATE INDEX IF NOT EXISTS idx_cast_logs_started_at ON cast_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_favorite_channels_last_used ON favorite_channels(last_used DESC);
CREATE INDEX IF NOT EXISTS idx_favorite_channels_name ON favorite_channels(channel_name);