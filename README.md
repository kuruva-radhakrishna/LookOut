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

With your own MongoDB (Atlas or local): copy `backend/.env.example` to `backend/.env`, fill `MONGO_URI` and `JWT_SECRET`, then seed and run:

```bash
cd backend
npm run seed -- --reset   # 500 listings across ~75 places, 8 demo hosts, 120 demo guests and ~1,800 reviews (password lookout-demo-1)
npm run seed:reviews      # (re)creates just the guests and reviews on existing listings
npm run dev
```

### Seed data
`scripts/lib/places.js` defines each destination (coordinates, price tier, landmarks, suitable categories). Prices follow the place tier x category x comfort level (budget to luxury), and each description is generated from the same inputs, so a luxury Udaipur palace costs far more than a budget room in Kasol and says why. Every listing has its **own** photo, taken from Wikimedia Commons for that place and category; `scripts/seed-images.json` holds the URLs with author and licence, which the listing page shows as attribution. To rebuild the image list: `node scripts/build-images.js`.

### Maps and distance from you
Set `VITE_MAPBOX_TOKEN` (a public `pk.` token, ideally URL-restricted) in `frontend/.env` / Vercel. On a listing, **Show distance from my location** asks the browser for permission, then shows the straight-line distance and, via Mapbox Directions, the road distance, drive time and route on the map. Without a token the app falls back to OpenStreetMap and straight-line distance only.

### Payments

* **No Razorpay keys (default): demo mode.** A simulated gateway: pick UPI, card, net banking or a wallet, then go through a realistic checkout (processing steps, OTP page, "approve on your phone", a fake bank page). Nothing is charged and no card data is stored. Handy for demos and for a free deployment.
  * The state machine runs on the server (`backend/src/services/demoPaymentService.js`), so the browser can't skip it: a booking is confirmed only by a successful attempt.
  * Test inputs: cards `4111 1111 1111 1111` (instant success), `4000 0000 0000 3220` (asks for OTP `123456`), `...0002` declined, `...9995` insufficient funds, `...0069` expired, `...0127` wrong CVV; any other valid card number asks for an OTP. UPI ids containing `fail` are declined, containing `timeout` never answer. Punjab National Bank is "down", MobiKwik has no balance.
  * Cancelling a payment, letting it time out, or **refreshing/closing the page mid-payment** cancels that attempt (the reservation and its 10-minute hold stay, so the guest can retry). Five failed attempts block further tries.
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
* Environment variables: `VITE_API_URL` = your Render URL (e.g. `https://lookout-api.onrender.com`, no `/api`) and `VITE_MAPBOX_TOKEN`.
* After the first deploy, put the final Vercel URL into the Render `CLIENT_URL` variable (comma-separate if you also want preview URLs).

## API overview

| Method | Path | Notes |
| --- | --- | --- |
| POST | `/api/auth/signup`, `/login` | returns `{token, user}` (send as `Authorization: Bearer`) |
| GET | `/api/listings?q&category&minPrice&maxPrice&minRating&guests&checkIn&checkOut&sort&limit&offset` | search with `limit`/`offset` paging. `limit` is snapped to a multiple of 3 (3 to 48, default 15). The web app sends `limit = columns x rows` (columns measured from the live grid, rows 3/6/9, more on narrow screens), so every row on a page is full at any screen size. `sort`: recommended, rating, price_asc, price_desc, newest. Dates hide stays with a booked or held night in range. Returns `items,total,limit,offset,page,pages,hasMore` |
| GET | `/api/listings/places?q` | destination suggestions with stay counts |
| GET | `/api/listings/facets` | price bounds and category counts for the filter UI |
| GET | `/api/listings/:id/similar?limit` | "More stays like this": ranked by same place, same region, same category, similar price and rating (3 to 24, default 12) |
| POST/PUT/DELETE | `/api/listings[/:id]` | owner only; JSON with `images: [{url}]` (1 to 10, upload them via `/api/media` first) and `primary` (index of the cover photo, default 0) |
| GET | `/api/listings/:id/availability` | booked/held nights |
| GET | `/api/listings/:id/reviews?sort&limit&offset` | top-level reviews (`sort`: recent, helpful, high, low; `limit` 1-24, default 6) each with its full reply tree, plus `summary` (average, count, star distribution). Add a token to get your own `myReaction` |
| POST | `/api/listings/:id/reviews` | `{rating, comment, images[]}`; one review per guest per listing, never on your own listing |
| POST | `/api/reviews/:id/replies` | reply to a review or reply (up to 3 levels deep); doesn't affect the rating |
| POST | `/api/reviews/:id/reaction` | `{value: "like" \| "dislike" \| "none"}`; one per person, not on your own post |
| DELETE | `/api/reviews/:id` | author only; removes the thread beneath it |
| POST | `/api/media` | upload up to 10 images (multipart field `images`, 5 MB each); returns `[{url, filename}]` |
| GET | `/api/media/:id` | the stored image (public, cacheable) |
| GET/PUT/DELETE | `/api/favorites[/:listingId]`, `/api/favorites/ids` | saved stays |
| POST | `/api/bookings` | hold dates + create payment order (409 if taken) |
| POST | `/api/bookings/:id/verify` | confirm after payment |
| POST | `/api/bookings/:id/cancel` | releases dates; full refund if >= 48h before check-in |
| GET | `/api/bookings/mine`, `/hosting` | |
