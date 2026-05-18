// api/reminders.js
// Sends wedding reminder notifications to ALL attending guests on schedule.
//
// Reminder schedule (Philippine Time, UTC+8):
//   May 18 5:35 PM  - 25 days before  → cron: 35 9 18 5 *
//   May 29 7:00 AM  - 2 weeks before  → cron: 0 23 28 5 *
//   Jun 05 7:00 AM  - 1 week before   → cron: 0 23 4 6 *
//   Jun 09 7:00 AM  - 3 days before   → cron: 0 23 8 6 *
//   Jun 12 7:00 AM  - Wedding day     → cron: 0 23 11 6 *
//
// Required env vars:
//   GMAIL_USER, GMAIL_APP_PASSWORD
//   HTTPSMS_API_KEY, HTTPSMS_FROM
//   REMINDER_SECRET  - shared secret to protect cron endpoint

import nodemailer from 'nodemailer';
import { supabase, getSessionFromRequest } from './_supabase.js';

const REMINDERS = [
  { month: 5,  day: 18, label: '25 Days',   tagline: 'Only 25 days to go!' },
  { month: 5,  day: 29, label: '2 Weeks',   tagline: 'Only 2 weeks to go!'  },
  { month: 6,  day:  5, label: '1 Week',    tagline: 'Just 1 week away!'    },
  { month: 6,  day:  9, label: '3 Days',    tagline: '3 days and counting!' },
  { month: 6,  day: 12, label: 'Today!',    tagline: "It's the big day!"    },
];

function todayPHT() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  return { month: now.getMonth() + 1, day: now.getDate() };
}

function getReminderForToday(force) {
  if (force) return REMINDERS[REMINDERS.length - 1];
  const { month, day } = todayPHT();
  return REMINDERS.find(r => r.month === month && r.day === day) || null;
}

function getTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

async function sendSMS(phone, message) {
  const apiKey = process.env.HTTPSMS_API_KEY;
  const from   = process.env.HTTPSMS_FROM;

  if (!apiKey) throw new Error('HTTPSMS_API_KEY is not configured.');
  if (!from)   throw new Error('HTTPSMS_FROM is not configured.');

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

function buildReminderEmail({ guestName, reminder }) {
  const isWeddingDay = reminder.day === 12 && reminder.month === 6;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Wedding Reminder - Jonathan & Maribel</title>
  <style>
    body { font-family: Georgia, serif; background: #faf9f7; margin: 0; padding: 0; }
    .wrap { max-width: 560px; margin: 40px auto; background: #fff; border: 1px solid #e8e4dc; border-radius: 8px; overflow: hidden; }
    .header { background: #7d8e56; padding: 32px 40px; text-align: center; }
    .header h1 { color: #fff; font-size: 1.4rem; font-weight: 400; letter-spacing: .12em; text-transform: uppercase; margin: 0 0 4px; }
    .header .tag { color: rgba(255,255,255,.9); font-size: 1rem; font-style: italic; margin: 6px 0 0; }
    .body { padding: 36px 40px; color: #3d3830; line-height: 1.7; }
    .body p { margin: 0 0 16px; }
    .detail-box { background: #f8f6f0; border-radius: 6px; padding: 18px 22px; margin: 22px 0; }
    .detail-box p { margin: 4px 0; font-size: .9rem; }
    .detail-box strong { color: #7d8e56; }
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
        ? `<p>Today is the day! We are overjoyed that you will be with us as we begin our forever together.</p>
           <p>Please make sure to arrive on time and don't forget the dress code. We can't wait to see you!</p>`
        : `<p>Just a friendly reminder that the wedding of <strong>Jonathan &amp; Maribel</strong> is coming up in <strong>${reminder.label}</strong>! We are so excited to celebrate this special day with you.</p>`
      }
      <div class="detail-box">
        <p><strong>Date:</strong> June 12, 2026 (Friday)</p>
        <p><strong>Time:</strong> Ceremony begins at 3:00 PM</p>
        <p><strong>Venue:</strong> Regina's Garden &amp; Restaurant</p>
        <p><strong>Dress Code:</strong> Smart Casual / Semi-Formal</p>
      </div>
      <p>We kindly ask that you be fully present during the ceremony — please turn off your phone and cameras so we can all share the moment together.</p>
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
    return `Hi ${guestName}! Today is the big day! Jonathan & Maribel's wedding is TODAY, June 12 at Regina's Garden & Restaurant. Ceremony starts at 3:00 PM. We can't wait to celebrate with you!`;
  }
  return `Hi ${guestName}! Reminder: Jonathan & Maribel's wedding is in ${reminder.label}! Date: June 12, 2026 | Time: 3:00 PM | Venue: Regina's Garden & Restaurant. See you there!`;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  // Auth: admin session OR REMINDER_SECRET header (for Vercel cron)
  const cronSecret   = req.headers['x-reminder-secret'];
  const isValidCron  = cronSecret && cronSecret === process.env.REMINDER_SECRET;
  const session      = getSessionFromRequest(req);

  if (!isValidCron && !session) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }

  const force    = req.query?.force === 'true' || req.body?.force === true;
  const reminder = getReminderForToday(force);

  if (!reminder) {
    return res.status(200).json({
      success: true,
      message: 'No reminder scheduled for today.',
      today: todayPHT(),
    });
  }

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

    if (rsvp.email) {
      try {
        await transporter.sendMail({
          from: `"Jonathan & Maribel Wedding" <${process.env.GMAIL_USER}>`,
          to: rsvp.email,
          subject: `Wedding Reminder - ${reminder.label} to Go! | Jonathan & Maribel`,
          html: buildReminderEmail({ guestName, reminder }),
        });
        summary.emailSent++;
      } catch (err) {
        console.error(`Email failed for rsvp ${rsvp.id}:`, err.message);
        summary.emailFailed++;
      }
    }

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