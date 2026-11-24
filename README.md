# Gramaseva (ഗ്രാമസേവ)

A village services app: find local workers (plumbing, wiring, welding, coconut climbing, farm work), book an auto or car, and read village news. One codebase is the website, the installable phone app (PWA) and the coordinator admin panel.

**Beginner setup guide (Malayalam): [SETUP_MALAYALAM.md](SETUP_MALAYALAM.md)**

## Quick start

```bash
npm install
npm run dev          # opens in Demo mode (sample data, OTP 123456) when .env is empty
```

Fill `.env` (copy from `.env.example`) with your Firebase web config to switch to real data.

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run build:demo` | Demo build (sample data, in-memory routing) to `demo-dist/` |
| `npm run deploy` | Build and deploy hosting + Firestore rules (`firebase-tools` required) |

## Stack

- React 18 + TypeScript + Vite, react-router (hash routing so it works on any static host)
- Firebase Authentication (Google, phone OTP, and free WhatsApp login via `whatsapp-login/` — see its README) + Cloud Firestore
- PWA: `public/manifest.webmanifest`, `public/sw.js` (network-first cache of app files)
- Fonts and icons are bundled (Anek Malayalam via @fontsource, lucide-react); no CDN calls

## Structure

```
src/
  types.ts            data model
  data/api.ts         backend interface
  data/firebase.ts    Firebase implementation
  data/demo.ts        in-browser demo implementation + data/seed.ts sample data
  lib/app.tsx         app state (auth, profile, village, language, toasts)
  lib/util.ts         labels (ml/en), distance, dates, rates
  components/ui.tsx   shared UI (app bar, bottom nav, avatars, call buttons…)
  screens/            Onboarding, Home, News, Workers, Ride, Bookings, Provider, Profile
  admin/Admin.tsx     coordinator / super admin panel (#/admin)
firestore.rules       security rules (roles, provider approval, one review per booking)
```

## Data model (Firestore)

| Collection | Key fields |
| --- | --- |
| `villages/{id}` | name, nameEn, panchayat, district, status (`live`/`soon`), lat, lng, panchayatPhone |
| `users/{uid}` | name, phone (E.164), pincode (required), pinLat, pinLng, villageId, ward, lang, role (`user`/`coordinator`/`superadmin`), coordinatorOf, consent |
| `providers/{uid}` | name, phone, villageId, category, rate, rateUnit, radiusKm, lat, lng, availableUntil, status, verified, ratingSum, ratingCount |
| `news/{id}` | villageId, title, body, category, important, status (`pending`/`published`/`rejected`), postedBy, createdAt |
| `bookings/{id}` | type (`service`/`ride`), customer*, provider*, villageId, category, date, slot, details, from, to, status, rated |
| `reviews/{bookingId}` | providerId, customerId, stars, comment |
| `orderReviews/{kind}_{enquiryId}` | kind (`shop`/`delivery`), enquiryId, targetUid, fromUid, stars, comment — one per order and kind |
| `ratingStats/{kind}_{uid}` | sum, count — running total of a shop's / delivery person's order reviews |
| `reports/{id}` | reportedBy, againstId, villageId, reason, status |

Design decisions:

- **Multi-village from day one.** Everything carries `villageId`; providers have a location and a travel radius, so people in neighbouring villages see them under "From nearby villages". Adding a village is an admin action, not a code change.
- **"Free now" switches itself off.** Availability is stored as `availableUntil` (24 h from when the provider turns it on), so stale "free" flags need no server job.
- **No Cloud Functions needed.** Ratings are aggregated in the same batch that creates the review; the rules check the review is new, belongs to that customer's finished booking, and that the delta matches the stars.
- **No composite indexes.** Queries use equality filters only and sort on the client.
- **No payments in-app.** Customers pay providers directly (cash/UPI).

## Costs (checked Nov 2026)

- Real OTP SMS needs billing enabled (Blaze); without it the app shows `auth/billing-not-enabled` and only Firebase test phone numbers work. SMS to India is billed per message (Identity Platform lists $0.07 each).
- Firestore free quota: 50K reads / 20K writes / 20K deletes per day, 1 GiB storage. Hosting: 10 GB storage, 360 MB/day transfer.
- Play Store: one-time $25 developer fee; package the PWA as a Trusted Web Activity with PWABuilder.

## Not in this version (next steps)

- Push notifications (Firebase Cloud Messaging) for new requests and important news
- Photo upload (profile photos, news images) with Firebase Storage
- Live location for rides, voice search, more work categories
