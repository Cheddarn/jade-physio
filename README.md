# Jade Physio: booking, checkout & vouchers

A mobile-friendly front-desk system for Jade Physio, in Bahasa Indonesia.
Built with Next.js 16 (App Router), React 19, Tailwind CSS 4 and Firebase (Auth + Firestore).

## What's inside

The sidebar is grouped into **Operasional**, **Tim & klinik**, **Keuangan & laporan** and **Pengaturan**.
Press **Ctrl K** (or **/**) anywhere, or tap *Cari* in the sidebar or on *Lainnya*, to search patients by name, phone or No. RM, jump to any page, or start a common action (*Pasien datang*, *Booking baru*, *Transaksi baru*, *Pengingat jadwal besok*, *Ajukan restock*).

| Menu | What it does |
| --- | --- |
| **Alur pasien** | The live walk-in board, and everyone's home screen. Front desk taps *Pasien datang* (patient gender, how many people need slippers, male/female therapist needed, short complaint). Cleaning service and the matching therapists get an alert right away. The board tracks each patient: shoes changed (with rack no.), registration form, therapist & bed, session, shoes returned. A **bed map** (*Denah*) laid out like the clinic (Ruang 1: beds 1-2 along the back wall, 3-5 in front of them; Ruang 2: beds 6-7) shows who is on which bed with which therapist. A 3D version exists but is switched off for now (`SHOW_3D` in `src/app/(app)/alur/page.tsx`). |
| **Booking saya** (patients) | Patient portal. Patients sign up themselves (*Daftar → Pasien*), add the people on their account (name, phone, gender, relation), and book one or more of them at once, each with their own complaint and preferred physio. The front desk confirms; the patient sees the status live. |
| **Laporan terapi** | Physios must write a report for every finished session (alert + red badge until done): complaint, findings, treatment, home advice, next visit, plus an optional PDF/JPG/PNG upload. Front desk downloads it, opens a printable PDF, or sends it by WhatsApp (summary + PDF link). *Salin daftar pasien* copies today's patient list as text. |
| **Jadwal kerja** | Clock in / *Pulang* for every staff member (sidebar and *Lainnya*), with the exact time (hour and minute) in and out and hours worked ("8 jam 12 menit"). Managers see a daily table (shift, masuk, pulang, lama kerja, status), can correct a wrong or forgotten clock-out (overtime is recalculated), and download the month as CSV for payroll. Each person's shift per weekday; time past the shift end counts as overtime (5 min grace), shown live and confirmed at *Pulang* with an optional note. Monthly overtime summary. Clinic opening hours per weekday. |
| **Restock** | Any staff member requests an item (qty, unit, category, urgent, note). Listed per day, grouped by month. Anyone ticks it off when bought; *Salin daftar belanja* merges open items into a shopping list. |
| **Ringkasan** | For admin and manager/supervisor: walk-ins, sessions, waiting time, income, packages sold, report completion, overtime, open restock, online bookings, expiring packages, per-physio table, and a timeline of everything that happened (filterable). |
| **Kalender** | Tap the date title to open a month calendar (with booking counts per day) and jump to any date. The slot under the mouse is highlighted before you click to book. Opening hours follow the weekday, and time outside a physio's shift is shaded. Patients' online booking requests show as dashed blocks and under *Permintaan*. One column per therapist. *Pengingat* lists tomorrow's bookings (or the day shown, if later) with a WhatsApp *Ingatkan* button per patient: the message has the day, time, service and physio, and the booking is marked as reminded so nobody gets it twice. On phones the calendar opens as a list; switch to *Jadwal* for the columns (remembered). A therapist can hold several patients at the same time (overlapping bookings sit side by side). Tap an empty slot or *Booking baru* to book: the form opens in the middle of the screen in four short steps (Pasien → Paket → Jadwal & terapis → Konfirmasi), so nothing needs scrolling. The *Paket* step lists the patient's own packages (*Pakai*, with sessions left) and the packages from Katalog; a package sold this way is added at checkout and pays for this session as its first. If a package covers several services, the step asks which one; with no packages in Katalog it lists services instead. Picking moves straight on, and the last step shows a summary with *Ubah* links. Walk-ins: *Sekarang (walk-in)* on the Jadwal step. Status: Menunggu → Sedang sesi → Lunas. |
| **Checkout** | Pay with QRIS, transfer bank or kartu. A customer's voucher is applied automatically when it covers the service. A package can be bought and its first session used in the same checkout. Discount and payment reference supported. |
| **Pelanggan** | Each patient profile has **Riwayat sesi** (every session numbered "Sesi ke-N" with date, time, service, physio, bed, complaint, how it was paid: package "sesi 3/5" or amount and invoice, therapy report link; upcoming and cancelled sessions; summary) and **Riwayat pembelian** (every transaction itemised with discounts, packages and the vouchers they created, sessions paid by package, payment method, invoice and online receipt links, manual packages from the old system, totals and CSV). Physios see the session history without amounts; purchases are for the front desk and managers. Filters: *Punya sesi prabayar*, *Paket hampir kedaluwarsa* (window 3 days to 2 months, default set by a manager) with a WhatsApp *Ingatkan* button that also records when the patient was reminded, and *Belum isi formulir*. Customer list and profile: prepaid sessions, visit history, invoices, WhatsApp button. Sell a package or add a manual voucher (for moving balances over from Zenwel). |
| **Voucher** | All prepaid packages, remaining sessions (shown as jade beads), usage history, and the value of prepaid sessions not yet served. |
| **Faktur** | Every transaction gets an online receipt (resi) link, e.g. `https://your-domain/resi/x7k2…`, shown after checkout with *Salin link* / *Kirim WA*, and on each invoice (older invoices: *Buat link resi*). The receipt opens on any phone without logging in, shows items, discounts and total, and turns into "dibatalkan" if the invoice is voided. Invoice list with date range, search, method/status filters and CSV export. Each invoice can be printed (A5), sent via WhatsApp, or cancelled (admin only). Cancelling returns voucher sessions and resets the booking. |
| **Laporan** | Income, average per transaction, sessions served, packages sold, daily/hourly chart, payment methods, per therapist, per service. |
| **Katalog** | **Diskon** (manager/admin): percent (with optional cap) or flat rupiah, for services, packages, the whole transaction, or all; optional end date. The front desk picks from these at checkout, per item (packages too) and/or on the total; only managers can type a manual discount. Services (name, duration, price) and session packages (1, 3, 5... sessions, price, eligible services, validity with presets from 1 week to 1 year). Checkout records who sold each package (*Dijual oleh*); *Laporan* shows package sales per staff member. |
| **Terapis & akses** | Therapist calendar columns, and who can log in with which role. |

## Roles

| | Admin (front desk) | Manajer / supervisor | Fisioterapis | Cleaning service | Pasien |
| --- | :-: | :-: | :-: | :-: | :-: |
| Alur pasien: board and bed map | ✓ | ✓ | ✓ | ✓ | – |
| Check in, registration form, assign therapist & bed | ✓ | ✓ | – | – | – |
| Shoes changed / returned | ✓ | ✓ | – | ✓ | – |
| Start / finish a session | ✓ | ✓ | own patients | – | – |
| Therapy reports: write | ✓ | ✓ | own patients | – | – |
| Therapy reports: download, send, copy day list | ✓ | ✓ | view | – | – |
| Calendar, customers (incl. complaint, medical history) | ✓ | ✓ | ✓ (no money) | – | – |
| Bookings, checkout, vouchers, invoices, confirm online bookings | ✓ | ✓ | – | – | – |
| Clock in / out, own shift and overtime | ✓ | ✓ | ✓ | ✓ | – |
| Everyone's shifts, overtime, opening hours | ✓ | ✓ | – | – | – |
| Restock: request and tick off | ✓ | ✓ | ✓ | ✓ | – |
| Manual voucher, void voucher, cancel an invoice | ✓ | ✓ | – | – | – |
| Reports, Ringkasan, catalog | ✓ | ✓ | – | – | – |
| Login access list | ✓ | – | – | – | – |
| Own portal: people on the account, book, cancel | – | – | – | – | ✓ |

## Patient flow (Alur pasien)

1. **Pasien datang** (front desk): pick or add the patient, gender, number of men/women needing slippers, which therapist gender is needed, short complaint.
   Cleaning service gets *Ganti sepatu pasien*; therapists of that gender get *Pasien datang*. New patients open the registration form straight away.
2. **Formulir pasien** (front desk): the paper form, sections A-F, saved on the customer. The medical record number (RM-000001) is assigned automatically.
3. **Sepatu sudah diganti** (cleaning service): optional shoe rack number.
4. **Atur terapis & bed** (front desk): service, therapist (matching gender listed first, with how many patients each has), and a free bed. The therapist is alerted with the bed and complaint; a booking is created on the calendar.
5. **Mulai sesi** / **Sesi selesai** (therapist): the bed lights up in the therapist's colour in the 3D map while in session.
6. After *Sesi selesai*, cleaning service gets *Kembalikan sepatu* and the front desk gets *Siap checkout*. The patient leaves the board once the shoes are returned.

**Families and relatives.** In *Pasien datang*, tap *Tambah kerabat yang ikut terapi* for each relative who also wants therapy (existing patient or new), with their relation to the first patient (suami/istri, anak, ayah/ibu, saudara, kakek/nenek, cucu, teman, kerabat lain).
Each relative is registered as a patient with their own visit, therapist and bed, and both patients are linked in their records. The family is saved in one step, so cleaning gets one *Ganti sepatu* card and one button for everyone.
On the board the family shares a coloured tag ("Istri Joko Susilo"), the bed picker marks family beds so they can sit side by side, and the 3D map joins their beds with a coloured line on the floor.
Every patient profile has a **Keluarga & kerabat** graph: the patient in the middle, relatives around with the relation on each line, and their relatives one step further out. An orange dot marks who is in the clinic right now. Tap anyone to open their profile; *Hubungkan* links two patients by hand.

Alerts: a chime, a pop-up, a vibration on phones, the count on the *Alur pasien* menu and in the browser tab, and a system notification when the tab is in the background (tap *Izinkan notifikasi* once on each device). Keep the app open on each staff phone or PC.

Give each therapist a gender in **Terapis & akses** so the right ones are called.

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
4. **Deploy the security rules** (once, and again whenever the rules change, **including after this update**, which adds discounts, public receipts, patients, shifts, attendance, reports, restock and online booking):
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use jade-physio
   firebase deploy --only firestore:rules,storage
   ```
   **Storage** (for physios' PDF uploads): in the Firebase console open *Storage → Get started* once. New Storage buckets need the Blaze (pay-as-you-go) plan; light clinic use stays inside the free quota.
   Without Storage, reports still work: physios fill in the form, and *PDF* on the report prints or saves it.
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
It loads sample data into the browser (no login, no Firebase), and the sidebar lets you switch between Admin (front desk), Manajer, Terapis, Cleaning and Pasien to preview each role.
Open two tabs with different roles (e.g. Admin and Cleaning) to see the alerts arrive.

## Deploying

The easiest host is **Vercel**: import the repo, add the `NEXT_PUBLIC_FIREBASE_*` variables from `.env.local`, deploy.
Then in Firebase *Authentication → Settings → Authorized domains*, add your Vercel domain.

## Business details on invoices

Edit `BUSINESS` in `src/lib/format.ts` (name, address, phone, opening hours used by the calendar).

## Data model (Firestore)

- `access/{email}`: `{ role: 'admin' | 'manager' | 'staff' | 'therapist' | 'cleaning', name, staffId? }`
- `visits`: one walk-in per day (`dateKey`), with shoes, therapist, bed (`b1`-`b7`), stage, and the booking it created
- `customers.profile`: the registration form (sections A-F), `customers.gender`
- `customers.links`: `[{ id, name, kind, at }]`, kept on both patients (`kind` = what that person is to this one)
- `visits.groupId`, `visits.relation`: patients who walked in together
- `meta/settings`: `{ hours: { "0".."6": { start, end } | null }, reminderDays }`
- `team/{email}`: `{ name, role, staffId?, active, schedule: { "0".."6": { start, end } | null } }`
- `attendance/{email}_{YYYY-MM-DD}`: clock in/out, shift frozen at clock-in, `overtimeMin`, `closing: normal | overtime`
- `reports/{bookingId}`: therapy report; file in Storage under `reports/{bookingId}/`
- `restock`: `{ item, qty, unit, category, urgent, dateKey, createdBy, done, doneBy, doneAt }`
- `accounts/{email}`: patient portal account with `persons[]`
- `requests`: patients' booking requests (`pending → confirmed / rejected / cancelled`), confirmed into `bookings`
- `vouchers.soldBy`, `vouchers.remindedAt`; `sales.items[].soldBy`
- `bookings.packageId`, `bookings.packageName` (package to sell at checkout), `bookings.voucherId` (patient's package to use)
- `bookings.remindedAt`, `bookings.remindedBy`: when the WhatsApp appointment reminder was sent
- `discounts`: `{ name, type: 'percent' | 'flat', value, maxAmount, appliesTo: 'all' | 'service' | 'package' | 'bill', active, validUntil }`
- `sales.items[].discount/discountName`, `sales.lineDiscount`, `sales.billDiscount`, `sales.receiptToken`
- `receipts/{token}`: public copy of an invoice for the receipt link (readable by exact link only, never listable)
- `staff`, `services`, `packages`: catalogue
- `customers`, `bookings` (`dateKey` = `YYYY-MM-DD`, `status`)
- `vouchers`: prepaid sessions per customer, with `redemptions[]`
- `sales`: invoices (`INV/2026/00001`, numbered per year via `meta/counters` inside a transaction)

No composite indexes are needed.
