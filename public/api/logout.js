// api/logout.js
// Replaces: php/logout.php

import { clearSessionCookie } from './_supabase.js';

export default async function handler(req, res) {
  clearSessionCookie(res);
  res.setHeader('Location', '/login.html');
  return res.status(302).end();
}
