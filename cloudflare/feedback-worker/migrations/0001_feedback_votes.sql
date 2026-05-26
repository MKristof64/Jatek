CREATE TABLE IF NOT EXISTS feedback_votes (
  id TEXT PRIMARY KEY,
  card_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode = 'bold'),
  kind TEXT NOT NULL,
  vote_type TEXT NOT NULL CHECK (vote_type IN ('like', 'dislike')),
  app_context TEXT NOT NULL DEFAULT 'local',
  app_version TEXT,
  page_origin TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feedback_votes_mode_card ON feedback_votes(mode, card_id);
CREATE INDEX IF NOT EXISTS idx_feedback_votes_created_at ON feedback_votes(created_at);

CREATE TABLE IF NOT EXISTS daily_feedback_snapshots (
  snapshot_date TEXT NOT NULL,
  card_id TEXT NOT NULL,
  mode TEXT NOT NULL CHECK (mode = 'bold'),
  kind TEXT NOT NULL,
  likes INTEGER NOT NULL DEFAULT 0,
  dislikes INTEGER NOT NULL DEFAULT 0,
  total_votes INTEGER NOT NULL DEFAULT 0,
  success_percent REAL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (snapshot_date, card_id)
);

CREATE INDEX IF NOT EXISTS idx_daily_feedback_snapshots_mode_success
  ON daily_feedback_snapshots(mode, success_percent DESC, total_votes DESC);
