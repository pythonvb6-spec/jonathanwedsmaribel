// api/reminder_status.js
// Returns whether a reminder has already been sent today (PHT).
// Used by the admin portal to sync button state across all devices.

import { supabase, getSessionFromRequest } from './_supabase.js';

function todayPHTString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  const session = getSessionFromRequest(req);
  if (!session) return res.status(401).json({ success: false, message: 'Unauthorized.' });

  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'last_reminder_sent_date')
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = row not found, that's fine
    return res.status(500).json({ success: false, message: 'DB error.' });
  }

  const lastSentDate = data?.value || null;
  const lockedToday  = lastSentDate === todayPHTString();

  return res.status(200).json({ success: true, locked: lockedToday, lastSentDate });
}
