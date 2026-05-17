// api/reminders.js
// Sends wedding reminder notifications to ALL attending guests on schedule.
//
// Reminder schedule (Philippine Time, UTC+8):
//   May 29 7:00 AM  – 2 weeks before
//   Jun 05 7:00 AM  – 1 week before
//   Jun 09 7:00 AM  – 3 days before
//   Jun 12 7:00 AM  – Day of the wedding 🎉
//
// HOW TO TRIGGER:
//   Option A (Vercel Cron) — add to vercel.json:
//     { "crons": [{ "path": "/api/reminders", "schedule": "0 23 28,4,8,11 5,6 *" }] }
//     (23:00 UTC = 07:00 PHT the next day for May 28→29, Jun 4→5, Jun 8→9, Jun 11→12)
//
//   Option B (manual / test) — POST /api/reminders with admin session cookie.
//     The endpoint checks today's date and sends the appropriate reminder.
//     Add ?force=true to bypass date check during testing.
//
// Required env vars: same as notify.js
//   GMAIL_USER, GMAIL_APP_PASSWORD, SMS_GATEWAY_URL, SMS_GATEWAY_USER, SMS_GATEWAY_PASS
//   REMINDER_SECRET  – a shared secret so Vercel cron calls can authenticate

import nodemailer from 'nodemailer';
import { supabase, getSessionFromRequest } from './_supabase.js';

// ── Reminder schedule (PHT dates) ────────────────────────────────────────────
const REMINDERS = [
  { month: 5,  day: 29, label: '2 Weeks',  tagline: 'Only 2 weeks to go!' },
  { month: 6,  day:  5, label: '1 Week',   tagline: 'Just 1 week away!'   },
  { month: 6,  day:  9, label: '3 Days',   tagline: '3 days and counting!' },
  { month: 6,  day: 12, label: 'Today! 🎉', tagline: "It's the big day!"   },
];

function todayPHT() {
  // Returns { year, month (1-based), day } in Asia/Manila timezone
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  return { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
}

function getReminderForToday(force = false) {
  if (force) return REMINDERS[REMINDERS.length - 1]; // return last for testing
  const { month, day } = todayPHT();
  return REMINDERS.find(r => r.month === month && r.day === day) || null;
}

// ── Nodemailer ────────────────────────────────────────────────────────────────
function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

// ── SMS helper ────────────────────────────────────────────────────────────────
async function sendSMS(phone, message) {
  const gatewayUrl = process.env.SMS_GATEWAY_URL;
  if (!gatewayUrl) throw new Error('SMS_GATEWAY_URL not configured.');
  const user = process.env.SMS_GATEWAY_USER || 'admin';
  const pass = process.env.SMS_GATEWAY_PASS || '';
  const credentials = Buffer.from(`${user}:${pass}`).toString('base64');
  const normalized = phone.replace(/^0/, '+63').replace(/[^+\d]/g, '');

  const response = await fetch(`${gatewayUrl}/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({ phoneNumbers: [normalized], message }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SMS Gateway error ${response.status}: ${text}`);
  }
  return response.json();
}

