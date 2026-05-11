// api/login.js
// Replaces: PHP session login in login.php

import { supabase, createSessionToken, setSessionCookie } from './_supabase.js';
import bcrypt from 'bcryptjs';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(200).json({ success: false, message: 'Please enter username and password.' });
  }

  const { data: admin } = await supabase
    .from('admin_users')
    .select('*')
    .eq('username', username.trim())
    .maybeSingle();

  if (!admin || !(await bcrypt.compare(password, admin.password))) {
    return res.status(200).json({ success: false, message: 'Incorrect username or password.' });
  }

  const token = createSessionToken(admin.username);
  setSessionCookie(res, token);

  return res.status(200).json({ success: true, username: admin.username });
}
