-- ============================================================
-- Run this in Supabase SQL Editor (https://app.supabase.com)
-- Project > SQL Editor > New Query > paste & run
-- ============================================================

-- RSVP table
-- NOTE: ip_address is NO LONGER UNIQUE — multiple guests on the
-- same network (shared WiFi, NAT) must be able to submit separately.
-- Same-device detection is handled via browser localStorage.
CREATE TABLE IF NOT EXISTS rsvp (
    id           SERIAL PRIMARY KEY,
    ip_address   VARCHAR(45) NOT NULL,          -- stored for logging only, NOT unique
    attending    VARCHAR(3) NOT NULL DEFAULT 'yes',
    num_guests   INT NOT NULL DEFAULT 0,
    guest_names  TEXT,
    message      TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- If the table already exists, run these migration statements:
-- ALTER TABLE rsvp DROP CONSTRAINT IF EXISTS rsvp_ip_address_key;
-- ALTER TABLE rsvp ADD COLUMN IF NOT EXISTS attending VARCHAR(3) NOT NULL DEFAULT 'yes';
-- ALTER TABLE rsvp ALTER COLUMN guest_names DROP NOT NULL;
-- ALTER TABLE rsvp ALTER COLUMN num_guests SET DEFAULT 0;

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id         SERIAL PRIMARY KEY,
    username   VARCHAR(50) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default admin account (username: admin / password: 1234asdfg)
INSERT INTO admin_users (username, password)
VALUES ('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi')
ON CONFLICT (username) DO NOTHING;

ALTER TABLE rsvp DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- MIGRATION: Add email and phone columns for notifications
-- Run in Supabase SQL Editor after the initial schema above.
-- ============================================================

ALTER TABLE rsvp ADD COLUMN IF NOT EXISTS email   TEXT;
ALTER TABLE rsvp ADD COLUMN IF NOT EXISTS phone   VARCHAR(20);

-- Optional: index for faster lookups during reminder blasts
CREATE INDEX IF NOT EXISTS rsvp_email_idx ON rsvp (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS rsvp_phone_idx ON rsvp (phone) WHERE phone IS NOT NULL;
