-- Migrasi 0007: Fase 3 — Community (T3-001, T3-002, T3-003)
-- 1. Confession Chains: parent_whisper_id di whispers
-- 2. Community Rooms: tabel rooms dan room_id di confessions
-- 3. Anonymous Badges: tabel user_badges dan badge_type di confessions & whispers

-- A. Tabel rooms (T3-003)
CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(64) NOT NULL UNIQUE,
  name VARCHAR(128) NOT NULL,
  description TEXT NOT NULL,
  icon VARCHAR(32) NOT NULL DEFAULT '💬',
  rules TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rooms_slug ON rooms(slug);

-- B. Tabel user_badges (T3-002)
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_type VARCHAR(64) NOT NULL,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_badge UNIQUE (user_id, badge_type)
);

CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);

-- C. Perubahan tabel confessions (room_id & badge_type)
ALTER TABLE confessions
  ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS badge_type VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_confessions_room ON confessions(room_id, status, created_at);

-- D. Perubahan tabel whispers (parent_whisper_id & badge_type) (T3-001)
ALTER TABLE whispers
  ADD COLUMN IF NOT EXISTS parent_whisper_id UUID REFERENCES whispers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS badge_type VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_whispers_parent ON whispers(parent_whisper_id);

-- E. Seed default community rooms (T3-003)
INSERT INTO rooms (slug, name, description, icon, rules, sort_order)
VALUES
  ('campus-life', 'Kampus & Kuliah', 'Rahasia seputar perkuliahan, tugas akhir, dinamika organisasi, dosen, dan pertemanan kampus.', '🎓', 'Hargai sesama mahasiswa; dilarang membocorkan nama dosen/mahasiswa asli (doxxing).', 1),
  ('workplace-burnout', 'Work & Career', 'Tekanan deadline, imposter syndrome, toxic office, gaji, dan lika-liku dunia kerja.', '💼', 'Dilarang mencantumkan nama spesifik perusahaan atau kolega kerja secara eksplisit.', 2),
  ('unsent-letters', 'Surat Tak Terkirim', 'Pesan, rindu, dan kata-kata yang tidak pernah sempat terucap langsung ke seseorang.', '✉️', 'Tuliskan perasaanmu dengan jujur; jaga kerahasiaan identitas pihak terkait.', 3),
  ('deep-existential', 'Eksistensial & Makna', 'Pemikiran mendalam, pencarian arti hidup, filosofi, dan renungan saat sunyi.', '🌌', 'Ruang refleksi bebas stigma untuk pertanyaan-pertanyaan terbesar dalam hidup.', 4),
  ('midnight-thoughts', 'Midnight Sanctuary', 'Tempat pelarian pikiran larut malam (00:00 - 04:00). Berbagi rasa saat dunia tertidur.', '🌒', 'Ekspresikan isi hatimu dengan tenang di keheningan malam.', 5)
ON CONFLICT (slug) DO NOTHING;
