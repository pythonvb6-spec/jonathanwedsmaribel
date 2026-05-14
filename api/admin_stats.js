// api/admin_stats.js
// Returns dashboard stats for admin panel

import { supabase, getSessionFromRequest } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // Total RSVPs
  const { count: totalRSVP } = await supabase
    .from('rsvp').select('*', { count: 'exact', head: true });

  // Attending yes / no counts
  const { count: attendingYes } = await supabase
    .from('rsvp').select('*', { count: 'exact', head: true }).eq('attending', 'yes');

  const { count: attendingNo } = await supabase
    .from('rsvp').select('*', { count: 'exact', head: true }).eq('attending', 'no');

  // Total guests (sum of num_guests — only for yes RSVPs)
  const { data: guestData } = await supabase
    .from('rsvp').select('num_guests').eq('attending', 'yes');
  const totalGuests = (guestData || []).reduce((s, r) => s + (r.num_guests || 0), 0);

  // Total wishes
  const { count: totalWishes } = await supabase
    .from('rsvp')
    .select('*', { count: 'exact', head: true })
    .not('message', 'is', null)
    .neq('message', '');

  // Recent 5 RSVPs
  const { data: recent } = await supabase
    .from('rsvp')
    .select('*')
    .order('submitted_at', { ascending: false })
    .limit(5);

  return res.status(200).json({
    success: true,
    totalRSVP:    totalRSVP    ?? 0,
    attendingYes: attendingYes ?? 0,
    attendingNo:  attendingNo  ?? 0,
    totalGuests:  totalGuests  ?? 0,
    totalWishes:  totalWishes  ?? 0,
    recent:       recent       ?? []
  });
}
