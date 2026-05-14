# Migration Guide: InfinityFree → Vercel + Supabase
## Johndy & Ianjean Wedding RSVP Website

---

## What Changed

| Old (PHP/InfinityFree)       | New (JS/Vercel+Supabase)           |
|------------------------------|------------------------------------|
| config.php                   | api/_supabase.js (shared helper)   |
| php/submit_rsvp.php          | api/submit_rsvp.js                 |
| php/get_rsvp.php             | api/get_rsvp.js                    |
| php/get_wishes.php           | api/get_wishes.js                  |
| php/logout.php               | api/logout.js                      |
| login.php (PHP session)      | api/login.js (cookie token)        |
| index.php                    | public/index.html                  |
| invitation.php               | public/invitation.html             |
| our-story.php                | public/our-story.html              |
| login.php (HTML part)        | public/login.html                  |
| admin.php                    | public/admin.html                  |
| MySQL database               | Supabase PostgreSQL                |
| PHP $_SESSION                | Signed cookie token (HMAC-SHA256)  |
| glob() for gallery images    | JS array in invitation.html        |

---

## New Project Structure

```
wedding-vercel/
├── api/
│   ├── _supabase.js        <- DB client + session helpers (shared)
│   ├── submit_rsvp.js      <- POST: guest submits RSVP
│   ├── check_rsvp.js       <- GET:  has this IP submitted?
│   ├── get_rsvp.js         <- GET:  admin — all RSVPs
│   ├── get_wishes.js       <- GET:  admin — all wishes
│   ├── login.js            <- POST: admin login
│   ├── logout.js           <- GET:  clears session cookie
│   ├── auth_check.js       <- GET:  is session valid?
│   └── admin_stats.js      <- GET:  dashboard stats
├── public/
│   ├── index.html
│   ├── invitation.html
│   ├── our-story.html
│   ├── login.html
│   ├── admin.html
│   ├── css/
│   │   ├── style.css       <- COPY from your old site (unchanged)
│   │   └── admin.css       <- COPY from your old site (unchanged)
│   ├── images/             <- COPY from your old site (unchanged)
│   ├── fonts/              <- COPY from your old site (unchanged)
│   └── music/              <- COPY from your old site (unchanged)
├── supabase_schema.sql
├── package.json
└── vercel.json
```

---

## STEP 1 — Set up Supabase

1. Go to https://supabase.com and sign up / log in
2. Click "New Project"
   - Name: wedding-rsvp
   - Database Password: create a strong one and save it
   - Region: Singapore (closest to Philippines)
3. Wait about 1 minute for the project to be ready
4. Go to SQL Editor (left sidebar) → New Query
5. Copy the entire contents of supabase_schema.sql, paste it, and click Run
6. You should see "Success. No rows returned"

Get your API keys:
- Go to Project Settings → API
- Copy these (you will need them in Step 4):
  - "Project URL" → this is SUPABASE_URL
  - "service_role" key under "Project API Keys" → this is SUPABASE_SERVICE_KEY
  - IMPORTANT: Keep the service_role key secret — never put it in frontend HTML/JS

---

## STEP 2 — Copy your assets into the new project

Before pushing to GitHub, copy these files from your old InfinityFree site:

  Old location             →   New location
  css/style.css            →   public/css/style.css
  css/admin.css            →   public/css/admin.css
  images/couple/           →   public/images/couple/
  images/gallery/          →   public/images/gallery/
  images/attire/           →   public/images/attire/
  fonts/QuillStd.woff2     →   public/fonts/QuillStd.woff2
  music/wedding_song.mp3   →   public/music/wedding_song.mp3

How to download files from InfinityFree:
- Log in to your InfinityFree cPanel → File Manager
- Select all your wedding files → Download as ZIP
- Extract and copy the folders listed above into the public/ folder

---

## STEP 3 — Set up your GitHub repository

1. Go to https://github.com and click "New repository"
   - Name: wedding-rsvp
   - Set it to Private (recommended)
   - Do NOT check "Add a README file"
2. Open a terminal on your computer and run these commands:

   cd path/to/wedding-vercel

   git init
   git add .
   git commit -m "Initial commit - migrated from PHP to Vercel"

   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/wedding-rsvp.git
   git branch -M main
   git push -u origin main

Replace YOUR_GITHUB_USERNAME with your actual GitHub username.

---

## STEP 4 — Deploy to Vercel

