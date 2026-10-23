// ভার্সন বদলালে শুধু এই লাইনটা বদলান
const VERSION = "jarvis-v5";
const CORE = ["./", "./index.html", "./manifest.json"];
const NET_TIMEOUT_MS = 4000;   // Render ঘুমিয়ে থাকলে এর বেশি অপেক্ষা না করে ক্যাশ দেখাবে

self.addEventListener("install", (e) => {
  // addAll ব্যর্থ হলে (যেমন Render জেগে ওঠেনি) ইনস্টল যেন আটকে না যায়
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => Promise.allSettled(CORE.map((u) => c.add(new Request(u, { cache: "reload" })))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function fetchFresh(req) {
  // cache:"reload" = ব্রাউজারের HTTP ক্যাশ এড়িয়ে সরাসরি সার্ভার থেকে আনবে
  return fetch(new Request(req, { cache: "reload" }));
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;     // AI API ও বাইরের কল অক্ষত
  if (url.pathname.endsWith("/sw.js")) return;    // sw.js নিজে কখনো ক্যাশ নয়

  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const update = fetchFresh(req).then(async (res) => {
      // শুধু সফল (200) উত্তর ক্যাশ হবে; 502/404/Render-এর "waking up" পেজ নয়
      if (res && res.ok && res.type === "basic") await cache.put(req, res.clone());
      return res;
    });
    update.catch(() => {});                        // ব্যাকগ্রাউন্ডে ব্যর্থ হলে unhandled error নয়

    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NET_TIMEOUT_MS));
    try {
      const res = await Promise.race([update, timeout]);
      if (res) return res;
    } catch (err) { /* অফলাইন: নিচে ক্যাশে যাবে */ }

    const cached = await cache.match(req, { ignoreSearch: true })
                || (req.mode === "navigate" ? await cache.match("./index.html") : null);
    if (cached) return cached;
    return update;                                  // ক্যাশে কিছু নেই: নেটওয়ার্কের জন্য অপেক্ষা
  })());
});
