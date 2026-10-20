CREATE TABLE IF NOT EXISTS step_loads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  peak_value REAL NOT NULL,
  timestamp TEXT NOT NULL,
  day TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_step_loads_day ON step_loads(day);
