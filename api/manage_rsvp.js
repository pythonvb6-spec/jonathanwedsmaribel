// api/manage_rsvp.js
// Admin-only: remove a specific guest name from an RSVP entry and decrement num_guests.
// The frontend calls notify.js separately to send the notification message.

import { supabase, getSessionFromRequest } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }

  const { rsvp_id, remove_name } = req.body || {};

  if (!rsvp_id || !remove_name) {
    return res.status(400).json({ success: false, message: 'rsvp_id and remove_name are required.' });
  }

  // Fetch current record
  const { data: rsvp, error: fetchErr } = await supabase
    .from('rsvp')
    .select('id, guest_names, num_guests')
    .eq('id', rsvp_id)
    .single();

  if (fetchErr || !rsvp) {
    return res.status(404).json({ success: false, message: 'RSVP record not found.' });
  }

  const nameList = (rsvp.guest_names || '').split(',').map(n => n.trim()).filter(Boolean);
  const removeLower = remove_name.trim().toLowerCase();
  const newNames = nameList.filter(n => n.toLowerCase() !== removeLower);

  if (newNames.length === nameList.length) {
    return res.status(400).json({
      success: false,
      message: `"${remove_name}" was not found in this RSVP's guest list.`,
    });
  }

  const newCount = Math.max(newNames.length, 0);

  const { error: updateErr } = await supabase
    .from('rsvp')
    .update({
      guest_names: newNames.length ? newNames.join(', ') : null,
      num_guests:  newCount,
    })
    .eq('id', rsvp_id);

  if (updateErr) {
    console.error('Supabase update error:', updateErr);
    return res.status(500).json({ success: false, message: 'Database error updating record.' });
  }

  return res.status(200).json({
    success: true,
    message: `"${remove_name}" has been removed from the guest list.`,
    updated: {
      id: rsvp_id,
      guest_names: newNames.join(', ') || null,
      num_guests: newCount,
    },
  });
}
