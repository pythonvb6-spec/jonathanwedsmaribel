// api/notify.js
// Sends a "plus-one removed" notification to a guest via Gmail and/or SMS.
// Called from the admin panel when the couple removes an uninvited plus-one.
//
// Required env vars:
//   GMAIL_USER          – pythonvb6@gmail.com
//   GMAIL_APP_PASSWORD  – 16-char Google App Password (not your regular password)
//   SMS_GATEWAY_URL     – Android SMS Gateway base URL, e.g. http://192.168.x.x:8080
//   SMS_GATEWAY_USER    – SMS Gateway username (default: admin)
//   SMS_GATEWAY_PASS    – SMS Gateway password

import nodemailer from 'nodemailer';
import { supabase, getSessionFromRequest } from './_supabase.js';

// ── Nodemailer transporter ────────────────────────────────────────────────────
function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

// ── Android SMS Gateway helper ────────────────────────────────────────────────
async function sendSMS(phone, message) {
  const gatewayUrl = process.env.SMS_GATEWAY_URL;
  if (!gatewayUrl) throw new Error('SMS_GATEWAY_URL is not configured.');

  const user = process.env.SMS_GATEWAY_USER || 'admin';
  const pass = process.env.SMS_GATEWAY_PASS || '';
  const credentials = Buffer.from(`${user}:${pass}`).toString('base64');

  // Normalize Philippine number: strip leading 0, prepend +63
  const normalized = phone.replace(/^0/, '+63').replace(/[^+\d]/g, '');

  const response = await fetch(`${gatewayUrl}/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      phoneNumbers: [normalized],
      message,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SMS Gateway error ${response.status}: ${text}`);
  }
  return await response.json();
}

// ── Email body builder ────────────────────────────────────────────────────────
function buildEmailHtml({ guestName, removedName }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Regarding Your RSVP – Jonathan & Maribel</title>
  <style>
    body { font-family: 'Georgia', serif; background: #faf9f7; margin: 0; padding: 0; }
    .wrap { max-width: 560px; margin: 40px auto; background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; overflow: hidden; }
    .header { background: #7d8e56; padding: 32px 40px; text-align: center; }
    .header h1 { color: #fff; font-size: 1.4rem; font-weight: 400; letter-spacing: .12em; text-transform: uppercase; margin: 0; }
    .header p  { color: rgba(255,255,255,.75); font-size: .85rem; margin: 6px 0 0; letter-spacing: .08em; }
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
      <p>June 12, 2026 · Regina's Garden &amp; Restaurant</p>
    </div>
    <div class="body">
      <p>Dear <strong>${guestName}</strong>,</p>
      <p>
        We are so grateful that you will be joining us on our special day and we truly look forward
        to celebrating with you.
      </p>
      <p>
        We are writing to let you know that, due to venue capacity and seating arrangements,
        we are unfortunately unable to accommodate the additional guest listed on your RSVP:
      </p>
      <div class="removed-box">
        <i>Guest removed from your party:</i><br>${removedName}
      </div>
      <p>
        We sincerely apologize for any inconvenience this may cause. We hope you understand that
        we have had to make some very difficult decisions to keep our guest list within the venue's
        limits.
      </p>
      <p>
        If you have any questions or concerns, please don't hesitate to reach out to us directly.
        We can't wait to share this wonderful day with you!
      </p>
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
  return (
    `Hi ${guestName}! This is Jonathan & Maribel. ` +
    `We're sorry, but due to venue capacity we're unable to accommodate your plus-one: ${removedName}. ` +
    `We apologize for the inconvenience and truly look forward to celebrating with you on June 12! ` +
    `For questions, please contact the couple directly. 💛`
  );
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  // Admin-only
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }

  const { rsvp_id, removed_name } = req.body || {};

  if (!rsvp_id || !removed_name) {
    return res.status(400).json({ success: false, message: 'rsvp_id and removed_name are required.' });
  }

  // Fetch the RSVP record to get guest contact info
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

  // ── Send email if available ──────────────────────────────────────────────
  if (rsvp.email) {
    try {
      const transporter = getTransporter();
      await transporter.sendMail({
        from: `"Jonathan & Maribel Wedding" <${process.env.GMAIL_USER}>`,
        to: rsvp.email,
        subject: 'Regarding Your RSVP – Jonathan & Maribel',
        html: buildEmailHtml({ guestName, removedName: removed_name }),
      });
      results.email = 'sent';
    } catch (err) {
      console.error('Email send error:', err.message);
      errors.push(`Email: ${err.message}`);
      results.email = 'failed';
    }
  }

  // ── Send SMS if available ────────────────────────────────────────────────
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
      message: 'This guest has no email or phone number on file — cannot send notification.',
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