// ── Email template ────────────────────────────────────────────────────────────
function buildReminderEmail({ guestName, reminder }) {
  const isWeddingDay = reminder.day === 12 && reminder.month === 6;
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Wedding Reminder – Jonathan & Maribel</title>
  <style>
    body { font-family: 'Georgia', serif; background: #faf9f7; margin: 0; padding: 0; }
    .wrap { max-width: 560px; margin: 40px auto; background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; overflow: hidden; }
    .header { background: #7d8e56; padding: 32px 40px; text-align: center; }
    .header h1 { color: #fff; font-size: 1.4rem; font-weight: 400; letter-spacing: .12em; text-transform: uppercase; margin: 0 0 4px; }
    .header .tag { color: rgba(255,255,255,.9); font-size: 1rem; font-style: italic; margin: 6px 0 0; }
    .body  { padding: 36px 40px; color: #3d3830; line-height: 1.7; }
    .body p { margin: 0 0 16px; }
    .detail-box { background: #f8f6f0; border-radius: 6px; padding: 18px 22px; margin: 22px 0; }
    .detail-box p { margin: 4px 0; font-size: .9rem; }
    .detail-box strong { color: #7d8e56; }
    .cta { text-align: center; margin: 24px 0 8px; }
    .cta a { background: #7d8e56; color: #fff; text-decoration: none; padding: 12px 28px; border-radius: 4px; font-family: sans-serif; font-size: .9rem; letter-spacing: .05em; }
    .footer { background: #f5f3ee; padding: 20px 40px; text-align: center; font-size: .78rem; color: #999; font-family: sans-serif; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="header">
      <h1>Jonathan &amp; Maribel</h1>
      <p class="tag">${reminder.tagline}</p>
    </div>
    <div class="body">
      <p>Dear <strong>${guestName}</strong>,</p>
      ${isWeddingDay
        ? `<p>Today is the day! We are overjoyed that you will be with us as we begin our forever together. 💛</p>
           <p>Please make sure to arrive on time and don't forget the dress code. We can't wait to see you!</p>`
        : `<p>
            Just a friendly reminder that the wedding of <strong>Jonathan & Maribel</strong> is
            coming up in <strong>${reminder.label}</strong>! We are so excited to celebrate
            this special day with you.
           </p>`
      }
      <div class="detail-box">
        <p><strong>📅 Date:</strong> June 12, 2026 (Friday)</p>
        <p><strong>⏰ Time:</strong> Ceremony begins at 3:00 PM</p>
        <p><strong>📍 Venue:</strong> Regina's Garden &amp; Restaurant</p>
        <p><strong>👗 Dress Code:</strong> Smart Casual / Semi-Formal</p>
      </div>
      <p>
        We kindly ask that you be fully present during the ceremony — please turn off your
        phone and cameras so we can all share the moment together. 📵
      </p>
      <p>With so much love,<br><strong>Jonathan &amp; Maribel</strong></p>
    </div>
    <div class="footer">
      You are receiving this because you RSVP'd to Jonathan &amp; Maribel's wedding.<br>
      For any concerns, please contact the couple directly.
    </div>
  </div>
</body>
</html>`;
}

function buildSmsText({ guestName, reminder }) {
  const isWeddingDay = reminder.day === 12 && reminder.month === 6;
  if (isWeddingDay) {
    return (
      `Hi ${guestName}! Today is the big day! 🎉 Jonathan & Maribel's wedding is today, ` +
      `June 12, 2026 at Regina's Garden & Restaurant. Ceremony starts at 3:00 PM. ` +
      `We can't wait to celebrate with you! 💛`
    );
  }
  return (
    `Hi ${guestName}! Friendly reminder: Jonathan & Maribel's wedding is in ${reminder.label}! ` +
    `📅 June 12, 2026 · ⏰ 3:00 PM · 📍 Regina's Garden & Restaurant. ` +
    `See you there! 💛`
  );
}

// ── Main handler ──────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  // Auth: accept either admin session cookie OR REMINDER_SECRET header
  const cronSecret = req.headers['x-reminder-secret'];
  const isValidCron = cronSecret && cronSecret === process.env.REMINDER_SECRET;
  const session = getSessionFromRequest(req);

  if (!isValidCron && !session) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }

  const force = req.query?.force === 'true' || req.body?.force === true;
  const reminder = getReminderForToday(force);

  if (!reminder) {
    return res.status(200).json({
      success: true,
      message: 'No reminder scheduled for today.',
      today: todayPHT(),
    });
  }

  // Fetch all attending guests with email or phone
  const { data: guests, error } = await supabase
    .from('rsvp')
    .select('id, guest_names, email, phone')
    .eq('attending', 'yes')
    .or('email.not.is.null,phone.not.is.null');

  if (error) {
    return res.status(500).json({ success: false, message: 'Database error fetching guests.' });
  }

  if (!guests || guests.length === 0) {
    return res.status(200).json({ success: true, message: 'No attending guests with contact info found.' });
  }

  const transporter = getTransporter();
  const summary = { total: guests.length, emailSent: 0, emailFailed: 0, smsSent: 0, smsFailed: 0 };

  for (const rsvp of guests) {
    const guestName = rsvp.guest_names
      ? rsvp.guest_names.split(',')[0].trim()
      : 'Guest';

    // Email
    if (rsvp.email) {
      try {
        await transporter.sendMail({
          from: `"Jonathan & Maribel Wedding" <${process.env.GMAIL_USER}>`,
          to: rsvp.email,
          subject: `Wedding Reminder – ${reminder.label} to Go! | Jonathan & Maribel`,
          html: buildReminderEmail({ guestName, reminder }),
        });
        summary.emailSent++;
      } catch (err) {
        console.error(`Email failed for rsvp ${rsvp.id}:`, err.message);
        summary.emailFailed++;
      }
    }

    // SMS
    if (rsvp.phone) {
      try {
        await sendSMS(rsvp.phone, buildSmsText({ guestName, reminder }));
        summary.smsSent++;
      } catch (err) {
        console.error(`SMS failed for rsvp ${rsvp.id}:`, err.message);
        summary.smsFailed++;
      }
    }
  }

  return res.status(200).json({
    success: true,
    reminder: reminder.label,
    summary,
    message: `Reminders sent. Emails: ${summary.emailSent} ok / ${summary.emailFailed} failed. SMS: ${summary.smsSent} ok / ${summary.smsFailed} failed.`,
  });
}
