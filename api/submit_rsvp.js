// api/submit_rsvp.js

import { supabase, getClientIP } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Invalid request method.' });
  }

  const ip = getClientIP(req);

  // Check if already submitted
  const { data: existing } = await supabase
    .from('rsvp')
    .select('id')
    .eq('ip_address', ip)
    .maybeSingle();

  if (existing) {
    return res.status(200).json({
      success: false,
      message: 'You have already submitted an RSVP from this device.'
    });
  }

  const body = req.body || {};
  const attending = (body.attending ?? 'yes').toLowerCase();

  if (attending !== 'yes' && attending !== 'no') {
    return res.status(200).json({ success: false, message: 'Invalid attendance value.' });
  }

  // ── "No" RSVP — just record the declination, no guest details needed ──────
  if (attending === 'no') {
    const { error } = await supabase.from('rsvp').insert({
      ip_address:  ip,
      attending:   'no',
      num_guests:  0,
      guest_names: null,
      message:     null
    });

    if (error) {
      if (error.code === '23505') {
        return res.status(200).json({ success: false, message: 'You have already submitted an RSVP.' });
      }
      console.error('Supabase insert error:', error);
      return res.status(500).json({ success: false, message: 'Database error. Please try again.' });
    }

    return res.status(200).json({ success: true, attending: 'no' });
  }

  // ── "Yes" RSVP — full guest details required ──────────────────────────────
  const numGuests    = parseInt(body.num_guests ?? 0);
  const guestNamesRaw = body.guest_names ?? '';
  const message      = (body.message ?? '').trim();

  if (numGuests < 1 || numGuests > 20) {
    return res.status(200).json({ success: false, message: 'Invalid number of guests.' });
  }

  let guestNames;
  try {
    guestNames = JSON.parse(guestNamesRaw);
  } catch {
    return res.status(200).json({ success: false, message: 'Please provide guest names.' });
  }

  if (!Array.isArray(guestNames) || guestNames.length === 0) {
    return res.status(200).json({ success: false, message: 'Please provide guest names.' });
  }

  guestNames = guestNames
    .map(n => String(n).trim().replace(/[<>"'&]/g, ''))
    .filter(Boolean);

  if (guestNames.length === 0) {
    return res.status(200).json({ success: false, message: 'Please provide valid guest names.' });
  }

  const { error } = await supabase.from('rsvp').insert({
    ip_address:  ip,
    attending:   'yes',
    num_guests:  numGuests,
    guest_names: guestNames.join(', '),
    message:     message || null
  });

  if (error) {
    if (error.code === '23505') {
      return res.status(200).json({ success: false, message: 'You have already submitted an RSVP.' });
    }
    console.error('Supabase insert error:', error);
    return res.status(500).json({ success: false, message: 'Database error. Please try again.' });
  }

  return res.status(200).json({ success: true, attending: 'yes', message: 'RSVP submitted successfully!' });
}
