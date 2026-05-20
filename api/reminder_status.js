// api/reminder_status.js
// Returns whether a reminder has already been sent and the unlock time hasn't passed yet.
// Unlock time is always 7:00 AM PHT the day after the reminder was sent.

import { supabase, getSessionFromRequest } from './_supabase.js';

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
    .eq('key', 'reminder_unlock_at')
    .single();

  if (error && error.code !== 'PGRST116') {
    return res.status(500).json({ success: false, message: 'DB error.' });
  }

  const unlockAt = data?.value ? new Date(data.value) : null;
  const locked   = unlockAt ? Date.now() < unlockAt.getTime() : false;

  return res.status(200).json({ success: true, locked, unlockAt: unlockAt?.toISOString() || null });
}