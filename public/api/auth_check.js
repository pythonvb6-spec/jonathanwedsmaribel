// api/auth_check.js
// Called by admin.html on load — returns username if session is valid

import { getSessionFromRequest } from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ authenticated: false });
  }

  return res.status(200).json({ authenticated: true, username: session.username });
}
