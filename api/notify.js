cat > /home/claude/jonathanwedsmaribel-updated/api/notify.js << 'JSEOF'
// api/notify.js
// Sends a "plus-one removed" notification to a guest via Gmail and/or SMS (HttpSms).
//
// Required env vars:
//   GMAIL_USER          - pythonvb6@gmail.com
//   GMAIL_APP_PASSWORD  - 16-char Google App Password
//   HTTPSMS_API_KEY     - API key from httpsms.com/settings
//   HTTPSMS_FROM        - your phone number in international format e.g. +639XXXXXXXXX

import nodemailer from 'nodemailer';
import { supabase, getSessionFromRequest } from './_supabase.js';

// Nodemailer transporter
function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

// HttpSms send function
async function sendSMS(phone, message) {
  const apiKey = process.env.HTTPSMS_API_KEY;
  const from   = process.env.HTTPSMS_FROM;

  if (!apiKey) throw new Error('HTTPSMS_API_KEY is not configured.');
  if (!from)   throw new Error('HTTPSMS_FROM is not configured.');

  // Normalize PH number to international format
  const to = phone.replace(/^0/, '+63').replace(/[\s\-]/g, '');

  const response = await fetch('https://api.httpsms.com/v1/messages/send', {
    method: 'POST',
    headers: {
      'x-api-key':    apiKey,
      'Content-Type': 'application/json',
      'Accept':       'application/json',
    },
    body: JSON.stringify({ content: message, from, to }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HttpSms error ${response.status}: ${text}`);
  }
  return response.json();
}

// Email HTML builder
function buildEmailHtml({ guestName, removedName }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Regarding Your RSVP - Jonathan & Maribel</title>
  <style>
    body { font-family: Georgia, serif; background: #faf9f7; margin: 0; padding: 0; }
    .wrap { max-width: 560px; margin: 40px auto; background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; overflow: hidden; }
    .header { background: #7d8e56; padding: 32px 40px; text-align: center; }
    .header h1 { color: #fff; font-size: 1.4rem; font-weight: 400; letter-spacing: .12em; text-transform: uppercase; margin: 0; }
    .header p  { color: rgba(255,255,255,.75); font-size: .85rem; margin: 6px 0 0; }
    .body  { padding: 36px 40px; color: #3d3830; line-height: 1.7; }
    .body p { margin: 0 0 16px; }
    .removed-box { background: #fdf5f5; border-left: 3px solid #c0392b; border-radius: 4px; padding: 14px 18px; margin: 20px 0; font-weight: 600; color: #c0392b; }
    .footer { background: #f5f3ee; padding: 20px 40px; text-align: center; font-size: .78rem; color: #999; font-family: sans-serif; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>Jonathan &amp; Maribel</h1>
      <p>June 12, 2026 &middot; Regina's Garden &amp; Restaurant</p>
    </div>
    <div class="body">
      <p>Dear <strong>${guestName}</strong>,</p>
      <p>We are so grateful that you will be joining us on our special day and we truly look forward to celebrating with you.</p>
      <p>We are writing to let you know that, due to venue capacity and seating arrangements, we are unfortunately unable to accommodate the additional guest listed on your RSVP:</p>
      <div class="removed-box">Guest removed from your party: ${removedName}</div>
      <p>We sincerely apologize for any inconvenience this may cause. We hope you understand that we have had to make some very difficult decisions to keep our guest list within the venue's limits.</p>
      <p>If you have any questions or concerns, please don't hesitate to reach out to us directly. We can't wait to share this wonderful day with you!</p>
      <p>With love,<br><strong>Jonathan &amp; Maribel</strong></p>
    </div>
    <div class="footer">
      This message was sent by Jonathan &amp; Maribel's wedding team.<br>
      Please do not reply to this email — contact the couple directly for any concerns.
    </div>
  </div>
</body>
</html>`;
}

function buildSmsText({ guestName, removedName }) {
  return `Hi ${guestName}! This is Jonathan & Maribel. We're sorry, but due to venue capacity we're unable to accommodate your plus-one: ${removedName}. We apologize for the inconvenience and truly look forward to celebrating with you on June 12! For questions, please contact the couple directly.`;
}

// Main handler
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }

  const { rsvp_id, removed_name } = req.body || {};

  if (!rsvp_id || !removed_name) {
    return res.status(400).json({ success: false, message: 'rsvp_id and removed_name are required.' });
  }

  const { data: rsvp, error: fetchErr } = await supabase
    .from('rsvp')
    .select('id, guest_names, email, phone, num_guests')
    .eq('id', rsvp_id)
    .single();

  if (fetchErr || !rsvp) {
    return res.status(404).json({ success: false, message: 'RSVP record not found.' });
  }

  const guestName = rsvp.guest_names
    ? rsvp.guest_names.split(',')[0].trim()
    : 'Guest';

  const results = { email: null, sms: null };
  const errors  = [];

  // Send email
  if (rsvp.email) {
    try {
      const transporter = getTransporter();
      await transporter.sendMail({
        from: `"Jonathan & Maribel Wedding" <${process.env.GMAIL_USER}>`,
        to: rsvp.email,
        subject: 'Regarding Your RSVP - Jonathan & Maribel',
        html: buildEmailHtml({ guestName, removedName: removed_name }),
      });
      results.email = 'sent';
    } catch (err) {
      console.error('Email send error:', err.message);
      errors.push(`Email: ${err.message}`);
      results.email = 'failed';
    }
  }

  // Send SMS via HttpSms
  if (rsvp.phone) {
    try {
      await sendSMS(rsvp.phone, buildSmsText({ guestName, removedName: removed_name }));
      results.sms = 'sent';
    } catch (err) {
      console.error('SMS send error:', err.message);
      errors.push(`SMS: ${err.message}`);
      results.sms = 'failed';
    }
  }

  if (!rsvp.email && !rsvp.phone) {
    return res.status(400).json({
      success: false,
      message: 'This guest has no email or phone number on file.',
    });
  }

  return res.status(200).json({
    success: errors.length === 0,
    results,
    errors: errors.length ? errors : undefined,
    message: errors.length
      ? `Notification sent with some errors: ${errors.join('; ')}`
      : 'Notification sent successfully.',
  });
}