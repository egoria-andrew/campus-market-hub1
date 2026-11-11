# Campus Market Hub — Lecturer Demo Prototype

An academic demonstration of a student marketplace for the Gulu University community. This is an independent prototype workspace; it does not change the production requirements or SRS.

## Run it

Requires Python 3.10+ and a modern browser. No package installation is needed.

1. Double-click `start_demo.bat` in this folder. Keep its terminal window open while using the site.
2. The launcher opens the browser at the address shown in the terminal. It tries port 5500 first and falls back to port 8000 if 5500 is already in use.

You can also run `python server.py` from a terminal opened in this folder. Keep that terminal open until you finish the demo; closing it stops the site.

The first start creates `campus_market.db` and seeds sample listings and two demo accounts. Stop the server with Ctrl+C. The database file stores demo changes between runs; remove it if you want to restore the original sample state.

## Demo accounts

- Vendor: `vendor@campus.demo` / `campus123`
- Student: `student@campus.demo` / `campus123`

Sign in using the account button. For vendor management, sign in with the vendor account and select the account button to open Vendor Studio. Add a listing, then see it appear in the marketplace. Adjust stock from the listing panel. Students can search, filter, open a product, add it to the bag, and place a demo order. Use Orders to see the submitted order.

The mobile layout has a fixed bottom app bar for Shop, Lost & Found, Events, Bag and Account. Lost & Found lets signed-in users publish Lost or Found notices with the item, details, campus location and contact email. Campus Events shows sample events, lets users RSVP, and allows signed-in users to share a campus event. These posts and RSVPs are stored in the local SQLite database.

Vendors can add an optional JPG, PNG, WEBP or GIF product photo (up to 5 MB), and can replace photos on items in the demo catalogue from Vendor Studio. Images are stored in the local `uploads` folder.

## What is implemented

- Responsive, mobile-first marketplace with navy and orange brand colors sampled from the Campus Market Hub logo.
- Product search, category filters, price sorting, listing details and seller information.
- Registration and sign-in for student and vendor roles, with local demo sessions.
- Persistent SQLite products, stock and order records.
- Vendor product creation and stock management.
- Cart and order creation with stock decrement and order history.
- Lost & Found notices and campus event listings, sharing and RSVPs.
- Mobile app-style bottom navigation and responsive community cards.
- Vendor product photo upload and replacement.

## Architecture

- `server.py`: Python standard-library HTTP server and JSON API; SQLite database access, seed data, demo accounts, registration, sign-in, product CRUD, stock updates and order creation.
- `index.html`, `style.css`, `community.css`, `photo.css`, `app.js`: responsive browser interface and client-side marketplace and community behavior.
- `campus_market.db`: generated local database, created on first launch.
- `uploads/`: generated folder containing uploaded product images.

The API is served from the same local origin as the frontend. It uses JSON endpoints under `/api/`; no separate frontend build step is needed.

## Simulated and out of scope

Payment is not collected. An order means “request received”; students arrange pickup/payment with the seller. There is no live SMS/email, institutional identity verification, cloud hosting, production-grade authorization, password reset, moderation, multi-campus support or production security review. Accounts and sessions are for local demonstration only. Do not use real passwords or personal data.

This is an academic MVP demonstration, not production-ready software.

## Hosting notes

`render.yaml` is set up for Render's free web-service tier. This is suitable for a temporary lecturer preview, but its filesystem is temporary: uploaded photos, local SQLite changes and user activity can disappear when the service sleeps, restarts or redeploys. Public hosting is for a lecturer demonstration only: demo credentials are intentionally visible, registration and sessions are basic, and this app has not had a production security review. Do not enter real personal data or use it for real transactions.
