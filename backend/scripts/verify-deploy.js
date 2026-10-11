#!/usr/bin/env node
// Smoke-tests a deployed LookOut: node scripts/verify-deploy.js <api-url> <web-url>
//   e.g. node scripts/verify-deploy.js https://lookout-api.onrender.com https://lookout.vercel.app
// Checks the API is healthy, the browser origin is allowed by CORS (and a stranger isn't), the SPA serves deep links,
// and the frontend bundle really points at this API. Exit code 1 if anything is wrong. Warnings don't fail the run.
const [apiArg, webArg] = process.argv.slice(2);
if (!apiArg || !webArg) {
  console.error("Usage: node scripts/verify-deploy.js <api-url> <web-url>");
  process.exit(2);
}
const api = apiArg.replace(/\/$/, "");
const web = webArg.replace(/\/$/, "");

let failed = 0;
const ok = (m) => console.log(`  \x1b[32mPASS\x1b[0m  ${m}`);
const bad = (m, hint) => {
  failed++;
  console.log(`  \x1b[31mFAIL\x1b[0m  ${m}${hint ? `\n        -> ${hint}` : ""}`);
};
const warn = (m) => console.log(`  \x1b[33mWARN\x1b[0m  ${m}`);
const step = (t) => console.log(`\n${t}`);

async function get(url, init = {}) {
  const started = Date.now();
  const res = await fetch(url, { signal: AbortSignal.timeout(90000), ...init }); // generous: free Render instances take ~50s to wake
  return { res, ms: Date.now() - started };
}

(async () => {
  step(`API  ${api}`);
  try {
    const { res, ms } = await get(`${api}/api/health`);
    const body = await res.json();
    if (res.ok && body.ok) ok(`/api/health is up (${ms} ms${ms > 15000 ? ", it was asleep: first request after idle is slow on free hosting" : ""})`);
    else bad("/api/health did not report ok", "check the Render logs");
    if (body.paymentMode === "demo") warn("payments are in DEMO mode (no Razorpay keys): fine for a showcase, nobody is charged");
    else ok(`payments: ${body.paymentMode}`);
    if (!body.razorpayKeyId && body.paymentMode === "razorpay") bad("Razorpay mode without a public key id");
    if (!/^https:/.test(api)) warn("API is not https: browsers on an https site will block it");
  } catch (e) {
    bad(`could not reach the API: ${e.message}`, "is the Render service live, and is the URL right (no trailing path)?");
    return finish();
  }

  try {
    const { res } = await get(`${api}/api/listings?limit=3`);
    const body = await res.json();
    if (res.ok && body.total > 0) ok(`database is connected and has ${body.total} listings`);
    else if (res.ok) warn("API works but there are 0 listings: run `npm run seed` against this database");
    else bad(`/api/listings returned ${res.status}`, "most likely MONGO_URI is wrong or Atlas Network Access blocks Render (allow 0.0.0.0/0)");
  } catch (e) {
    bad(`listings request failed: ${e.message}`);
  }

  step(`CORS  (browser origin ${web})`);
  try {
    const { res } = await get(`${api}/api/listings?limit=1`, { headers: { Origin: web } });
    const allow = res.headers.get("access-control-allow-origin");
    if (allow === web) ok("the web origin is allowed");
    else bad(`the web origin is NOT allowed (got "${allow}")`, `set CLIENT_URL=${web} on Render (no trailing slash; comma-separate several), then redeploy`);

    const pre = await get(`${api}/api/bookings`, {
      method: "OPTIONS",
      headers: { Origin: web, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "authorization,content-type" },
    });
    const allowHeaders = (pre.res.headers.get("access-control-allow-headers") || "").toLowerCase();
    if (pre.res.status < 300 && allowHeaders.includes("authorization")) ok("preflight for authenticated POSTs passes");
    else bad(`preflight failed (status ${pre.res.status})`, "same cause: CLIENT_URL");

    const stranger = await get(`${api}/api/listings?limit=1`, { headers: { Origin: "https://evil.example.com" } });
    if (!stranger.res.headers.get("access-control-allow-origin")) ok("other websites are not allowed");
    else bad("any website is allowed by CORS", "CLIENT_URL must list only your own site");
  } catch (e) {
    bad(`CORS check failed: ${e.message}`);
  }

  step(`Web  ${web}`);
  let html = "";
  try {
    const { res } = await get(web);
    html = await res.text();
    if (res.ok && /<div id="root">/.test(html)) ok("the site loads");
    else bad(`site returned ${res.status} or isn't the LookOut app`, "Vercel: root directory must be `frontend`");
    const deep = await get(`${web}/listings/000000000000000000000000`);
    const deepHtml = await deep.res.text();
    if (deep.res.ok && /<div id="root">/.test(deepHtml)) ok("deep links work (refreshing /listings/... doesn't 404)");
    else bad("deep links 404", "frontend/vercel.json (the rewrite to /index.html) isn't being used; root directory must be `frontend`");
  } catch (e) {
    bad(`could not load the site: ${e.message}`);
  }

  const script = html.match(/<script[^>]+src="([^"]*\/assets\/[^"]+\.js)"/)?.[1];
  if (script) {
    try {
      const { res } = await get(new URL(script, web + "/").href);
      const js = await res.text();
      if (js.includes(api)) ok("the frontend is built against this API (VITE_API_URL is correct)");
      else if (/localhost:5000/.test(js)) bad("the frontend still points at localhost:5000", "set VITE_API_URL on Vercel to the Render URL, then redeploy (env vars apply at build time)");
      else bad("the frontend does not contain this API's address", `VITE_API_URL should be exactly ${api} (no trailing slash, no /api)`);
      const hasToken = /pk\.eyJ[A-Za-z0-9_-]{20,}/.test(js) || /pk\.eyJ/.test(js);
      if (hasToken) ok("a public Mapbox token is baked in (restrict it to this site's URL in the Mapbox dashboard)");
      else warn("no Mapbox token in the build: the map falls back to OpenStreetMap and road-distance is off (set VITE_MAPBOX_TOKEN on Vercel and redeploy)");
    } catch (e) {
      warn(`could not inspect the JS bundle: ${e.message}`);
    }
  } else {
    warn("no built bundle found in the HTML (is this a dev server?); skipped the API-address check");
  }

  finish();
})();

function finish() {
  console.log(failed ? `\n\x1b[31m${failed} problem${failed > 1 ? "s" : ""} found.\x1b[0m` : "\n\x1b[32mEverything checks out.\x1b[0m");
  process.exit(failed ? 1 : 0);
}
