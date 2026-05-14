// api/check_rsvp.js
// This endpoint is intentionally a no-op now.
// Same-device detection is handled entirely by browser localStorage.
// The server only validates on actual RSVP submission (submit_rsvp.js).

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({ submitted: false, attending: null });
}
