// api/check_rsvp.js
// Called by invitation.html on page load.
// Primary "same device" check is localStorage (client-side).
// This endpoint is a server-side fallback: checks IP only.

import { supabase, getClientIP } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const ip = getClientIP(req);

  // Look up all submissions from this IP
  const { data, error } = await supabase
    .from('rsvp')
    .select('id, attending')
    .eq('ip_address', ip);

  if (error) {
    return res.status(200).json({ submitted: false, attending: null });
  }

  // Only treat as "already submitted from this device" if exactly one
  // record exists for this IP. Multiple records = different people on
  // same network, so we don't block.
  if (data && data.length === 1) {
    return res.status(200).json({
      submitted: true,
      attending: data[0].attending
    });
  }

  return res.status(200).json({ submitted: false, attending: null });
}
