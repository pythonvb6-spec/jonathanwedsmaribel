// api/submit_rsvp.js

import { supabase, getClientIP } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Invalid request method.' });
  }

  const ip = getClientIP(req);
  const body = req.body || {};
  const attending = (body.attending ?? 'yes').toLowerCase();

  if (attending !== 'yes' && attending !== 'no') {
    return res.status(200).json({ success: false, message: 'Invalid attendance value.' });
  }

  // ── "No" RSVP ──────────────────────────────────────────────────────────────
  if (attending === 'no') {
    const { error } = await supabase.from('rsvp').insert({
      ip_address:  ip,
      attending:   'no',
      num_guests:  0,
      guest_names: null,
      message:     null
    });

    if (error) {
      // 23505 = unique_violation (IP already recorded — that's fine, just return success)
      if (error.code === '23505') {
        return res.status(200).json({ success: true, attending: 'no' });
      }
      console.error('Supabase insert error (no):', error);
      return res.status(500).json({ success: false, message: 'Database error. Please try again.' });
    }

    return res.status(200).json({ success: true, attending: 'no' });
  }

  // ── "Yes" RSVP — validate input ────────────────────────────────────────────
  const numGuests = parseInt(body.num_guests ?? 0);
  const guestNamesRaw = body.guest_names ?? '';
  const message = (body.message ?? '').trim();

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

  // ── Name duplicate check ────────────────────────────────────────────────────
  // Fetch all existing guest_names from the DB and check for matches.
  const { data: existingRows } = await supabase
    .from('rsvp')
    .select('guest_names')
    .eq('attending', 'yes')
    .not('guest_names', 'is', null);

  // Flatten all recorded names into a single lowercase set
  const registeredNames = new Set();
  if (existingRows) {
    for (const row of existingRows) {
      const names = row.guest_names.split(',').map(n => n.trim().toLowerCase());
      names.forEach(n => registeredNames.add(n));
    }
  }

  // Find which submitted names are already registered
  const duplicates = guestNames.filter(n => registeredNames.has(n.toLowerCase()));

  if (duplicates.length > 0) {
    return res.status(200).json({
      success: false,
      duplicate_names: duplicates,
      message: `The following guest(s) are already in our list: ${duplicates.join(', ')}`
    });
  }

  // ── Insert ─────────────────────────────────────────────────────────────────
  const { error } = await supabase.from('rsvp').insert({
    ip_address:  ip,
    attending:   'yes',
    num_guests:  numGuests,
    guest_names: guestNames.join(', '),
    message:     message || null
  });

  if (error) {
    // 23505 = unique_violation: same IP already submitted "yes" from this network.
    // This happens when two different guests share one public IP (same WiFi).
    // The second guest's localStorage is empty so the form shows, but the DB
    // blocks the insert. Return a clear, friendly message instead of a 500.
    if (error.code === '23505') {
      return res.status(200).json({
        success: false,
        message: 'It looks like an RSVP has already been submitted from your network. If you haven\'t submitted yet, please contact Jonathan & Maribel directly.'
      });
    }
    console.error('Supabase insert error (yes):', error);
    return res.status(500).json({ success: false, message: 'Database error. Please try again.' });
  }

  return res.status(200).json({
    success: true,
    attending: 'yes',
    message: 'RSVP submitted successfully!'
  });
}