1. Go to https://vercel.com and sign up with your GitHub account
2. Click "Add New Project" → "Import Git Repository"
3. Find wedding-rsvp and click Import
4. Leave all build settings as default (Framework Preset: Other)
5. Open the "Environment Variables" section and add these 3 variables:

   Variable name          Value
   SUPABASE_URL           (your Project URL from Step 1)
   SUPABASE_SERVICE_KEY   (your service_role key from Step 1)
   SESSION_SECRET         (any long random phrase, e.g.: MyWedding2026Digos!Secret#JI)

6. Click Deploy
7. Wait about 1 minute — Vercel will give you a URL like:
   https://wedding-rsvp.vercel.app

---

## STEP 5 — Update your gallery image lists

Since Vercel is static hosting, the gallery cannot auto-scan folders the way PHP did.
You need to list your image filenames manually in two files.

In public/invitation.html, find this comment and update the array:

   // STAR ADD YOUR GALLERY IMAGE FILENAMES HERE STAR
   const galleryImages = [
     'images/gallery/photo1.jpg',
     'images/gallery/photo2.jpg',
     'images/gallery/photo3.jpg',
     // Add more: 'images/gallery/photo4.jpg',
   ];

In public/our-story.html, find this comment and update:

   // STAR ADD YOUR COUPLE/GALLERY PHOTOS HERE STAR
   const couplePhotos = [
     'images/couple/groom.jpg',
     'images/couple/bride.jpg',
     'images/couple/couple_home.jpg',
     'images/gallery/photo1.jpg',
     // Add more as needed
   ];

Use the exact filenames of your images. After updating, commit and push:

   git add .
   git commit -m "Update gallery image list"
   git push

Vercel will redeploy automatically in about 30 seconds.

---

## STEP 6 — Test everything

Visit your Vercel URL and verify these work:

  [ ] Landing card page loads (index.html)
  [ ] Tapping the wax seal → curtain opens → invitation page loads
  [ ] RSVP form submits and shows success message
  [ ] Supabase Table Editor shows the new entry in the rsvp table
  [ ] /login.html loads and accepts: admin / 1234asdfg
  [ ] Admin dashboard shows correct stats
  [ ] RSVP responses table loads and filters work
  [ ] CSV export downloads correctly
  [ ] Logout works and redirects to login page
  [ ] /our-story.html loads with music button
  [ ] Gallery images show on invitation page

---

## STEP 7 — Change the admin password (Important!)

The default password is 1234asdfg — change it right away.

1. Go to https://bcrypt-generator.com
2. Enter your new password, use 10 rounds, click "Generate"
3. Copy the generated hash (it starts with $2y$ or $2b$)
4. Go to Supabase → SQL Editor → New Query and run:

   UPDATE admin_users
   SET password = 'PASTE_YOUR_HASH_HERE'
   WHERE username = 'admin';

5. Test that the new password works before closing the tab

---

## STEP 8 (Optional) — Add a custom domain

1. In your Vercel project → Settings → Domains
2. Click "Add Domain" and enter your domain (e.g. johndyandianjean.com)
3. Follow the DNS instructions Vercel gives you for your domain registrar
4. Wait up to 24 hours for DNS to propagate (usually much faster)

---

## Migrating existing RSVP data from InfinityFree

If you already have RSVPs in your InfinityFree MySQL database:

1. In cPanel → phpMyAdmin → select your database → rsvp table
2. Click Export → Format: CSV → Go → save the file
3. In Supabase → Table Editor → rsvp table → click Import data
4. Upload the CSV file
5. Make sure the column names match: ip_address, num_guests, guest_names, message, submitted_at

---

## Making future updates

After the initial deploy, any change is just 3 commands:

   git add .
   git commit -m "describe your change here"
   git push

Vercel picks up the push and redeploys in about 30 seconds automatically.

---

## Troubleshooting

Problem                         Solution
API returns 401 Unauthorized    Session expired — log in to admin again
Gallery shows placeholders      Update the galleryImages array with correct filenames
Login fails (correct password)  Re-run supabase_schema.sql to reset admin user
Music does not autoplay         Normal — browser blocks autoplay. User must tap first
Images not showing              Filenames are case-sensitive. Check spelling exactly
Curtain does not open           Confirm links point to .html files not .php files
RSVP submit fails               Check Vercel Logs (Vercel dashboard) for the error message
