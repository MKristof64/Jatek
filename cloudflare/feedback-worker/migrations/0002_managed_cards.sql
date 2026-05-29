CREATE TABLE IF NOT EXISTS managed_cards (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('never', 'duel', 'roundtable')),
  title TEXT NOT NULL,
  text TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'custom',
  deleted_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_managed_cards_mode_kind_active
  ON managed_cards(mode, kind, deleted_at);

CREATE INDEX IF NOT EXISTS idx_managed_cards_updated_at
  ON managed_cards(updated_at);
