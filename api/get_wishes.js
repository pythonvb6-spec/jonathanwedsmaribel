// api/get_wishes.js
// Replaces: php/get_wishes.php  — admin only

import { supabase, getSessionFromRequest } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { data: wishes, error } = await supabase
    .from('rsvp')
    .select('*')
    .not('message', 'is', null)
    .neq('message', '')
    .order('submitted_at', { ascending: false });

  if (error) {
    return res.status(500).json({ success: false, message: 'Database error.' });
  }

  return res.status(200).json({ success: true, wishes });
}
