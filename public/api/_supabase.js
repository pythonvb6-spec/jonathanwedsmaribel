// api/_supabase.js
// Shared Supabase client — imported by all API routes

import { createClient } from '@supabase/supabase-js';

const supabaseUrl  = process.env.SUPABASE_URL;
const supabaseKey  = process.env.SUPABASE_SERVICE_KEY; // service_role key (server-side only)

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// ── IP helper ────────────────────────────────────────────────────────────────
export function getClientIP(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || '0.0.0.0';
}

// ── Session helpers ──────────────────────────────────────────────────────────
// We use a simple signed token stored in a cookie.
// Format:  base64(JSON{ username, exp }) + "." + base64(HMAC-SHA256)
// For simplicity we use a shared secret from env vars.

import { createHmac } from 'crypto';

const SESSION_SECRET = process.env.SESSION_SECRET || 'change-me-in-production';
const SESSION_COOKIE = 'admin_session';
const SESSION_TTL    = 8 * 60 * 60 * 1000; // 8 hours in ms

export function createSessionToken(username) {
  const payload = Buffer.from(JSON.stringify({ username, exp: Date.now() + SESSION_TTL })).toString('base64');
  const sig     = createHmac('sha256', SESSION_SECRET).update(payload).digest('base64');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token) {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = createHmac('sha256', SESSION_SECRET).update(payload).digest('base64');
  if (expected !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64').toString());
    if (data.exp < Date.now()) return null; // expired
    return data;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req) {
  const cookieHeader = req.headers['cookie'] || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    })
  );
  return verifySessionToken(cookies[SESSION_COOKIE]);
}

export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL / 1000}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie',
    `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`
  );
}

export { SESSION_COOKIE };
