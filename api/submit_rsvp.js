// api/submit_rsvp.js
// Replaces: php/submit_rsvp.php

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
  const attending = body.attending !== false && body.attending !== 'false';

  // ── Declined ─────────────────────────────────────────────────────────────────
  if (!attending) {
    const { error } = await supabase.from('rsvp').insert({
      ip_address:  ip,
      attending:   false,
      num_guests:  0,
      guest_names: 'Declined',
      message:     null
    });

    if (error) {
      if (error.code === '23505') {
        return res.status(200).json({ success: false, message: 'You have already submitted an RSVP.' });
      }
      console.error('Supabase insert error:', error);
      return res.status(500).json({ success: false, message: 'Database error. Please try again.' });
    }

    return res.status(200).json({ success: true, attending: false });
  }

  // ── Attending ─────────────────────────────────────────────────────────────────
  const numGuests     = parseInt(body.num_guests ?? 0);
  const guestNamesRaw = body.guest_names ?? '';
  const message       = (body.message ?? '').trim();

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

  // Sanitize names
  guestNames = guestNames
    .map(n => String(n).trim().replace(/[<>"'&]/g, ''))
    .filter(Boolean);

  if (guestNames.length === 0) {
    return res.status(200).json({ success: false, message: 'Please provide valid guest names.' });
  }

  const guestNamesStr = guestNames.join(', ');

  const { error } = await supabase.from('rsvp').insert({
    ip_address:  ip,
    attending:   true,
    num_guests:  numGuests,
    guest_names: guestNamesStr,
    message:     message || null
  });

  if (error) {
    if (error.code === '23505') {
      return res.status(200).json({ success: false, message: 'You have already submitted an RSVP.' });
    }
    console.error('Supabase insert error:', error);
    return res.status(500).json({ success: false, message: 'Database error. Please try again.' });
  }

  return res.status(200).json({ success: true, attending: true, message: 'RSVP submitted successfully!' });
}