// api/check_rsvp.js
// Called by invitation.html on page load to see if visitor already submitted

import { supabase, getClientIP } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const ip = getClientIP(req);

  const { data } = await supabase
    .from('rsvp')
    .select('id, attending')
    .eq('ip_address', ip)
    .maybeSingle();

  return res.status(200).json({
    submitted: !!data,
    attending: data?.attending ?? null
  });
}
