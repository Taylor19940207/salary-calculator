-- 都道府県マスタ
CREATE TABLE IF NOT EXISTS prefectures (
  code TEXT PRIMARY KEY,
  name_ja TEXT NOT NULL,
  name_en TEXT,
  region TEXT
);

-- 保険料率テーブル（バージョン管理）
CREATE TABLE IF NOT EXISTS insurance_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prefecture_code TEXT REFERENCES prefectures(code),
  rate_type TEXT NOT NULL,
  rate_percentage REAL NOT NULL,
  employee_burden_percentage REAL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  source_url TEXT,
  verified_at TEXT,
  verified_by TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rates_lookup
  ON insurance_rates(prefecture_code, rate_type, effective_from DESC);

-- 起動時シードの冪等性を保証（INSERT OR IGNORE がこの制約で重複を弾く）
CREATE UNIQUE INDEX IF NOT EXISTS uq_rates_identity
  ON insurance_rates(COALESCE(prefecture_code, ''), rate_type, effective_from);

-- 料率更新ログ
CREATE TABLE IF NOT EXISTS rate_update_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  update_date TEXT NOT NULL,
  rate_type TEXT,
  prefecture_code TEXT,
  old_rate REAL,
  new_rate REAL,
  source TEXT,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 標準報酬月額等級テーブル
CREATE TABLE IF NOT EXISTS standard_remuneration_grades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grade_number INTEGER NOT NULL,
  min_amount INTEGER NOT NULL,
  max_amount INTEGER NOT NULL,
  standard_amount INTEGER NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  insurance_type TEXT DEFAULT 'health_pension'
);

CREATE INDEX IF NOT EXISTS idx_grades_lookup
  ON standard_remuneration_grades(min_amount, max_amount, effective_from DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_grades_identity
  ON standard_remuneration_grades(grade_number, effective_from, insurance_type);
