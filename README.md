# Jade Physio: booking, checkout & vouchers

A mobile-friendly front-desk system for Jade Physio, in Bahasa Indonesia.
Built with Next.js 16 (App Router), React 19, Tailwind CSS 4 and Firebase (Auth + Firestore).

## What's inside

| Menu | What it does |
| --- | --- |
| **Kalender** | One column per therapist. A therapist can hold several patients at the same time (overlapping bookings sit side by side). Tap an empty slot to book, or use *Sekarang (walk-in)*. Status: Menunggu → Sedang sesi → Lunas. |
| **Checkout** | Pay with QRIS, transfer bank or kartu. A customer's voucher is applied automatically when it covers the service. A package can be bought and its first session used in the same checkout. Discount and payment reference supported. |
| **Pelanggan** | Customer list and profile: prepaid sessions, visit history, invoices, WhatsApp button. Sell a package or add a manual voucher (for moving balances over from Zenwel). |
| **Voucher** | All prepaid packages, remaining sessions (shown as jade beads), usage history, and the value of prepaid sessions not yet served. |
| **Faktur** | Invoice list with date range, search, method/status filters and CSV export. Each invoice can be printed (A5), sent via WhatsApp, or cancelled (admin only). Cancelling returns voucher sessions and resets the booking. |
| **Laporan** | Income, average per transaction, sessions served, packages sold, daily/hourly chart, payment methods, per therapist, per service. |
| **Katalog** | Services (name, duration, price) and session packages (sessions, price, eligible services, validity). |
| **Terapis & akses** | Therapist calendar columns, and who can log in with which role. |

## Roles

| | Admin | Staf kasir | Terapis |
| --- | :-: | :-: | :-: |
| Calendar: see schedule | ✓ | ✓ | own column (can switch to all) |
| Create / edit / cancel bookings | ✓ | ✓ | – |
| Start a session | ✓ | ✓ | own patients only |
| Customers: view | ✓ | ✓ | ✓ (no money shown) |
| Customers: add / edit | ✓ | ✓ | – |
| Checkout & sell packages | ✓ | ✓ | – |
| Vouchers page, invoices | ✓ | ✓ | – |
| Manual voucher, void voucher | ✓ | – | – |
| Cancel an invoice | ✓ | – | – |
| Reports, catalog, access | ✓ | – | – |

The same rules are enforced server-side in `firestore.rules`, so the menu hiding is not the only protection.

## Setup

1. **Install**: Node 20+ required.
   ```bash
   npm install
   ```
2. **Firebase config** is already in `.env.local` (project `jade-physio`).
3. In the [Firebase console](https://console.firebase.google.com/project/jade-physio):
   - *Authentication → Sign-in method*: enable **Email/Password**.
   - *Firestore Database*: create the database (production mode, region `asia-southeast2` Jakarta recommended).
4. **Deploy the security rules** (once, and again whenever `firestore.rules` changes):
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use jade-physio
   firebase deploy --only firestore:rules
   ```
5. **Run**:
   ```bash
   npm run dev      # http://localhost:3000
   ```
6. Open the app and click **Daftar**. **The first account ever created becomes the admin.**
   On the empty calendar, *Isi contoh awal* adds sample therapists, services and packages, which you can then edit in Katalog.
7. Add everyone else in **Terapis & akses → Akses login**: enter their email, pick a role (and for a therapist, their calendar column).
   They then open the app, choose **Daftar**, and create a password with that same email.

## Moving from Zenwel

For customers who still have sessions left in Zenwel, open the customer → **Voucher manual**.
Pick the package, fill in *Sudah terpakai* (sessions already used), and add a note such as the old invoice number.
This creates the voucher without an invoice, so it doesn't count as income twice.

## Demo mode

To try the app without touching real data, set `NEXT_PUBLIC_DEMO_MODE=1` in `.env.local` and restart.
It loads sample data into the browser (no login, no Firebase), and the sidebar lets you switch between Admin, Kasir and Terapis to preview each role.

## Deploying

The easiest host is **Vercel**: import the repo, add the `NEXT_PUBLIC_FIREBASE_*` variables from `.env.local`, deploy.
Then in Firebase *Authentication → Settings → Authorized domains*, add your Vercel domain.

## Business details on invoices

Edit `BUSINESS` in `src/lib/format.ts` (name, address, phone, opening hours used by the calendar).

## Data model (Firestore)

- `access/{email}`: `{ role: 'admin' | 'staff' | 'therapist', name, staffId? }`
- `staff`, `services`, `packages`: catalogue
- `customers`, `bookings` (`dateKey` = `YYYY-MM-DD`, `status`)
- `vouchers`: prepaid sessions per customer, with `redemptions[]`
- `sales`: invoices (`INV/2026/00001`, numbered per year via `meta/counters` inside a transaction)

No composite indexes are needed.
