# Jade Physio: booking, checkout & vouchers

A mobile-friendly front-desk system for Jade Physio, in Bahasa Indonesia.
Built with Next.js 16 (App Router), React 19, Tailwind CSS 4 and Firebase (Auth + Firestore).

## What's inside

The sidebar is grouped into **Operasional**, **Tim & klinik**, **Keuangan & laporan** and **Pengaturan**. The manager opens on **Dasbor**; everyone else on **Alur pasien**.
Press **Ctrl K** (or **/**) anywhere, or tap *Cari* in the sidebar or on *Lainnya*, to search patients by name, phone or No. RM, jump to any page, or start a common action (*Pasien datang*, *Booking baru*, *Transaksi baru*, *Pengingat jadwal besok*, *Ajukan restock*).

| Menu | What it does |
| --- | --- |
| **Alur pasien** | The live walk-in board, and everyone's home screen. Front desk taps *Pasien datang* (patient gender, how many people need slippers, male/female therapist needed, short complaint). Cleaning service and the matching therapists get an alert right away. The board tracks each patient: shoes changed (with rack no.), registration form, therapist & bed, session, shoes returned. A **bed map** (*Denah*, laid out like the clinic: Ruang 1 beds 1-2 along the back wall and 3-5 in front of them, Ruang 2 beds 6-7) and a 3D version exist but are switched off for now (`SHOW_BED_MAP` and `SHOW_3D` in `src/app/(app)/alur/page.tsx`); beds are still assigned in *Atur terapis & bed*. |
| **Booking saya** (patients) | Patient portal. Patients sign in with their phone number and an SMS code; a new number just adds a name (email optional) to make the account. They add the people on their account (name, phone, gender, relation), and book one or more of them at once, each with their own complaint and preferred physio. The front desk confirms; the patient sees the status live. |
| **Laporan terapi** | Physios must write a report for every finished session, on the same day. *Sesi selesai & isi laporan* opens the form right away, on the same screen; one-tap choices fill in treatment, home advice and the next visit, and *Salin isinya* starts from the patient's last report. A report left for later is not forgotten: it stays in **Laporan terapi belum dibuat** (on the physio's board and on this page, oldest first, marked *Kemarin* / *3 hari lalu*), keeps counting in the red badge on any day, and is shown again when the physio taps *Pulang*. The form: complaint, findings, treatment, home advice, next visit, plus an optional PDF/JPG/PNG upload. Front desk downloads it, opens a printable PDF, or sends it by WhatsApp (summary + PDF link). *Salin daftar pasien* copies today's patient list as text. |
| **Jadwal kerja** | Clock in / *Pulang* for every staff member (sidebar and *Lainnya*), with the exact time (hour and minute) in and out and hours worked ("8 jam 12 menit"). Managers see a daily table (shift, masuk, pulang, lama kerja, status), can correct a wrong or forgotten clock-out (overtime is recalculated), and download the month as CSV for payroll. Each person's shift per weekday; time past the shift end counts as overtime (5 min grace), shown live and confirmed at *Pulang* with an optional note. Monthly overtime summary. Clinic opening hours per weekday. |
| **Restock** | Any staff member requests an item (qty, unit, category, urgent, note). Listed per day, grouped by month, with the status *Diajukan → Menunggu barang → Diterima*. The manager taps *Proses*: corrects the name, quantity and unit, enters the total price, and confirms the order. Whoever is there when it arrives taps *Barang datang*. Prices are only visible to the manager (they are stored as costs for *Laba & biaya*). *Salin daftar belanja* (manager) merges requested items into a shopping list. |
| **Dasbor** | The manager's start page, for any date range (today, 7 days, 30 days, this month, last month, or pick dates), each figure compared with the same number of days before. **Pasien baru** and **pasien lama** (a patient is new in the period of their first session), patients served and how many of last period's came back, sessions, income, cancellations, and what the physios earned. Charts: new and returning patients per day (per week or month on long ranges), where new patients heard of the clinic (from the registration form), therapy reports per physio (on time = written the same day, late, not written), busiest hours, most-used services, gender and age of patients, and the list of new patients. The *Aktivitas* tab keeps the earlier Ringkasan: tiles for walk-ins, waiting time, overtime, open restock, online bookings and expiring packages, and a filterable timeline of everything that happened. |
| **Komisi** | What each physio earns. The manager switches commission on or off and sets a rate **per service**: a percentage of the service price, a fixed amount, or none, with a default for services that have no rate of their own. The rate is frozen on the session at checkout, so changing rates later never rewrites the past. **Kompensasi harian**: a fixed amount for a working day without a single patient (so without commission), counted from clock-ins or from the shift schedule, and only once the day is over. The manager can set any day's compensation by hand (with a note), leave physios out, and optionally hold a session's commission until its therapy report is written. Per-physio totals for any date range, a day-by-day breakdown, and a CSV for payroll. Physios see **Komisi saya**: their own sessions, rates and total, nobody else's. |
| **Kalender** | Tap the date title to open a month calendar (with booking counts per day) and jump to any date. The slot under the mouse is highlighted before you click to book. Opening hours follow the weekday, and time outside a physio's shift is shaded. The day runs 2 hours past closing (*Lembur*), so overtime sessions can be booked. Patients' online booking requests show as dashed blocks and under *Permintaan*. One column per therapist. *Ingatkan pasien* lists tomorrow's bookings (or the day shown, if later) with a WhatsApp *Ingatkan* button per patient: the message has the day, time, service and physio, and the booking is marked as reminded so nobody gets it twice. On phones the calendar opens as a list; switch to *Jadwal* for the columns (remembered). A therapist can hold several patients at the same time (overlapping bookings sit side by side). Tap an empty slot or *Booking baru* to book: the form opens in the middle of the screen in four short steps (Pasien → Paket → Jadwal & terapis → Konfirmasi), so nothing needs scrolling. The *Paket* step lists the patient's own packages (*Pakai*, with sessions left) and the packages from Katalog; a package sold this way is added at checkout and pays for this session as its first. If a package covers several services, the step asks which one; with no packages in Katalog it lists services instead. Picking moves straight on, and the last step shows a summary with *Ubah* links. Walk-ins: *Sekarang (walk-in)* on the Jadwal step. Status: Menunggu → Sedang sesi → Lunas. |
| **Checkout** | Pay with QRIS, transfer bank or kartu. A customer's voucher is applied automatically when it covers the service. A package can be bought and its first session used in the same checkout. Discount and payment reference supported. |
| **Pelanggan** | Each patient keeps the basics the clinic uses: name, gender, WhatsApp number, date of birth, No. KTP (NIK, 16 digits), address and notes (email optional), filled in with *Pelanggan baru* / *Ubah data* and searchable by name, phone or NIK. Each patient profile has **Riwayat sesi** (every session numbered "Sesi ke-N" with date, time, service, physio, bed, complaint, how it was paid: package "sesi 3/5" or amount and invoice, therapy report link; upcoming and cancelled sessions; summary) and **Riwayat pembelian** (every transaction itemised with discounts, packages and the vouchers they created, sessions paid by package, payment method, invoice and online receipt links, manual packages from the old system, totals and CSV). Physios see the session history without amounts; purchases are for the front desk and managers. Filters: *Punya sesi prabayar*, *Paket hampir kedaluwarsa* (window 3 days to 2 months, default set by a manager) with a WhatsApp *Ingatkan* button that also records when the patient was reminded, *Perlu follow-up* (last session longer ago than a window of 1 week to 3 months, default set by a manager, and nothing booked; counted from the last 6 months of sessions) with a WhatsApp *Follow up* button that records when they were contacted, and *Belum isi formulir*. Patients due a follow-up are also highlighted in the full list. Customer list and profile: prepaid sessions, visit history, invoices, WhatsApp button. Sell a package or add a manual voucher (for moving balances over from Zenwel). |
| **Voucher** | All prepaid packages, remaining sessions (shown as jade beads), usage history, and the value of prepaid sessions not yet served. |
| **Faktur** | Every transaction gets an online receipt (resi) link, laid out like the clinic's printed receipt (logo, address, invoice number and date, patient, each line with its session date and time, Sub Total / Total / Grand total, payment method with the time paid, social media), e.g. `https://your-domain/resi/x7k2…`, shown after checkout with *Salin link* / *Kirim WA*, and on each invoice (older invoices: *Buat link resi*). The receipt opens on any phone without logging in, shows items, discounts and total, and turns into "dibatalkan" if the invoice is voided. Invoice list with date range, search, method/status filters and CSV export. Each invoice can be printed (A5), sent via WhatsApp, or cancelled (admin only). Cancelling returns voucher sessions and resets the booking. |
| **Laporan** | Income, average per transaction, sessions served, packages sold, daily/hourly chart, payment methods, per therapist, per service. |
| **Laba & biaya** (manager only) | Pemasukan − modal/HPP = *laba kotor*; − operating costs = *laba bersih*, with margins, for any date range. Restock prices count as modal automatically; the manager adds other costs by hand (name, amount, date, *Modal / HPP* or *Operasional*). Admin never sees costs or profit, and Firestore only lets the manager read them. |
| **Pengingat** | Dated reminders for the admin, like a calendar app: a message for a day and optional time, added here or from *Kalender* (the day's reminders show under the date). When the time comes it pops up bottom-right (plus a browser notification when the app is in another tab) until someone taps *Sudah dilihat*; everyone then sees who saw it and when. *Pengingat rutin* repeat while the clinic is open: built in is "cek dan balas DM TikTok" every hour for Admin accounts, which can be switched off, reworded or joined by others. |
| **Katalog** | **Diskon** (manager/admin): percent (with optional cap) or flat rupiah, for services, packages, the whole transaction, or all; optional end date. The front desk picks from these at checkout, per item (packages too) and/or on the total; only managers can type a manual discount. Services (name, duration, price) and session packages (1, 3, 5... sessions, price, eligible services, validity with presets from 1 week to 1 year). Checkout records who sold each package (*Dijual oleh*); *Laporan* shows package sales per staff member. |
| **Template WhatsApp** | The wording of every WhatsApp message to patients (appointment reminder, follow-up, package expiry, receipt, therapy report), with `{placeholders}` filled in when sending, one-tap placeholders and emojis, a live preview, and *Kembalikan ke bawaan*. Lines whose placeholder is empty (no PDF, no advice) are left out. |
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
| Restock: request, confirm arrival | ✓ | ✓ | ✓ | ✓ | – |
| Restock: process orders, see prices | – | ✓ | – | – | – |
| Manual voucher, void voucher, cancel an invoice | ✓ | ✓ | – | – | – |
| Reports, Dasbor, catalog | ✓ | ✓ | – | – | – |
| Komisi: rates, on/off, daily compensation, everyone's totals | – | ✓ | – | – | – |
| Komisi saya: own sessions and total | – | – | ✓ | – | – |
| WhatsApp templates | ✓ | ✓ | – | – | – |
| Pengingat (dated reminders) | ✓ | ✓ | – | – | – |
| Pengingat rutin popups (e.g. TikTok DMs) | ✓ | – | – | – | – |
| Laba & biaya: costs, gross and net profit | – | ✓ | – | – | – |
| Login access list | ✓ | – | – | – | – |
| Own portal: people on the account, book, cancel | – | – | – | – | ✓ |

## Patient flow (Alur pasien)

1. **Pasien datang** (front desk): pick or add the patient, gender, number of men/women needing slippers, which therapist gender is needed, short complaint.
   Cleaning service gets *Ganti sepatu pasien*; therapists of that gender get *Pasien datang*. New patients open the registration form straight away.
   A patient who booked for today shows their booking on the sheet (*Datang untuk booking ini*, on by default; switch it off to record a walk-in): only the booked therapist is called (*Pasien booking Anda sudah datang*), and the therapist and service are filled in for step 4.
2. **Formulir pasien** (front desk): the paper form, sections A-F, saved on the customer. The medical record number (RM-000001) is assigned automatically.
3. **Sepatu sudah diganti** (cleaning service): optional shoe rack number.
4. **Atur terapis & bed** (front desk): service, therapist (matching gender listed first, with how many patients each has), and a free bed. The therapist is alerted with the bed and complaint; a booking is created on the calendar, or the patient's own booking for today is used.
5. **Mulai sesi** / **Sesi selesai** (therapist): the bed lights up in the therapist's colour in the 3D map while in session.
6. After *Sesi selesai*, cleaning service gets *Kembalikan sepatu* and the front desk gets *Siap checkout*. The patient leaves the board once the shoes are returned.

**Who gets the patient.** Every place a therapist is picked (*Booking baru*, *Atur terapis & bed*, and confirming an online request) shows a suggestion and selects it for you:

- A returning patient stays with their own physio: the one who handled their first session, or the one set under *Fisioterapis tetap* on the patient's page.
- A new patient goes to a physio of the patient's own gender (male to male, female to female; or the gender asked for at *Pasien datang* or in the online request), the one with the **fewest different patients in that calendar month**, so the month ends about even. Ties go to fewer sessions, then to whoever is less busy at that hour.
- A physio with no shift on that date is skipped; if that is the patient's own physio, a cover of the same gender is suggested for that visit and the patient stays theirs.
- The count is of different patients, not sessions, includes bookings still to come in the month, and leaves out cancelled ones. It is shown under the suggestion ("Pasien bulan ini: Andini 17, Bagus 19, …") and on the manager's Dasbor as *Pembagian pasien per fisioterapis*.

It is a suggestion: the desk can tap another physio at any time and that choice is kept.

**Families and relatives.** In *Pasien datang*, tap *Tambah kerabat yang ikut terapi* for each relative who also wants therapy (existing patient or new), with their relation to the first patient (suami/istri, anak, ayah/ibu, saudara, kakek/nenek, cucu, teman, kerabat lain).
Each relative is registered as a patient with their own visit, therapist and bed, and both patients are linked in their records. The family is saved in one step, so cleaning gets one *Ganti sepatu* card and one button for everyone.
On the board the family shares a coloured tag ("Istri Joko Susilo"), the bed picker marks family beds so they can sit side by side, and the 3D map joins their beds with a coloured line on the floor.
Every patient profile has a **Keluarga & kerabat** graph: the patient in the middle, relatives around with the relation on each line, and their relatives one step further out. An orange dot marks who is in the clinic right now. Tap anyone to open their profile; *Hubungkan* links two patients by hand.

Alerts: a chime, a pop-up, a vibration on phones, the count on the *Alur pasien* menu and in the browser tab, and a system notification when the tab is in the background (tap *Izinkan notifikasi* once on each device). Keep the app open on each staff phone or PC.
Sound starts after the first tap on the page (a browser rule); until then staff see *Ketuk layar sekali untuk menyalakan suara notifikasi*. What is already waiting when the app opens stays quiet; only what comes after pings.

| Who | Gets |
|---|---|
| Front desk (admin) | *Permintaan booking dari pasien*, *Pasien menunggu formulir*, *Sesi selesai, siap checkout*, dated reminders and the hourly routine |
| Therapist | *Pasien minta booking dengan Anda*, *Booking baru untuk Anda* (made at the desk or a request confirmed, also when moved), *Pasien datang* (no therapist yet, matching gender), *Pasien booking Anda sudah datang*, *Pasien baru untuk Anda* / *Pasien booking Anda* with the bed, *Pasien siap masuk*, *Buat laporan terapi* |
| Cleaning service | *Ganti sepatu pasien*, *Kembalikan sepatu* |
| Manager | the front desk's alerts except the hourly routine, plus *Permintaan restock* / *Restock urgent* |
| Patient (portal) | *Booking dikonfirmasi*, *Permintaan booking ditolak* |

Phones show system notifications through a small service worker (`public/sw.js`). Alerts reach a device only while the app is open on it (also in a background tab); a phone that has closed the app or locked the screen for long gets nothing until it is opened again.

Give each therapist a gender in **Terapis & akses** so the right ones are called.

The same rules are enforced server-side in `firestore.rules`, so the menu hiding is not the only protection.

## Setup

1. **Install**: Node 20+ required.
   ```bash
   npm install
   ```
2. **Firebase config** is already in `.env.local` (project `jade-physio`).
3. In the [Firebase console](https://console.firebase.google.com/project/jade-physio):
   - *Authentication → Sign-in method*: enable **Email/Password** (staff) and **Phone** (patients).
   - *Authentication → Settings → Authorized domains*: add your site's domain (e.g. `jade-physio.vercel.app`), or phone sign-in is refused there.
   - Real SMS may need the **Blaze** (pay-as-you-go) plan. To try phone sign-in without sending SMS, add a number under *Phone numbers for testing*.
   - *Firestore Database*: create the database (production mode, region `asia-southeast2` Jakarta recommended).
4. **Deploy the security rules** (once, and again whenever the rules change, **including after this update**, which adds commission rules (`meta/commission`), the manager's per-day compensation (`payDays`), and lets a physio note on their own booking that the session ended and its report is in). Until they are deployed, commission rules cannot be saved, and a report written by a physio stays listed as missing until the desk opens *Laporan terapi*:
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
6. Open the app. On a brand-new project it asks for the first account, which **becomes the admin**.
   On the empty calendar, *Isi contoh awal* adds sample therapists, services and packages, which you can then edit in Katalog.
7. Make everyone else's login in **Terapis & akses → Akses login → Tambah**: email, role (and for a therapist, their calendar column) and an initial password (one is generated).
   The account works right away: tap *Salin info masuk* and send it to them. They can set their own password with **Lupa kata sandi?** on the login page (Firebase emails the link).
   Only patients sign up themselves; staff and clinic accounts are always made by the admin.

## Commission and daily compensation

Open **Komisi → Atur komisi** as the manager.

- **Komisi per sesi.** Every finished session earns its physio the rate of its service: a percentage of the service price (the list price, also when a package paid for it), or a fixed amount. *Berlaku sejak* is the first day that counts.
- **When it is fixed.** At checkout the rate and amount are saved on the session, so later rate changes, or switching commission off, leave it as it was. A session that is finished but not yet paid shows as *Perkiraan*, at today's rates.
- **Switching it off and on.** While commission is off, sessions earn nothing. Switching it back on starts from that day (*Berlaku sejak*); move the date back only if the days in between should be paid too, at the current rates.
- **Tahan komisi sampai laporan terapi dibuat** (off by default). With it on, a session's commission shows as *Ditahan* and is left out of the total until the physio writes the report.
- **Kompensasi harian.** A fixed amount for each working day on which the physio finished no session. *Absen masuk* counts the days they clocked in; *Jadwal shift* counts the days they have a shift in *Jadwal kerja*, clocked in or not. Today is counted only after the day has passed.
- **A single day.** In a physio's breakdown, the pencil sets that day's compensation by hand (0 removes it), with a note; *Kembali ke otomatis* undoes it. *Atur kompensasi untuk tanggal lain* covers a day that is not listed.
- A service sold at checkout without a booking counts as a session too once a physio is picked on the line.

## Moving from Zenwel

For customers who still have sessions left in Zenwel, open the customer → **Voucher manual**.
Pick the package, fill in *Sudah terpakai* (sessions already used), and add a note such as the old invoice number.
This creates the voucher without an invoice, so it doesn't count as income twice.

## Demo mode

To try the app without touching real data, set `NEXT_PUBLIC_DEMO_MODE=1` in `.env.local` and restart.
It loads sample data into the browser (no login, no Firebase), and the sidebar lets you switch between Admin (front desk), Manajer, Terapis, Cleaning and Pasien to preview each role.
The sample has two months of sessions, new and returning patients, commission rules, two days without patients for one physio, and a few late and unwritten therapy reports.
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
- `bookings.endedAt`, `bookings.reportDue`, `bookings.reportAt`: when the session ended, whether it still owes a report (one small query finds every unwritten report on any day), and when the report was first saved
- `bookings.commission`: `{ type: 'percent' | 'flat' | 'none', value, amount }`, frozen at checkout; `bookings.walkIn`: made by checkout for a service sold without a booking
- `meta/commission`: `{ enabled, since, holdUntilReport, defaultRate, rates: { serviceId: { type, value } }, staffOff: [staffId], compensation: { enabled, amount, since, basis: 'attendance' | 'shift' } }`
- `payDays/{staffId}_{YYYY-MM-DD}`: `{ staffId, dateKey, compensation, note, by, byName, at }`, the manager's own figure for a day
- `customers.firstSessionAt`: start of the patient's first paid session, set at checkout (older records fall back to `createdAt`)
- `customers.primaryStaffId`: the patient's own physio when the desk set one by hand; empty = the physio of their first session
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
