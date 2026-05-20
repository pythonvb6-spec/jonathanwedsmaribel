// api/reminders.js
// Sends wedding reminder notifications to ALL attending guests.
// Triggered manually by the admin via the admin portal.
//
// Required env vars:
//   GMAIL_USER, GMAIL_APP_PASSWORD
//   HTTPSMS_API_KEY, HTTPSMS_FROM

import nodemailer from 'nodemailer';
import { supabase, getSessionFromRequest } from './_supabase.js';

const WEDDING_DATE = { year: 2026, month: 6, day: 12 };

function getReminderLabel() {
  const now  = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const wedding = new Date(WEDDING_DATE.year, WEDDING_DATE.month - 1, WEDDING_DATE.day);
  const diff = Math.round((wedding - today) / (1000 * 60 * 60 * 24));

  if (diff <= 0)  return { label: 'Today!',   tagline: "It's the big day!",       isWeddingDay: true  };
  if (diff === 1) return { label: 'Tomorrow!', tagline: 'Just 1 day to go!',      isWeddingDay: false };
  if (diff <= 6)  return { label: `${diff} Days`, tagline: `Only ${diff} days to go!`, isWeddingDay: false };
  if (diff <= 13) return { label: '1 Week',    tagline: 'Just 1 week away!',      isWeddingDay: false };
  if (diff <= 20) return { label: '2 Weeks',   tagline: 'Only 2 weeks to go!',    isWeddingDay: false };
  return               { label: `${diff} Days`, tagline: `${diff} days until the big day!`, isWeddingDay: false };
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

function buildReminderEmail({ guestName, label, tagline, isWeddingDay }) {
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
      <p class="tag">${tagline}</p>
    </div>
    <div class="body">
      <p>Dear <strong>${guestName}</strong>,</p>
      ${isWeddingDay
        ? `<p>Today is the day! We are overjoyed that you will be with us as we begin our forever together.</p>
           <p>Please make sure to arrive on time and don't forget the dress code. We can't wait to see you!</p>`
        : `<p>Just a friendly reminder that the wedding of <strong>Jonathan &amp; Maribel</strong> is coming up in <strong>${label}</strong>! We are so excited to celebrate this special day with you.</p>`
      }
      <div class="detail-box">
        <p><strong>Date:</strong> June 12, 2026 (Friday)</p>
        <p><strong>Time:</strong> 3:00 PM (for Immediate Family & Sponsors only)<br>5:00 PM (for All Guests)</p>
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

function buildSmsText({ guestName, label, isWeddingDay }) {
  if (isWeddingDay) {
    return `Hi ${guestName}! Today is the big day! Jonathan & Maribel's wedding is TODAY, June 12 at Regina's Garden & Restaurant. Ceremony starts at 3:00 PM (for Immediate Family and Sponsors only). Event starts at 5:00 PM (for All Guests). We can't wait to celebrate with you!`;
  }
  return `Hi ${guestName}! Reminder: Jonathan & Maribel's wedding is in ${label}! Date: June 12, 2026 | Ceremony Time: 3:00 PM (for Immediate Family and Sponsors only) | Event Time: 5:00 PM (for All Guests) | Venue: Regina's Garden & Restaurant. See you there!`;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed.' });
  }

  // Auth: admin session only
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ success: false, message: 'Unauthorized.' });
  }

  const { label, tagline, isWeddingDay } = getReminderLabel();

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
          subject: `Wedding Reminder — ${label} | Jonathan & Maribel`,
          html: buildReminderEmail({ guestName, label, tagline, isWeddingDay }),
        });
        summary.emailSent++;
      } catch (err) {
        console.error(`Email failed for rsvp ${rsvp.id}:`, err.message);
        summary.emailFailed++;
      }
    }

    if (rsvp.phone) {
      try {
        await sendSMS(rsvp.phone, buildSmsText({ guestName, label, isWeddingDay }));
        summary.smsSent++;
      } catch (err) {
        console.error(`SMS failed for rsvp ${rsvp.id}:`, err.message);
        summary.smsFailed++;
      }
    }
  }

  // Record the send date in Supabase so all devices see the lock
  const allOk = summary.emailFailed === 0 && summary.smsFailed === 0;
  if (allOk) {
    const todayPHT = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    await supabase
      .from('settings')
      .upsert({ key: 'last_reminder_sent_date', value: todayPHT }, { onConflict: 'key' });
  }

  return res.status(200).json({
    success: true,
    reminder: label,
    summary,
    message: `Reminders sent. Emails: ${summary.emailSent} ok / ${summary.emailFailed} failed. SMS: ${summary.smsSent} ok / ${summary.smsFailed} failed.`,
  });
}