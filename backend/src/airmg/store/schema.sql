CREATE TABLE IF NOT EXISTS samples (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    ts INTEGER NOT NULL,
    value REAL NOT NULL,
    source TEXT DEFAULT 'google-health',
    UNIQUE(type, ts)
);
CREATE INDEX IF NOT EXISTS idx_samples_type_ts ON samples(type, ts);

CREATE TABLE IF NOT EXISTS sleep_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_ts INTEGER NOT NULL,
    end_ts INTEGER NOT NULL,
    efficiency REAL,
    stages_json TEXT,
    resting_hr INTEGER,
    avg_hrv REAL,
    source TEXT DEFAULT 'google-health',
    UNIQUE(start_ts, end_ts)
);

CREATE TABLE IF NOT EXISTS workouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    start_ts INTEGER NOT NULL,
    end_ts INTEGER NOT NULL,
    type TEXT,
    calories REAL,
    avg_hr INTEGER,
    max_hr INTEGER,
    strain REAL,
    source TEXT DEFAULT 'google-health',
    UNIQUE(start_ts, end_ts)
);

CREATE TABLE IF NOT EXISTS daily_metrics (
    day TEXT PRIMARY KEY,
    recovery REAL, strain REAL, sleep_performance REAL,
    hrv_rmssd REAL, resting_hr REAL, resp_rate REAL,
    spo2 REAL, skin_temp REAL, steps INTEGER, calories REAL,
    sleep_minutes INTEGER, deep_minutes INTEGER,
    rem_minutes INTEGER, light_minutes INTEGER, wake_minutes INTEGER
);

CREATE TABLE IF NOT EXISTS baselines (
    metric TEXT PRIMARY KEY,
    mean REAL NOT NULL, spread REAL NOT NULL,
    n_valid INTEGER NOT NULL,
    nights_since_update INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'calibrating',
    updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL, question_key TEXT NOT NULL,
    answer TEXT NOT NULL, question TEXT,
    created_at INTEGER,
    UNIQUE(day, question_key)
);

CREATE TABLE IF NOT EXISTS steps (
    day TEXT PRIMARY KEY, total INTEGER NOT NULL,
    source TEXT DEFAULT 'google-health'
);

CREATE TABLE IF NOT EXISTS sync_state (
    data_type TEXT PRIMARY KEY, last_synced_ts INTEGER, last_token TEXT
);

CREATE TABLE IF NOT EXISTS profile (key TEXT PRIMARY KEY, value TEXT);
