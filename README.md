# LookOut

Find and book unique stays. MERN app: **React (Vite)** frontend, **Express + MongoDB** API, **Razorpay** payments.

```
backend/    Express 5 REST API (Mongoose, JWT auth, Razorpay, Cloudinary)   -> deploy to Render
frontend/   React 19 + Vite SPA (react-router, Leaflet map)                  -> deploy to Vercel
render.yaml Render blueprint for the API
```

## How double-booking is prevented

Booking is two steps: **hold, then pay**.

1. `POST /api/bookings` inserts one `BookedNight` document per night of the stay. A **unique index on `{listing, date}`** means MongoDB lets exactly one of N simultaneous requests claim a given night; the rest get `409`. Nights are inserted in ascending order so overlapping requests collide on the same night rather than each grabbing part of the range. No locks, no replica set required.
2. The hold lasts 10 minutes (`BOOKING_HOLD_MINUTES`) and is shown to the guest as a countdown. Payment confirms it (`POST /api/bookings/:id/verify`, plus a Razorpay webhook as a safety net) and removes the expiry. Abandoned holds are swept by a TTL index and reclaimed on demand.
3. Edge cases handled: late payment after the hold lapsed (re-claims the nights if still free, otherwise **auto-refunds**), double-submitted confirmations (idempotent), concurrent cancels (refund once), back-to-back stays (check-out day is free).

`backend/test/booking.test.js` runs 25 simultaneous guests against one listing and asserts exactly one wins, plus the edge cases above (`npm test`, uses an in-memory MongoDB).

## Run locally

```bash
# API  (no MongoDB needed: uses a throwaway in-memory DB seeded with 43 listings)
cd backend && npm install && npm run dev:memory     # http://localhost:5000

# Web
cd frontend && npm install && npm run dev           # http://localhost:5173
```

With your own MongoDB: copy `backend/.env.example` to `backend/.env`, fill `MONGO_URI` and `JWT_SECRET`, then `npm run seed` and `npm run dev`. The seed creates `demo_host` (password `lookout-demo-1`, or `SEED_HOST_PASSWORD`).

### Payments

* **No Razorpay keys (default): demo mode.** The checkout page shows a *Simulate payment* button; no money moves. Handy for demos and for a free deployment.
* **Razorpay test mode:** set `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` (`rzp_test_...`). Checkout then opens the real Razorpay window and the server verifies the HMAC signature. Test cards/UPI: <https://razorpay.com/docs/payments/payments/test-card-details/>.
* Optional webhook: Razorpay dashboard -> Webhooks -> `https://<api>/api/webhooks/razorpay`, event `payment.captured`, secret = `RAZORPAY_WEBHOOK_SECRET`.

## Deploy

### 1. Database: MongoDB Atlas
Create a free M0 cluster, a database user, and allow network access `0.0.0.0/0` (Render's IPs are not fixed). Copy the connection string.

### 2. Backend on Render
* New + -> **Blueprint** -> select this repo (uses `render.yaml`), or create a Web Service manually with root directory `backend`, build `npm ci`, start `npm start`, health check `/api/health`.
* Environment variables: `MONGO_URI`, `CLIENT_URL` (your Vercel URL, e.g. `https://lookout.vercel.app`, no trailing slash), optional Razorpay and Cloudinary keys. `JWT_SECRET` is generated for you.
* Seed once from the Render shell: `npm run seed`.
* Note: the free plan sleeps after inactivity; the first request can take ~50 s (the UI tells the user while it wakes).

### 3. Frontend on Vercel
* Import the repo, set **Root Directory** to `frontend` (Vite is auto-detected; `vercel.json` adds the SPA rewrite).
* Environment variable: `VITE_API_URL` = your Render URL (e.g. `https://lookout-api.onrender.com`, no `/api`).
* After the first deploy, put the final Vercel URL into the Render `CLIENT_URL` variable (comma-separate if you also want preview URLs).

## API overview

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/signup`, `/login` | returns `{token, user}` (send as `Authorization: Bearer`) |
| GET | `/api/listings?q&category&minPrice&maxPrice&page&limit` | paginated search |
| POST/PUT/DELETE | `/api/listings[/:id]` | owner only; multipart with `image` or `imageUrl` |
| GET | `/api/listings/:id/availability` | booked/held nights |
| GET/POST | `/api/listings/:id/reviews` | |
| POST | `/api/bookings` | hold dates + create payment order (409 if taken) |
| POST | `/api/bookings/:id/verify` | confirm after payment |
| POST | `/api/bookings/:id/cancel` | releases dates; full refund if >= 48h before check-in |
| GET | `/api/bookings/mine`, `/hosting` | |
