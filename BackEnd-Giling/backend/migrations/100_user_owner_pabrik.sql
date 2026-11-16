-- Migration 100: Data per pabrik (owner + user yang dibuatnya)
--
-- Sebelumnya setiap user hanya melihat data yang dia buat sendiri, sehingga data operator
-- tidak terlihat oleh owner (termasuk di Approval Center dan saldo rekening).
-- owner_id menghubungkan user ke owner pabriknya:
--   owner_id IS NULL  → user ini owner pabriknya sendiri
--   owner_id = X      → user ini anggota pabrik milik X
-- Semua filter data memakai "dibuat oleh siapa pun di pabrik yang sama".
--
-- User lama tetap owner pabriknya sendiri (owner_id NULL), jadi tidak ada data yang
-- berpindah. Hubungkan user lama ke owner-nya lewat Master Akses bila perlu.
--
-- Idempotent: safe to run more than once.

ALTER TABLE sys.users ADD COLUMN IF NOT EXISTS owner_id UUID;

ALTER TABLE sys.users DROP CONSTRAINT IF EXISTS users_owner_id_fkey;
ALTER TABLE sys.users
  ADD CONSTRAINT users_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES sys.users(id) ON DELETE SET NULL;

ALTER TABLE sys.users DROP CONSTRAINT IF EXISTS chk_users_owner_not_self;
ALTER TABLE sys.users ADD CONSTRAINT chk_users_owner_not_self CHECK (owner_id IS NULL OR owner_id <> id);

CREATE INDEX IF NOT EXISTS idx_users_owner_id ON sys.users (owner_id);

COMMENT ON COLUMN sys.users.owner_id IS
  'Owner pabrik tempat user ini bekerja. NULL = user ini owner pabriknya sendiri.';
