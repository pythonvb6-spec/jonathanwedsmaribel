-- ============================================================
-- Run this in Supabase SQL Editor (https://app.supabase.com)
-- Project > SQL Editor > New Query > paste & run
-- ============================================================

-- RSVP table
CREATE TABLE IF NOT EXISTS rsvp (
    id SERIAL PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL UNIQUE,
    num_guests INT NOT NULL DEFAULT 1,
    guest_names TEXT NOT NULL,
    message TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Admin users table
CREATE TABLE IF NOT EXISTS admin_users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Default admin account
-- Username: admin
-- Password: 1234asdfg  (bcrypt hash below)
INSERT INTO admin_users (username, password)
VALUES ('admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi')
ON CONFLICT (username) DO NOTHING;

-- NOTE: The hash above is a placeholder. After deploying, go to:
--   https://your-vercel-url.vercel.app/api/hash-password
-- to generate a proper hash, then UPDATE the admin_users table with it.
-- OR just change the password in the Admin Portal after first login.

-- Disable Row Level Security so API routes can read/write freely
-- (Your API routes use the service_role key which bypasses RLS anyway)
ALTER TABLE rsvp DISABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;
