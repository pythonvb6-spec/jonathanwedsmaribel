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

  // "No" RSVP
  if (attending === 'no') {
    let guestName = null;
    const rawNames = body.guest_names;
    if (rawNames) {
      try {
        const parsed = JSON.parse(rawNames);
        if (Array.isArray(parsed) && parsed[0]) {
          guestName = String(parsed[0]).trim().replace(/[<>"'&]/g, '') || null;
        }
      } catch { /* ignore malformed */ }
    }

    const { error } = await supabase.from('rsvp').insert({
      ip_address:  ip,
      attending:   'no',
      num_guests:  0,
      guest_names: guestName,
      message:     null
    });

    if (error) {
      if (error.code === '23505') return res.status(200).json({ success: true, attending: 'no' });
      console.error('Supabase insert error (no):', error);
      return res.status(500).json({ success: false, message: 'Database error. Please try again.' });
    }
    return res.status(200).json({ success: true, attending: 'no' });
  }

  // "Yes" RSVP - validate
  const numGuests = parseInt(body.num_guests ?? 0);
  const guestNamesRaw = body.guest_names ?? '';
  const message = (body.message ?? '').trim();

  // At least one contact method required
  const email = (body.email ?? '').trim().toLowerCase() || null;
  const phone = (body.phone ?? '').trim() || null;

  if (!email && !phone) {
    return res.status(200).json({
      success: false,
      message: 'Please provide at least one contact method (Gmail address or phone number).'
    });
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(200).json({ success: false, message: 'Please enter a valid email address.' });
  }
  if (phone && !/^(\+?63|0)9\d{9}$/.test(phone.replace(/[\s\-]/g, ''))) {
    return res.status(200).json({ success: false, message: 'Please enter a valid Philippine mobile number (e.g. 09XXXXXXXXX).' });
  }

  if (numGuests < 1 || numGuests > 20) {
    return res.status(200).json({ success: false, message: 'Invalid number of guests.' });
  }

  let guestNames;
  try { guestNames = JSON.parse(guestNamesRaw); }
  catch { return res.status(200).json({ success: false, message: 'Please provide guest names.' }); }

  if (!Array.isArray(guestNames) || guestNames.length === 0) {
    return res.status(200).json({ success: false, message: 'Please provide guest names.' });
  }

  guestNames = guestNames
    .map(n => String(n).trim().replace(/[<>"'&]/g, ''))
    .filter(Boolean);

  if (guestNames.length === 0) {
    return res.status(200).json({ success: false, message: 'Please provide valid guest names.' });
  }

  // Duplicate name check
  const { data: existingRows } = await supabase
    .from('rsvp').select('guest_names').eq('attending', 'yes').not('guest_names', 'is', null);

  const registeredNames = new Set();
  if (existingRows) {
    for (const row of existingRows) {
      row.guest_names.split(',').map(n => n.trim().toLowerCase()).forEach(n => registeredNames.add(n));
    }
  }

  const duplicates = guestNames.filter(n => registeredNames.has(n.toLowerCase()));
  if (duplicates.length > 0) {
    return res.status(200).json({
      success: false,
      duplicate_names: duplicates,
      message: `The following guest(s) are already in our list: ${duplicates.join(', ')}`
    });
  }

  // Insert
  const { error } = await supabase.from('rsvp').insert({
    ip_address:  ip,
    attending:   'yes',
    num_guests:  numGuests,
    guest_names: guestNames.join(', '),
    message:     message || null,
    email:       email,
    phone:       phone
  });

  if (error) {
    if (error.code === '23505') {
      return res.status(200).json({
        success: false,
        message: "It looks like an RSVP has already been submitted from your network. If you haven't submitted yet, please contact Jonathan & Maribel directly."
      });
    }
    console.error('Supabase insert error (yes):', error);
    return res.status(500).json({ success: false, message: 'Database error. Please try again.' });
  }

  return res.status(200).json({ success: true, attending: 'yes', message: 'RSVP submitted successfully!' });
}
