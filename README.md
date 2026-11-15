# JACT Motorcycle Website

A mobile-friendly, multi-page JACT Motorcycle website with a public spare-parts catalogue, service booking requests and a private admin area.

## Included files

- `index.html` — Home
- `about.html` — About JACT
- `services.html` — Services
- `shop.html` / `shop.js` — Spare-parts catalogue, enquiry basket and order requests
- `booking.html` / `booking.js` — Online service booking request form
- `contact.html` — Contact information
- `config.js` — Supabase and WhatsApp configuration
- `styles.css` / `app.js` — Shared styling and helpers
- `schema.sql` — Supabase database tables and Row Level Security policies
- `admin/` — Private JACT admin login, dashboard, products/stock and bookings

## 1. Upload to GitHub Pages

1. Create a GitHub repository for JACT Motorcycle.
2. Upload **all files and folders in this ZIP**, keeping the same structure.
3. Make sure `index.html` is in the repository root (not inside an extra nested folder).
4. In GitHub, open **Settings → Pages**.
5. Choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
6. GitHub Pages hosts the public site and the admin pages. The admin folder is not a security boundary; the database security is enforced by Supabase Authentication and RLS.

## 2. Configure Supabase

1. Create a Supabase project.
2. Open **SQL Editor** and run the entire `schema.sql`.
3. Open **Project Settings → API** (or API Keys).
4. Copy the Project URL and the anon/public or publishable key.
5. Open `config.js` and replace:
   - `PASTE_SUPABASE_PROJECT_URL_HERE`
   - `PASTE_SUPABASE_ANON_OR_PUBLISHABLE_KEY_HERE`
6. Keep the anon/publishable key only. **Never put the `service_role` key in this website or GitHub.**

## 3. Create the JACT administrator

1. In Supabase, open **Authentication → Users**.
2. Create or invite the email account that JACT has authorised to manage the website. The admin email should be controlled by JACT, not a public customer email.
3. Confirm the account if Supabase requires it.
4. Open SQL Editor and run the final admin insert statement shown at the bottom of `schema.sql`, replacing `JACT_ADMIN_EMAIL@example.com` with that exact authorised email.
5. Admin signs in at `https://YOUR-GITHUB-PAGES-ADDRESS/admin/login.html`.
6. Only a user whose auth ID is present in `admin_users` can access admin data or manage stock/bookings. Do not add a public registration page.

## 4. WhatsApp number

The number is already set in `config.js` as `27676259831` (067 625 9831). It can be changed there if JACT supplies a different business number.

## 5. How it works

- Visitors can browse active parts in `shop.html`.
- Visitors can submit a booking request in `booking.html`.
- Booking requests are stored in Supabase and appear in `admin/bookings.html`.
- JACT admins can add, edit, hide and delete spare-parts listings and update stock in `admin/products.html`.
- Visitors can submit a parts order enquiry. JACT confirms stock, pricing and arrangements directly.
- Admin access is protected by Supabase Auth and database RLS, not by hiding the admin URL.

## Important notes before going live

- Add the real products, prices, images and stock quantities in the admin dashboard.
- Confirm the business wording, operating area, exact services and contact details with JACT before publishing.
- Booking duplicate checking in the browser is a helpful check, not a guaranteed database-level lock. Confirm each booking with the customer.
- The order form records an enquiry; it does not process card payments or automatically deduct stock.
- The design uses a remote Unsplash hero image and Google Fonts. The site needs an internet connection for those assets and the Supabase CDN.
