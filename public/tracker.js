// /public/tracker.js
//
// Jellyhook tracker. Install once, in <head>:
//   <script src="https://YOUR-APP/tracker.js" data-key="YOUR_API_KEY"></script>
// Add data-debug to the tag (or run localStorage.setItem("jh_debug","1")) to
// see what it does in the console; otherwise it is silent.
//
// How the pieces fit (full write-up: mds/developers/tracker-spec.md):
//   - ONE session per browser, shared by every window of the site, ended only
//     by 30 minutes of idle (never by closing a tab or changing page).
//   - ONE active window: when the same site is open in several windows, only
//     the one the visitor last used records a page view; the others pause.
//   - Page views follow visibility, focus, SPA route changes and idle.
//   - Every send is a "simple" CORS request (text/plain, no custom headers),
//     so the browser does not send a preflight OPTIONS before each one.
(function () {
  if (window.__jhTrackerLoaded) return; // installed twice: the second copy does nothing

  const _originalFetch = window.fetch;

  const scriptTag = document.currentScript || document.querySelector('script[data-key][src*="tracker"], script[src*="tracker.js"]');
  if (!scriptTag) return;

  // SETTINGS: read from the script tag's attributes (data-key, data-require-consent, data-debug) OR, when an attribute is
  // missing, from the script's address (tracker.js?key=...&require-consent&debug). The address form exists because Google
  // Tag Manager's Custom HTML tag rebuilds a pasted <script> and copies only id, text, charset, type and src, so every
  // data- attribute is lost (observed 2026-10-10: the element in the page had no data-key). The address survives.
  // Returns the value ("" for a bare flag), or null when the setting is not given either way.
  function setting(name) {
    const attr = scriptTag.getAttribute("data-" + name);
    if (attr !== null) return attr;
    try {
      const v = new URL(scriptTag.src, window.location.href).searchParams.get(name);
      if (v !== null && v !== "0" && v !== "false") return v;
    } catch (e) {}
    return null;
  }
  const apiKey = setting("key");
  let API_BASE;
  try {
    API_BASE = new URL(scriptTag.src, window.location.href).origin;
  } catch (e) {
    return;
  }

  const API_URL = `${API_BASE}/api/track`;

  if (!apiKey) {
    console.error("Tracker: Missing data-key");
    return;
  }

  // ── PRIVACY GATES: nothing is read, stored or sent before these pass ──────────────────────────────
  //  1. The visitor's browser says no: Global Privacy Control, or Do Not Track. Always honoured.
  //  2. The site asks for consent: with data-require-consent on the script tag, the tracker stays off until
  //     the site calls  window.jellyhook.consent(true)  (for example from its cookie banner). consent(false)
  //     turns it off again and erases what the tracker stored in this browser. The choice is remembered.
  // Details for site owners: /docs/concepts/privacy-consent
  function browserSaysNo() {
    try {
      return navigator.globalPrivacyControl === true || navigator.doNotTrack === "1" || window.doNotTrack === "1" || navigator.msDoNotTrack === "1";
    } catch (e) {
      return false;
    }
  }
  function storedConsent() {
    try {
      return localStorage.getItem("jh_consent");
    } catch (e) {
      return null;
    }
  }
  function eraseStoredData() {
    try {
      ["visitor_id", "jh_session", "jh_active", "jh_sc", "jh_hr"].forEach(function (k) {
        localStorage.removeItem(k);
      });
      Object.keys(sessionStorage).forEach(function (k) {
        if (k.indexOf("jh_") === 0) sessionStorage.removeItem(k);
      });
    } catch (e) {}
  }
  if (browserSaysNo()) return;
  if (setting("require-consent") !== null) {
    const state = storedConsent();
    if (state === "denied") {
      eraseStoredData();
    }
    if (state !== "granted") {
      window.jellyhook = window.jellyhook || {
        consent: function (granted) {
          try {
            localStorage.setItem("jh_consent", granted ? "granted" : "denied");
          } catch (e) {}
          if (granted) {
            if (browserSaysNo()) return;
            // start the tracker now: a fresh copy of this same tag, with consent on record
            const again = document.createElement("script");
            again.src = scriptTag.src;
            again.setAttribute("data-key", apiKey);
            again.setAttribute("data-require-consent", "");
            document.head.appendChild(again);
          } else {
            eraseStoredData();
          }
        },
      };
      return;
    }
    // consent already granted: run, and let the site withdraw it later
    window.jellyhook = {
      consent: function (granted) {
        try {
          localStorage.setItem("jh_consent", granted ? "granted" : "denied");
        } catch (e) {}
        if (!granted) {
          eraseStoredData();
          // the running tracker cannot be unwound piece by piece: reloading is the one clean way to stop it
          window.location.reload();
        }
      },
    };
  }
  window.__jhTrackerLoaded = true;

  // Silent unless asked: a tracker must not fill a customer's console.
  let DEBUG = setting("debug") !== null;
  try {
    if (!DEBUG && localStorage.getItem("jh_debug") === "1") DEBUG = true;
  } catch (e) {}
  function jhLog() {
    if (DEBUG) window.console.log.apply(window.console, arguments);
  }

  // crypto.randomUUID only exists on https pages; fall back so http sites still work.
  function uuid() {
    try {
      if (crypto.randomUUID) return crypto.randomUUID();
    } catch (e) {}
    const b = new Uint8Array(16);
    crypto.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  // True only for the very first session of a brand-new visitor: it is what
  // lets the server record first-touch attribution (source, UTM, landing page).
  let freshVisitor = false;
  let memoryVisitorId = null; // when storage is blocked (private modes), per page load
  function getVisitorId() {
    try {
      let id = localStorage.getItem("visitor_id");
      if (!id) {
        id = uuid();
        localStorage.setItem("visitor_id", id);
        freshVisitor = true;
      }
      return id;
    } catch (e) {
      if (!memoryVisitorId) {
        memoryVisitorId = uuid();
        freshVisitor = true;
      }
      return memoryVisitorId;
    }
  }

  // Returns a fraction of the SCROLLABLE RANGE (0 = top, 1 = scrolled as far
  // as this page goes) — NOT a fraction of page height. Those differ on any
  // page taller than the viewport: on a page 1.25x the viewport, 1.0 puts
  // the viewport's TOP only 20% down the page. Converting this into a
  // position on the page needs page_height AND viewport_height — both are
  // recorded alongside it for exactly that reason. See framePlate/geometry/
  // deriveVisitGeometry.ts for the conversion.
  //
  // scrollHeight is read off documentElement (matching getPageHeightPayload
  // below), not body — the two disagree on some layouts, and reading one
  // from each box here would make the numerator and denominator inconsistent.
  function getScrollDepth() {
    const scrolled = window.scrollY;
    const height = getPageHeightPx() - window.innerHeight;
    return height > 0 ? Math.round((scrolled / height) * 100) / 100 : 0;
  }

  function getPageHeightPx() {
    return document.documentElement.scrollHeight || document.body.scrollHeight || 0;
  }

  // TALLEST the page has been during this page view. A height read at one instant is often too short: images and
  // lazy content load after the first paint, and in a single-page app the new route's content renders after the URL
  // changes. Reading only the first value drew those pages as short plates. noteHeight() is called when the page
  // loads, when its size changes (ResizeObserver, below) and while the visitor scrolls; getPageHeightPayload()
  // reports the larger of "now" and this. It resets in openPageView().
  let observedMaxHeight = 0;
  function noteHeight() {
    try {
      const h = getPageHeightPx();
      if (h > observedMaxHeight) observedMaxHeight = h;
    } catch (e) {}
  }

  // Keep observedMaxHeight current without polling: when the page's box changes size (content loaded, route rendered,
  // accordion opened) and once the page has fully loaded. Debounced; costs nothing while the page is still.
  (function () {
    let timer = null;
    function schedule() {
      if (timer) return;
      timer = setTimeout(function () {
        timer = null;
        noteHeight();
      }, 300);
    }
    try {
      if (typeof ResizeObserver === "function") {
        const ro = new ResizeObserver(schedule);
        ro.observe(document.documentElement);
        if (document.body) ro.observe(document.body);
        else document.addEventListener("DOMContentLoaded", function () { if (document.body) ro.observe(document.body); schedule(); });
      }
    } catch (e) {}
    window.addEventListener("load", function () {
      schedule();
      setTimeout(noteHeight, 1500); // late images and embeds
    });
  })();

  function getViewportHeightPx() {
    return window.innerHeight || document.documentElement.clientHeight || 0;
  }

  function getViewportWidthPx() {
    return window.innerWidth || document.documentElement.clientWidth || 0;
  }

  // ─────────────────────────────────────────────────────────────────────
  // VISITOR + SESSION
  //
  // A session is one continuous visit. It lives in localStorage so EVERY
  // window and tab of this site, on this browser, shares it (sessionStorage
  // gave each tab its own, which is what made one person look like several).
  // It ends only by idle: 30 minutes with no activity in any window. Closing
  // a tab, reloading, or moving between pages does NOT end it.
  // ─────────────────────────────────────────────────────────────────────
  const visitor_id = getVisitorId();

  const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
  const SESSION_KEY = "jh_session";
  let memorySession = null; // used when localStorage is blocked
  let session_id = null; // set by ensureSession(), the first time this window is active
  let lastSessionTouch = 0;

  function readSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return memorySession;
      const s = JSON.parse(raw);
      return s && typeof s.id === "string" && typeof s.last === "number" ? s : null;
    } catch (e) {
      return memorySession;
    }
  }
  function writeSession(s) {
    memorySession = s;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(s));
    } catch (e) {}
  }

  // Marks the shared session alive "now". Cheap: throttled to once per 5 s.
  function touchSession() {
    const now = Date.now();
    if (now - lastSessionTouch < 5000) return;
    lastSessionTouch = now;
    const s = readSession();
    if (s && s.id === session_id) {
      s.last = now;
      writeSession(s);
    }
  }

  // Makes session_id the live shared session, starting a new one if the last
  // one has been idle too long. Returns true only when a NEW session started
  // (the caller then sends session_start). A session that another window
  // already started is simply adopted: that window announced it.
  function ensureSession() {
    const now = Date.now();
    const s = readSession();
    if (s && now - s.last < SESSION_IDLE_TIMEOUT_MS) {
      session_id = s.id;
      s.last = now;
      lastSessionTouch = now;
      writeSession(s);
      return false;
    }
    if (s) {
      // The old session ended when its last activity happened, not now (now
      // may be days later). Finalize this window's forms, then close it.
      for (const fn of sessionEndListeners) {
        try {
          fn();
        } catch (err) {
          jhLog("[Tracker] sessionEndListener error:", err);
        }
      }
      sendEvent({ type: "session_end", visitor_id, session_id: s.id, ended_ago_ms: Math.max(0, now - s.last) });
    }
    const fresh = { id: uuid(), last: now, started: now };
    writeSession(fresh);
    // Another window may have started its own in the same instant: the one in
    // storage wins, and we adopt it instead of making a duplicate visit.
    const back = readSession();
    if (back && back.id !== fresh.id && now - back.last < 5000) {
      session_id = back.id;
      return false;
    }
    session_id = fresh.id;
    lastSessionTouch = now;
    jhLog("[Tracker] new session:", session_id);
    return true;
  }

  // UTM params are only on the URL of the landing page a campaign link pointed
  // at, so they are read at session_start. gclid/fbclid are the ad networks'
  // own click ids, used as a fallback source when utm_source is absent.
  function getUtmParams() {
    try {
      const params = new URLSearchParams(window.location.search);
      let source = params.get("utm_source");
      let medium = params.get("utm_medium");
      const campaign = params.get("utm_campaign");
      if (!source && params.get("gclid")) {
        source = "google";
        medium = medium || "cpc";
      } else if (!source && params.get("fbclid")) {
        source = "facebook";
        medium = medium || "paid_social";
      }
      return { utm_source: source || null, utm_medium: medium || null, utm_campaign: campaign || null };
    } catch (err) {
      return { utm_source: null, utm_medium: null, utm_campaign: null };
    }
  }

  function fireSessionStart() {
    sendEvent({
      type: "session_start",
      visitor_id,
      session_id,
      referrer: document.referrer || null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      user_agent: navigator.userAgent,
      page_url: window.location.href,
      page_path: window.location.pathname,
      device_type: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
      is_first_visit: freshVisitor || undefined,
      ...getUtmParams(),
    });
    freshVisitor = false;
  }



  /////////////////////////////////////////////
  // Mutable — resets on every new page view (tab return)
  let page_view_id = uuid();
  let startTime = Date.now();

  // Other independent sections (e.g. form engagement, below) can register a
  // callback here to run at the exact moments this file already detects the
  // visitor leaving the CURRENT PAGE — tab hidden, SPA route change —
  // without needing to duplicate that detection themselves. Called from
  // firePageViewEnd() BEFORE page_view_id/page state is reset by whichever
  // caller invoked it, so a listener still sees the page that's ending, not
  // whatever comes next. Deliberately does NOT fire specifically for a true
  // session end (tab closing for good) — see sessionEndListeners below —
  // leaving a page is not the same event as leaving the site, even though
  // in practice visibilitychange→hidden often fires moments before a real
  // tab close too; that's incidental timing, not something to build on.
  const pageLeaveListeners = [];
  // Fires only at a TRUE session-ending moment: ensureSession() finding the
  // previous session idle for 30 minutes (it then closes that OLD session). Anything that must only finalize once the visitor is
  // truly gone — not just off this particular page — belongs here instead
  // of pageLeaveListeners.
  const sessionEndListeners = [];
  // Callbacks run each time a page view OPENS (structure capture, health report).
  const pageOpenListeners = [];
  // Shared by the three form sections (generic capture, HubSpot, iframe providers): the site's form
  // mode from /api/site-config, and callbacks waiting for it to arrive.
  const jhState = { configLoaded: false, specifyFormMode: false, waiters: [] };
  function jhWhenConfigured(fn) {
    if (jhState.configLoaded) fn();
    else jhState.waiters.push(fn);
  }
// ── MAX SCROLL TRACKING ──
  // These reset on every new page view alongside page_view_id and startTime
  // maxScrollDepth: highest scroll fraction (0–1) reached on this page view.
  // Initialized to the real entry point (set right after firePageViewStart
  // measures it), never to 0 — a page_view can open mid-scroll, and seeding
  // this at 0 would make scrolling UP from a mid-page entry look like it
  // "reached a new deepest point" the moment it dipped below the entry depth.
  let maxScrollDepth = getScrollDepth();
  let maxScrollReachedAt = null;
  // revisitStartDepth: the shallowest (topmost) scroll fraction reached while
  // backtracking below the current maxScrollDepth. Only ever decreases —
  // never reset, including when a new deepest point is reached — so it ends
  // up tracking the global minimum reached after the first backtrack, across
  // however many separate descend/backtrack phases happen in the visit.
  // Together with maxScrollDepth this marks the "seen more than once" band:
  // [revisitStartDepth, maxScrollDepth] was necessarily crossed at least
  // twice — once descending to maxScrollDepth, once climbing back up to
  // revisitStartDepth — regardless of how much bouncing happened in between,
  // including multiple distinct deepening phases.
  let revisitStartDepth = null;
  //////////
  // All sends go through _originalFetch (never the patched window.fetch below,
  // which would scan forms on the tracker's own requests) as text/plain with
  // the key in the body: that is a CORS "simple request", so there is no
  // preflight OPTIONS round-trip before each one.
  function withCommon(event) {
    return Object.assign({ api_key: apiKey, host: window.location.host }, event);
  }
  const SEND_HEADERS = { "Content-Type": "text/plain;charset=UTF-8" };

  function sendEvent(event) {
    try {
      _originalFetch(API_URL, {
        method: "POST",
        headers: SEND_HEADERS,
        body: JSON.stringify([withCommon(event)]),
        keepalive: true,
        credentials: "omit",
      }).catch((err) => jhLog("[Tracker] send failed:", err));
    } catch (e) {}
  }

  // For the moments the page is going away: keepalive fetch survives unload,
  // sendBeacon is the fallback.
  function sendExitEvent(event) {
    const body = JSON.stringify([withCommon(event)]);
    let sent = false;
    try {
      _originalFetch(API_URL, { method: "POST", headers: SEND_HEADERS, body, keepalive: true, credentials: "omit" }).catch(function () {});
      sent = true;
    } catch (e) {}
    if (!sent) {
      try {
        navigator.sendBeacon(API_URL, new Blob([body], { type: "text/plain;charset=UTF-8" }));
      } catch (e) {}
    }
  }

  // ── PAGE HEIGHT TRACKER ──────────────────────────────────────────────────
// Reads page height at start time. Throttled: only sends if height changed
// OR more than PAGE_HEIGHT_UPDATE_INTERVAL_MS has passed since last send.
// Stored in sessionStorage so it persists across page navigations in same tab.
const PAGE_HEIGHT_UPDATE_INTERVAL_MS = 6 * 60 * 1000; // 6 minutes

function getPageHeightPayload() {
  try {
    const currentHeight = Math.max(getPageHeightPx(), observedMaxHeight);
    const storageKey = "jh_ph_" + window.location.pathname;
    const stored = sessionStorage.getItem(storageKey);
    const now = Date.now();

    if (stored) {
      const { height: lastHeight, ts: lastTs } = JSON.parse(stored);
      const timeSinceLast = now - lastTs;
      const heightChanged = Math.abs(currentHeight - lastHeight) > 50; // 50px threshold

      // Within 6 min AND height unchanged → skip sending page_height
      if (timeSinceLast < PAGE_HEIGHT_UPDATE_INTERVAL_MS && !heightChanged) {
        return null; // don't include page_height in this event
      }
    }

    // Either enough time passed OR height changed — update storage and include height
    sessionStorage.setItem(storageKey, JSON.stringify({ height: currentHeight, ts: now }));
    return currentHeight;
  } catch (err) {
    jhLog("[Tracker] page height error:", err);
    return null;
  }
}

function firePageViewStart() {
  const pageHeight = getPageHeightPayload();
  // Never assume the visitor entered at the top — they might be returning
  // to a tab that was already scrolled partway down (visibilitychange
  // re-fires a page_view_start without reloading the page/DOM). Measure the
  // real scroll position at this exact moment instead.
  const entryScroll = getScrollDepth();
  // viewport_height is NOT cosmetic — every scroll_depth value is a fraction
  // of (page_height - viewport_height), so without it a scroll fraction
  // cannot be converted back into a position on the page at all. Sent on
  // every page_view_start (unthrottled, unlike page_height): it changes on
  // rotate/resize and is 4 bytes.
  const viewportHeight = getViewportHeightPx();
  const event = {
    type: "page_view_start",
    visitor_id,
    session_id,
    page_view_id,
    page_url: window.location.href,
    page_path: window.location.pathname,
    page_title: document.title,
    referrer: document.referrer,
    language: navigator.language,
    user_agent: navigator.userAgent,
    device_type: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
    entry_scroll: entryScroll,
    viewport_height: viewportHeight,
    viewport_width: getViewportWidthPx(),
  };
  // Only attach page_height when throttle allows
  if (pageHeight !== null) {
    event.page_height = pageHeight;
    jhLog("[Tracker] 📐 Sending page_height:", pageHeight, "for", window.location.pathname);
  }
  jhLog("[Tracker] 🚩 entry_scroll:", entryScroll.toFixed(3), "| viewport_height:", viewportHeight, "for", window.location.pathname);
  sendEvent(event);
}

  function firePageViewEnd(endAtMs) {
    // Let independent sections react to "the visitor is leaving this page"
    // before anything below changes page_view_id/page state. A listener
    // throwing must never break analytics — that's the whole reason this is
    // a plain loop with its own try/catch per callback, not a direct call.
    for (const fn of pageLeaveListeners) {
      try {
        fn();
      } catch (err) {
        jhLog("[Tracker] ❌ pageLeaveListener error:", err);
      }
    }
    // scroll_depth: position when leaving (existing column, keep for backward compat)
    // max_scroll_depth: deepest point ever reached during this page view
    // max_scroll_reached_at: when that deepest point was first hit
    // revisit_start_scroll: null if never backtracked; otherwise the top of
    // the "seen more than once" band (see revisitStartDepth comment above)
    const exitScroll = getScrollDepth();
    // Re-measure page_height here too, not just at page_view_start. The
    // start measurement can run before images/lazy content have finished
    // loading and pushed the page taller — firing before window.load isn't
    // even required for that to happen, since a below-the-fold <img> without
    // reserved width/height reflows the page the moment it loads, whether
    // that's before or after "load". By page_view_end the visitor has been
    // on the page for a while, so this is almost always the more accurate
    // number. getPageHeightPayload()'s own 50px-changed check means this
    // only actually sends (and only overwrites the row) when the height
    // genuinely grew — it does not defeat the 6-minute throttle for no reason.
    const exitPageHeight = getPageHeightPayload();
    jhLog(
      "[Tracker] 📜 page_view_end scroll summary — exit:",
      exitScroll.toFixed(3),
      "| max:",
      maxScrollDepth.toFixed(3),
      "| max_at:",
      maxScrollReachedAt,
      "| revisit_start:",
      revisitStartDepth === null ? "none" : revisitStartDepth.toFixed(3)
    );
    if (exitPageHeight !== null) {
      jhLog("[Tracker] 📐 Sending corrected page_height at exit:", exitPageHeight, "for", window.location.pathname);
    }
    sendExitEvent({
      type: "page_view_end",
      visitor_id,
      session_id,
      page_view_id,
      duration: Math.max(0, (endAtMs || Date.now()) - startTime),
      // "ended N ms ago", not a clock time: the server dates it from its own clock, so a visitor whose computer clock is wrong cannot skew it.
      ended_ago_ms: endAtMs ? Math.max(0, Date.now() - endAtMs) : undefined,
      scroll_depth: exitScroll,
      max_scroll_depth: maxScrollDepth,
      max_scroll_reached_at: maxScrollReachedAt,
      revisit_start_scroll: revisitStartDepth,
      page_height: exitPageHeight,
      // Also sent here so the synthetic-insert fallback path (page_view_end
      // arriving with no matching page_view_start row) still lands a usable
      // viewport_height rather than a row whose scroll values can't be read.
      viewport_height: getViewportHeightPx(),
      device_type: /Mobi|Android/i.test(navigator.userAgent) ? "mobile" : "desktop",
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // PAGE VIEW LIFECYCLE + ONE ACTIVE WINDOW
  //
  // At most ONE window of this site records a page view at a time, so the
  // same person with the site open twice never produces overlapping or
  // doubled page views. The active window is the one the visitor last used:
  // when a window is used it claims "active" (localStorage + BroadcastChannel);
  // any other window with an open page view closes it and waits. Using that
  // window again claims it back. Visibility, focus, idle and SPA route
  // changes all go through openPageView / closePageView below.
  // ─────────────────────────────────────────────────────────────────────
  let pageViewOpen = false;
  let lastInteractionAt = Date.now();
  let lastHeartbeatAt = Date.now();
  let lastClaimAt = 0;

  const tabId = uuid();
  const ACTIVE_KEY = "jh_active";
  const ACTIVE_FRESH_MS = 60 * 1000;
  const HEARTBEAT_MS = 5 * 60 * 1000;
  let channel = null;
  try {
    if (typeof BroadcastChannel === "function") channel = new BroadcastChannel("jh_" + apiKey.slice(0, 8));
  } catch (e) {}

  function readActive() {
    try {
      const raw = localStorage.getItem(ACTIVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
  function claimActive() {
    lastClaimAt = Date.now();
    try {
      localStorage.setItem(ACTIVE_KEY, JSON.stringify({ tab: tabId, ts: lastClaimAt }));
    } catch (e) {}
    try {
      if (channel) channel.postMessage({ claim: tabId, ts: lastClaimAt });
    } catch (e) {}
  }
  function otherWindowRecentlyActive() {
    const a = readActive();
    return !!a && a.tab !== tabId && Date.now() - a.ts < ACTIVE_FRESH_MS;
  }
  // Another window was just used: this one steps aside until used again.
  // It ends its page view as of the moment the other window claimed (not
  // "now", a few ms later), so the two page views do not overlap.
  function onOtherClaimed(claimTs) {
    if (pageViewOpen) {
      jhLog("[Tracker] another window is active, pausing this one");
      closePageView(typeof claimTs === "number" && claimTs > startTime ? Math.min(claimTs, Date.now()) : undefined);
    }
  }
  if (channel) {
    channel.onmessage = function (e) {
      if (e && e.data && e.data.claim && e.data.claim !== tabId) onOtherClaimed(e.data.ts);
    };
  }
  // Storage events reach every OTHER window of the origin: the fallback where
  // BroadcastChannel is missing, and harmless (idempotent) where both fire.
  window.addEventListener("storage", function (e) {
    if (e.key !== ACTIVE_KEY || !e.newValue) return;
    try {
      const a = JSON.parse(e.newValue);
      if (a && a.tab !== tabId) onOtherClaimed(a.ts);
    } catch (err) {}
  });

  function openPageView() {
    if (pageViewOpen) return;
    page_view_id = uuid();
    startTime = Date.now();
    maxScrollDepth = getScrollDepth(); // seed at the entry point, not 0
    maxScrollReachedAt = null;
    revisitStartDepth = null;
    // Start empty, NOT from the current height: in a single-page app the previous route's content is still in the page for a
    // moment after the URL changes, and seeding from it would make this page look as tall as the last one. The size observer
    // (above) and the scroll sampler fill it in once this page's own content is there.
    observedMaxHeight = 0;
    pageViewOpen = true;
    firePageViewStart();
    for (const fn of pageOpenListeners) {
      try {
        fn();
      } catch (err) {
        jhLog("[Tracker] pageOpenListener error:", err);
      }
    }
  }

  // endAtMs: when the visitor really stopped (idle close). Default: now.
  function closePageView(endAtMs) {
    if (!pageViewOpen) return;
    pageViewOpen = false;
    firePageViewEnd(endAtMs);
  }

  // This window becomes the active one and opens a page view if it has none.
  function activate() {
    if (document.visibilityState === "hidden") return;
    claimActive();
    if (pageViewOpen) return;
    if (ensureSession()) fireSessionStart();
    openPageView();
  }

  // Only things a person does count as use. (Scroll events also fire when
  // the page scrolls itself, so they must not claim the active window.)
  const CLAIMING_EVENTS = ["pointerdown", "keydown", "touchstart", "wheel"];
  function onClaimingInteraction(e) {
    if (e && e.isTrusted === false) return;
    const now = Date.now();
    lastInteractionAt = now;
    if (document.visibilityState === "hidden") return;
    if (!pageViewOpen) {
      activate();
      return;
    }
    touchSession();
    if (now - lastClaimAt > 10000) claimActive();
  }
  CLAIMING_EVENTS.forEach(function (ev) {
    window.addEventListener(ev, onClaimingInteraction, { passive: true, capture: true });
  });
  // Mouse movement only keeps an already-active window from going idle.
  window.addEventListener(
    "mousemove",
    function () {
      if (pageViewOpen) lastInteractionAt = Date.now();
    },
    { passive: true, capture: true }
  );

  // Idle + heartbeat. Idle: nothing used for 30 minutes closes the page view
  // as of the last use; the visitor coming back starts a new session. The
  // heartbeat tells the server the visit is still going (it is the only
  // thing keeping a long, quiet read from being swept as idle).
  setInterval(function () {
    if (!pageViewOpen) return;
    const now = Date.now();
    if (now - lastInteractionAt >= SESSION_IDLE_TIMEOUT_MS) {
      jhLog("[Tracker] idle, closing page view");
      closePageView(lastInteractionAt);
      return;
    }
    if (now - lastHeartbeatAt >= HEARTBEAT_MS) {
      lastHeartbeatAt = now;
      touchSession();
      sendEvent({ type: "heartbeat", visitor_id, session_id });
    }
  }, 30 * 1000);

  const mayActivateNow = () => document.hasFocus() || !otherWindowRecentlyActive();

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") closePageView();
    else if (mayActivateNow()) activate();
  });
  window.addEventListener("focus", function () {
    if (document.visibilityState !== "hidden") activate();
  });
  // Last chance on unload and when a page goes into the back/forward cache.
  window.addEventListener("pagehide", function () {
    closePageView();
  });
  window.addEventListener("pageshow", function (e) {
    if (e.persisted && document.visibilityState !== "hidden" && mayActivateNow()) activate();
  });

  // INITIAL LOAD: a page that loads hidden waits for visibilitychange; a
  // visible one that is not focused while another window is in use also waits
  // for the visitor to actually use it.
  if (document.visibilityState !== "hidden" && mayActivateNow()) activate();

// ─────────────────────────────────────────────────────────────────────────
  // NEXT.JS CLIENT-SIDE NAVIGATION HANDLER
  //
  // Next.js uses history.pushState for all client-side route changes.
  // This never triggers visibilitychange or beforeunload, so the old
  // page_view row stays open forever (null left_at, null time_on_page).
  //
  // Fix: intercept pushState and replaceState to:
  //   1. Close the current page_view (firePageViewEnd)
  //   2. Open a new page_view for the new route (firePageViewStart)
  //
  // popstate handles browser back/forward buttons.
  // ─────────────────────────────────────────────────────────────────────────
  (function () {
    const _origPushState = history.pushState.bind(history);
    const _origReplaceState = history.replaceState.bind(history);

    // Tracks the path we last opened a page_view for. This is compared
    // against the path BEFORE each pushState/replaceState call runs — never
    // against window.location AFTER the call, because by then location has
    // already been updated to match the incoming url, making any
    // before/after comparison at that point trivially true and blind to
    // whether a real navigation happened.
    //
    // Next.js's own router calls history.pushState/replaceState internally
    // for router-cache bookkeeping and streaming hydration — not just for
    // real navigations — so without this guard, every one of those internal
    // calls was closing and reopening a page_view for a page the visitor
    // never actually left, inflating page view counts on a single page load.
    let lastTrackedPath = window.location.pathname;

    function resolvePath(url) {
      if (typeof url !== "string") return window.location.pathname;
      return url.replace(/^https?:\/\/[^/]+/, "").split("?")[0].split("#")[0];
    }

    function handleRouteChange(newUrl, oldPath) {
      const newPath = resolvePath(newUrl);

      if (newPath === oldPath) {
        jhLog("[Tracker] Path unchanged (internal history call, not a real navigation) — skipping:", newPath);
        return;
      }

      lastTrackedPath = newPath;
      // A paused window records nothing now: it opens fresh on whatever URL it
      // is on when the visitor next uses it.
      if (!pageViewOpen) return;
      jhLog("[Tracker] route change", oldPath, "->", newPath);
      closePageView();
      // a brief tick so window.location is up to date for the new page view
      setTimeout(function () {
        openPageView();
      }, 50);
    }

    history.pushState = function (state, title, url) {
      const oldPath = lastTrackedPath;
      _origPushState(state, title, url);
      handleRouteChange(url, oldPath);
    };

    history.replaceState = function (state, title, url) {
      const oldPath = lastTrackedPath;
      _origReplaceState(state, title, url);
      // replaceState is used by Next.js scroll restoration and internal
      // router bookkeeping — only handle it if the path actually changed.
      handleRouteChange(url, oldPath);
    };

    window.addEventListener("popstate", function () {
      handleRouteChange(window.location.pathname, lastTrackedPath);
    });

    jhLog("[Tracker] ✅ Next.js pushState route handler active");
  })();
// ─────────────────────────────────────────────────────────────────────────
  // MAX SCROLL DEPTH TRACKER — fully independent, never affects other sections
  // Tracks the deepest scroll position reached during a page view.
  // Only writes to DB at page_view_end — zero extra network requests.
  // Updates maxScrollDepth and maxScrollReachedAt in the outer scope.
  // ─────────────────────────────────────────────────────────────────────────
  (function () {
    // Throttle scroll events — we only need to check ~4x per second max
    // Avoids performance issues on long/fast scrolls
    var _scrollThrottleTimer = null;
    var SCROLL_THROTTLE_MS = 250;

    function onScroll() {
      if (_scrollThrottleTimer) return; // already scheduled
      _scrollThrottleTimer = setTimeout(function () {
        _scrollThrottleTimer = null;
        noteHeight();
        try {
          var scrolled = window.scrollY;
          var height = getPageHeightPx() - window.innerHeight; // same basis as getScrollDepth()
          if (height <= 0) return; // page not tall enough to scroll

          var currentDepth = Math.round((scrolled / height) * 100) / 100;
          // Clamp to 0–1 range (some browsers give slightly negative or >1)
          currentDepth = Math.min(1, Math.max(0, currentDepth));

          if (currentDepth > maxScrollDepth) {
            // New deepest point. revisitStartDepth is intentionally left
            // alone here — it's a running global minimum, not scoped to
            // "since the current max," so an earlier backtrack stays on
            // record even after the visitor descends past their old max.
            maxScrollDepth = currentDepth;
            maxScrollReachedAt = new Date().toISOString();
            jhLog("[Tracker] 📜 New max scroll depth:", maxScrollDepth.toFixed(3), "at", maxScrollReachedAt);
          } else if (revisitStartDepth === null || currentDepth < revisitStartDepth) {
            // Not a new deepest point — climbing back up (or already at a
            // new high point of this backtrack). Only updates when they go
            // HIGHER than any point already seen during this backtrack;
            // scrolling back down without exceeding that doesn't move it.
            revisitStartDepth = currentDepth;
            jhLog("[Tracker] 🔁 New revisit-start depth:", revisitStartDepth.toFixed(3));
          }
        } catch (err) {
          jhLog("[Tracker] ❌ Max scroll tracking error:", err);
        }
      }, SCROLL_THROTTLE_MS);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    jhLog("[Tracker] ✅ Max scroll depth tracker active (throttle=" + SCROLL_THROTTLE_MS + "ms)");
  })();
  // ─────────────────────────────────────────────────────────────────────────
// -------------------------------------------------------
  // FORM CAPTURE — fully independent, never affects analytics
  // if this entire block throws, analytics above is unaffected
  // -------------------------------------------------------
  // -------------------------------------------------------
// -------------------------------------------------------
// FORM CAPTURE — fully independent, never affects analytics
// -------------------------------------------------------
// -------------------------------------------------------
// FORM CAPTURE — fully independent, never affects analytics
// -------------------------------------------------------
(function () {
  const FORM_API_URL = `${API_BASE}/api/track-form`;
  const SITE_CONFIG_URL = `${API_BASE}/api/site-config`;

  const NAME_KEYS = ["name", "full_name", "fullname", "first_name", "firstname", "your_name", "contact_name", "fname", "full name", "fullname"];
  const EMAIL_KEYS = ["email", "email_address", "emailaddress", "your_email", "contact_email", "mail", "e-mail"];
  const PHONE_KEYS = ["phone", "phone_number", "phonenumber", "tel", "telephone", "mobile", "cell"];

  function normalize(str) {
    return (str || "").toLowerCase().replace(/[-\s]/g, "_");
  }

  function getInputValue(input) {
    return input.value || "";
  }

  function getAllInputs(form) {
    return Array.from(form.querySelectorAll(
      "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='checkbox']):not([type='radio']), textarea, select"
    ));
  }

  function extractEmail(form) {
    const emailInputs = form.querySelectorAll('input[type="email"]');
    for (const el of emailInputs) {
      const val = getInputValue(el);
      if (val && val.includes("@") && val.includes(".")) return val.trim();
    }
    const tracked = form.querySelector('[data-track="email"]');
    if (tracked) {
      const val = getInputValue(tracked);
      if (val && val.includes("@")) return val.trim();
    }
    const allInputs = getAllInputs(form);
    for (const input of allInputs) {
      const signals = [
        input.name, input.id, input.placeholder,
        input.getAttribute("aria-label"), input.getAttribute("autocomplete")
      ].map(s => normalize(s || ""));
      const isEmailField = signals.some(s => EMAIL_KEYS.some(k => s.includes(normalize(k))));
      if (isEmailField) {
        const val = getInputValue(input);
        if (val && val.includes("@")) return val.trim();
      }
    }
    for (const input of allInputs) {
      const val = getInputValue(input);
      if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return val.trim();
    }
    return null;
  }

  // The text of the label a field carries (<label for>, wrapping <label>, aria-labelledby): the best
  // hint when a plugin names its inputs input_1_3 or wpforms[fields][0][first].
  function labelTextOf(input) {
    try {
      let t = "";
      if (input.labels && input.labels.length) t = Array.from(input.labels).map(function (l) { return l.textContent; }).join(" ");
      if (!t) {
        const ids = input.getAttribute("aria-labelledby");
        const el = ids ? document.getElementById(ids.split(" ")[0]) : null;
        if (el) t = el.textContent;
      }
      return (t || "").trim().slice(0, 60);
    } catch (e) {
      return "";
    }
  }
  function signalsOf(input) {
    return [input.name, input.id, input.placeholder, input.getAttribute("aria-label"), input.getAttribute("autocomplete"), labelTextOf(input)].map(function (x) {
      return normalize(x || "");
    });
  }
  const NOT_A_PERSON = /company|business|organi[sz]ation|user_?name|file_?name|domain|project|product|brand|team|school|account/;
  const FIRST_RE = /(^|[^a-z])(first(_?name)?|given(_?name)?|fname|forename)([^a-z]|$)/;
  const LAST_RE = /(^|[^a-z])(last(_?name)?|family(_?name)?|surname|lname)([^a-z]|$)/;

  // First + last name when the form splits them (Salesforce, Marketo, HubSpot, Gravity Forms, WPForms),
  // otherwise the one full-name field.
  function extractName(form) {
    const tracked = form.querySelector('[data-track="name"]');
    if (tracked && getInputValue(tracked)) return getInputValue(tracked).trim();
    let first = "";
    let last = "";
    let full = "";
    for (const input of getAllInputs(form)) {
      if (input.type === "email" || input.type === "tel") continue;
      const val = getInputValue(input).trim();
      if (!val) continue;
      const sig = signalsOf(input);
      if (sig.some(function (x) { return NOT_A_PERSON.test(x); })) continue;
      if (!last && sig.some(function (x) { return LAST_RE.test(x); })) {
        last = val;
        continue;
      }
      if (!first && sig.some(function (x) { return FIRST_RE.test(x); })) {
        first = val;
        continue;
      }
      if (!full && sig.some(function (x) { return NAME_KEYS.some(function (k) { return x.indexOf(normalize(k)) !== -1; }); })) full = val;
    }
    if (first || last) return (first + " " + last).trim();
    return full || null;
  }

  function extractPhone(form) {
    const telInput = form.querySelector('input[type="tel"]');
    if (telInput && getInputValue(telInput)) return getInputValue(telInput).trim();
    const tracked = form.querySelector('[data-track="phone"]');
    if (tracked && getInputValue(tracked)) return getInputValue(tracked).trim();
    for (const input of getAllInputs(form)) {
      const sig = signalsOf(input);
      if (sig.some(function (x) { return x.indexOf("fax") !== -1; })) continue;
      if (sig.some(function (x) { return PHONE_KEYS.some(function (k) { return x.indexOf(normalize(k)) !== -1; }); })) {
        const val = getInputValue(input);
        if (val) return val.trim();
      }
    }
    return null;
  }

  // data-track-field: when a form has ANY marked field, only the marked ones
  // are tracked (timings, raw_data). A form with none marked tracks every
  // field, as before. Name/email/phone detection for the lead is NOT limited.
  function fieldAllowed(form, input) {
    if (!form.querySelector("[data-track-field]")) return true;
    const host = input.closest("[data-track-field]");
    return !!host && form.contains(host);
  }

  function buildRawData(form) {
    const raw = {};
    const allInputs = getAllInputs(form);
    for (const input of allInputs) {
      if (!fieldAllowed(form, input)) continue;
      const key = input.name || input.id || input.placeholder || "field_" + Math.random().toString(36).slice(2, 6);
      const val = getInputValue(input);
      if (normalize(key).includes("password") || normalize(key).includes("passwd")) continue;
      if (val) raw[key] = val;
    }
    return raw;
  }

  function shouldSkip(form) {
    if (form.querySelector('input[type="password"]')) return true;
    if (form.getAttribute("role") === "search") return true;
    if (form.querySelector('input[type="search"]')) return true;
    const inputs = getAllInputs(form);
    if (inputs.length === 1 && inputs[0].type !== "email") return true;
    return false;
  }

  // ─────────────────────────────────────────────────────────────────────
  // CONFIG STATE
  //
  // configLoaded: false until the /api/site-config fetch completes.
  //   All form submissions that arrive BEFORE config loads are queued
  //   in pendingForms and replayed once config is known.
  //
  // specifyFormMode:
  //   false → capture ALL forms that pass shouldSkip() (original behavior)
  //   true  → ONLY capture forms with data-conversion="true" attribute
  // ─────────────────────────────────────────────────────────────────────
  let configLoaded = false;
  let specifyFormMode = false; // safe default until fetch resolves

  // Queue: stores { form, submittedViaFetch } objects that arrived before config loaded
  const pendingForms = [];

  // ─────────────────────────────────────────────────────────────────────
  // DEDUPE — a single real submission can trigger BOTH capture methods
  // below: the native "submit" event (capture phase, fires even when the
  // page's own handler calls preventDefault() afterward) AND the fetch
  // interceptor (when that same handler then calls fetch() to actually
  // submit). Both call sendFormCapture() for the same form a few ms apart,
  // which without this guard inserts two identical form_submissions rows.
  // Keyed on the captured field values (not the form element) since the
  // two call sites can observe the form at slightly different DOM states.
  // ─────────────────────────────────────────────────────────────────────
  let lastCaptureSignature = null;
  let lastCaptureAt = 0;
  const CAPTURE_DEDUPE_WINDOW_MS = 3000;

  // ─────────────────────────────────────────────────────────────────────
  // CORE GATE — called after config is known
  // Returns true if this form should be captured, false if it should be ignored
  // ─────────────────────────────────────────────────────────────────────
  // data-conversion="true" on the form itself OR on any element around it. A form that a vendor's
  // script renders (Marketo, HubSpot, Zoho, Pardot embeds) cannot be given an attribute, so the
  // wrapper the owner controls carries it.
  function isMarkedConversion(el) {
    return !!(el && el.closest && el.closest('[data-conversion="true"]'));
  }

  function isConversionForm(form) {
    if (!specifyFormMode) {
      // Global mode: capture everything that passes shouldSkip
      return true;
    }
    // Specify mode: ONLY forms with data-conversion="true"
    const hasAttr = isMarkedConversion(form);
    if (!hasAttr) {
      jhLog("[Tracker] IGNORED — form missing data-conversion='true':", form);
    }
    return hasAttr;
  }

  // ─────────────────────────────────────────────────────────────────────
  // SEND — fires the actual capture after all gates pass
  // ─────────────────────────────────────────────────────────────────────
  function sendFormCapture(form) {
    try {
      if (!form || form.tagName !== "FORM") {
        jhLog("[Tracker] sendFormCapture called with non-form element:", form);
        return;
      }

      // Gate 1: conversion form check (respects specifyFormMode)
      if (!isConversionForm(form)) return;

      // HubSpot's own form markup is captured by the HubSpot section below, once.
      if (form.classList.contains("hs-form") || (form.id && form.id.indexOf("hsForm_") === 0)) return;

      // Gate 2: skip password forms, search forms, single-field non-email forms
      if (shouldSkip(form)) {
        jhLog("[Tracker] Form skipped by shouldSkip:", form);
        return;
      }

      const email = extractEmail(form);
      const name = extractName(form);
      const phone = extractPhone(form);
      const raw = buildRawData(form);

      // Gate 3: dedupe — see the CAPTURE_DEDUPE_WINDOW_MS comment above.
      const signature = JSON.stringify([email, name, phone, window.location.pathname]);
      const now = Date.now();
      if (signature === lastCaptureSignature && now - lastCaptureAt < CAPTURE_DEDUPE_WINDOW_MS) {
        jhLog("[Tracker] Duplicate form capture suppressed (submit event + fetch interceptor both fired):", signature);
        return;
      }
      lastCaptureSignature = signature;
      lastCaptureAt = now;

      jhLog("[Tracker] ✅ Form captured:", { name, email, phone, raw });
      markEngagementSubmitted(form);

      const payload = {
        api_key: apiKey,
        visitor_id,
        session_id,
        page_url: window.location.href,
        page_path: window.location.pathname,
        name: name || null,
        email: email || null,
        phone: phone || null,
        confidence: email ? "high" : "low",
        raw_data: raw,
        is_labelled_conversion: isMarkedConversion(form),
      };

      _originalFetch(FORM_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(payload),
        credentials: "omit",
        keepalive: true,
      }).then(() => {
        jhLog("[Tracker] ✅ Form payload sent successfully");
      }).catch((err) => {
        jhLog("[Tracker] ❌ Form send error:", err);
      });

    } catch (err) {
      jhLog("[Tracker] ❌ Form capture error:", err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // QUEUE PROCESSOR — replays any forms that submitted before config loaded
  // ─────────────────────────────────────────────────────────────────────
  function processPendingForms() {
    if (pendingForms.length === 0) return;
    jhLog("[Tracker] Processing", pendingForms.length, "queued form submission(s) now that config is loaded");
    for (const { form } of pendingForms) {
      sendFormCapture(form);
    }
    pendingForms.length = 0; // clear the queue
  }

  // ─────────────────────────────────────────────────────────────────────
  // CONFIG FETCH — runs ONCE on page load, non-blocking
  //
  // IMPORTANT: intercept is set up IMMEDIATELY (before fetch resolves)
  // so no submissions are missed. Submissions arriving before config
  // loads go into pendingForms and are replayed after.
  // ─────────────────────────────────────────────────────────────────────
  _originalFetch(`${SITE_CONFIG_URL}?key=${encodeURIComponent(apiKey)}`, {
    credentials: "omit",
  })
    .then(function(r) {
      if (!r.ok) {
        throw new Error("site-config HTTP " + r.status);
      }
      return r.json();
    })
    .then(function(config) {
      specifyFormMode = config.specify_form === true;
      configLoaded = true;
      jhState.specifyFormMode = specifyFormMode;
      jhState.configLoaded = true;
      jhState.waiters.splice(0).forEach(function (fn) {
        try {
          fn();
        } catch (e) {}
      });

      if (specifyFormMode) {
        jhLog("[Tracker] ✅ specify_form=TRUE — ONLY forms with data-conversion='true' will be captured");
      } else {
        jhLog("[Tracker] ✅ specify_form=FALSE — ALL forms will be captured (global mode)");
      }

      // Replay any submissions that queued up before config loaded
      processPendingForms();
    })
    .catch(function(err) {
      // Config fetch failed — default to GLOBAL mode so no conversions are silently lost
      jhLog("[Tracker] ⚠️ site-config fetch failed, defaulting to global mode:", err.message);
      specifyFormMode = false;
      configLoaded = true;
      jhState.specifyFormMode = false;
      jhState.configLoaded = true;
      jhState.waiters.splice(0).forEach(function (fn) {
        try {
          fn();
        } catch (e) {}
      });
      processPendingForms();
      jhLog();
    });

  // ─────────────────────────────────────────────────────────────────────
  // METHOD 1: Native submit event (capture phase — fires before React handlers)
  //
  // If config is not loaded yet: queue the form, process after config arrives.
  // If config is loaded: process immediately.
  // ─────────────────────────────────────────────────────────────────────
  document.addEventListener("submit", function (e) {
    jhLog("[Tracker] Submit event fired on:", e.target);
    if (!configLoaded) {
      jhLog("[Tracker] Config not yet loaded — queuing submission");
      pendingForms.push({ form: e.target });
      return;
    }
    sendFormCapture(e.target);
  }, true);

  // ─────────────────────────────────────────────────────────────────────
  // METHOD 2: Fetch interceptor
  // Catches forms that submit through fetch() with no DOM submit event.
  //
  // Tightened 2026-10-07. It used to look at EVERY fetch on the page (images,
  // analytics, anything) and capture the first form that had an email in it,
  // which produced false conversions. Now it only acts when ALL of these hold:
  //   - the request is not a GET/HEAD (a submission changes something),
  //   - it is not one of the tracker's own requests,
  //   - the visitor used a form in the last 15 seconds (typed in it, focused
  //     it, or clicked inside it), and that form is still on the page,
  //   - that form passes the same gates as any other (not a login/search form,
  //     marked data-conversion="true" when the site is in specify mode),
  //   - it holds an email.
  // Only THAT form is captured, never "the first one on the page".
  // ─────────────────────────────────────────────────────────────────────
  let lastFormInteraction = { form: null, at: 0 };
  function noteFormInteraction(e) {
    try {
      const f = e.target && e.target.closest ? e.target.closest("form") : null;
      if (f) lastFormInteraction = { form: f, at: Date.now() };
    } catch (err) {}
  }
  document.addEventListener("input", noteFormInteraction, true);
  document.addEventListener("focusin", noteFormInteraction, true);
  document.addEventListener("click", noteFormInteraction, true);
  const FETCH_FORM_WINDOW_MS = 15000;

  window.fetch = function (input, init) {
    try {
      const method = String((init && init.method) || (input && input.method) || "GET").toUpperCase();
      const url = typeof input === "string" ? input : input && input.url ? input.url : String(input);
      const isOwn = url.indexOf(API_BASE + "/api/") === 0; // the tracker's own endpoints
      if (method !== "GET" && method !== "HEAD" && !isOwn) {
        const f = lastFormInteraction.form;
        if (f && f.isConnected && Date.now() - lastFormInteraction.at < FETCH_FORM_WINDOW_MS && !shouldSkip(f)) {
          const blockedBySpecifyMode = configLoaded && specifyFormMode && !isMarkedConversion(f);
          if (!blockedBySpecifyMode && extractEmail(f)) {
            jhLog("[Tracker] fetch submission matched the form the visitor just used");
            if (!configLoaded) pendingForms.push({ form: f });
            else sendFormCapture(f);
          }
        }
      }
    } catch (err) {
      jhLog("[Tracker] fetch intercept error:", err);
    }
    return _originalFetch.apply(this, arguments);
  };

  // ─────────────────────────────────────────────────────────────────────
  // FORM ENGAGEMENT TRACKING — viewed / started / submitted / abandoned,
  // plus per-field dwell-time timing.
  //
  // Fully additive to everything above: reuses the same form gate
  // (isConversionForm + shouldSkip) and the same NAME_KEYS/EMAIL_KEYS/
  // PHONE_KEYS classifiers, but a failure here can never block a real
  // submission from being captured — every entry point is try/caught on
  // its own.
  //
  // The DB row is keyed by (session_id, page_path, form_index) SERVER-SIDE,
  // not page_view_id — tabbing away and back always mints a fresh
  // page_view_id, but the same in-progress form-fill must resume, not
  // fork into a disconnected new row. page_view_id is still sent
  // (informational — "most recently touched by this page_view"), it just
  // isn't part of the row's identity anymore. form_index identifies a form
  // the same way page_structure.header_index identifies a header — its
  // position among document.forms on the page.
  //
  // Per-field timing is NEVER sent per keystroke — that would be exactly
  // the chatty-request problem worth avoiding. keydown only ever updates
  // an in-memory timestamp; the only things that trigger a network send
  // are: the form's very first focus (viewed → started), a field actually
  // blurring (flushes that one field's accumulated dwell time), and
  // finalization (submitted/abandoned). A typical form generates roughly
  // one request per field visited, not one per key pressed. The client
  // also never tracks a running CUMULATIVE total for a field — it only
  // ever reports "how long was I focused on this field just now," and the
  // server additively merges that into the durable total (see
  // mergeFieldTimings in the route). That's what makes a full page reload
  // mid-fill (which wipes all of this in-memory state) still accumulate
  // correctly without the client remembering or re-fetching anything.
  // ─────────────────────────────────────────────────────────────────────
  const ENGAGEMENT_API_URL = `${API_BASE}/api/track-form-engagement`;

  // formIndex -> { status, lastFieldType, lastFieldKey, formTopY, formBottomY }
  // Reset whenever page_view_id changes — a form's engagement is scoped to
  // ONE page view, same as everything else keyed by page_view_id. This is
  // local UI/dedup bookkeeping only; it does NOT determine whether the
  // server treats this as a new row — that's the (session_id, page_path,
  // form_index) key server-side, which survives page_view_id changes.
  let engagementState = new Map();
  let engagementPageViewId = null;

  // formIndex -> Map(fieldKey -> { focusStartedAt, keydownAtThisVisit })
  // THIS VISIT's per-field dwell-time clock only — cleared per field the
  // moment it blurs (flushed then) or the whole form finalizes. Never
  // holds a running cross-visit total; see the header comment above.
  let fieldVisitState = new Map();

  function fieldTimingsKey(type, key) {
    return type === "custom" ? "custom:" + (key || "unknown") : type;
  }

  // Builds the one-field delta record sent over the wire, and clears its
  // local dwell-time clock. Shared by the real focusout handler and the
  // submit/abandon "flush whatever's still open" paths, so both produce
  // the exact same shape.
  function buildFieldDelta(formIndex, fieldKey, nowMs) {
    const visits = fieldVisitState.get(formIndex);
    const state = visits && visits.get(fieldKey);
    if (!state) return null;
    visits.delete(fieldKey);
    return {
      firstFocusAt: new Date(state.focusStartedAt).toISOString(),
      firstKeydownAt: state.keydownAtThisVisit != null ? new Date(state.keydownAtThisVisit).toISOString() : null,
      lastUnfocusAt: new Date(nowMs).toISOString(),
      totalFocusedMsDelta: Math.max(0, nowMs - state.focusStartedAt),
    };
  }

  // Flushes EVERY field of this form still mid-focus (normally 0 or 1 —
  // more than one would mean multiple fields somehow never blurred, which
  // shouldn't happen, but this covers it rather than silently dropping
  // data). Used when there's no natural single blur to hang the flush off
  // of: submitting the form, or the visitor leaving entirely.
  function collectOpenFieldDeltas(formIndex, nowMs) {
    const visits = fieldVisitState.get(formIndex);
    if (!visits || visits.size === 0) return null;
    const delta = {};
    for (const fieldKey of Array.from(visits.keys())) {
      delta[fieldKey] = buildFieldDelta(formIndex, fieldKey, nowMs);
    }
    return delta;
  }

  function resetEngagementStateIfNewPageView() {
    if (engagementPageViewId === page_view_id) return;

    const oldEngagementState = engagementState;
    const oldFieldVisitState = fieldVisitState;

    // Mark the transition FIRST — sendEngagementEvent below (used to flush
    // any still-open field) itself calls this function, and would recurse
    // forever if the condition above were still true when it does.
    engagementPageViewId = page_view_id;
    engagementState = new Map();
    fieldVisitState = new Map();

    // Flush any field still mid-focus from the OLD page view before its
    // local clock is discarded — otherwise that dwell time just silently
    // vanishes. Only meaningful for a tab-hidden/visible cycle or
    // idle-split (same JS context, DOM persists); a genuine full page
    // reload wipes this file's whole execution anyway, so there's nothing
    // to flush in that case.
    const nowMs = Date.now();
    for (const [formIndex, visits] of oldFieldVisitState.entries()) {
      if (visits.size === 0) continue;
      const entry = oldEngagementState.get(formIndex);
      const form = document.forms[formIndex];
      if (!entry || !form || entry.status === "submitted" || entry.status === "abandoned") continue;
      const delta = {};
      for (const [fieldKey, state] of visits.entries()) {
        delta[fieldKey] = {
          firstFocusAt: new Date(state.focusStartedAt).toISOString(),
          firstKeydownAt: state.keydownAtThisVisit != null ? new Date(state.keydownAtThisVisit).toISOString() : null,
          lastUnfocusAt: new Date(nowMs).toISOString(),
          totalFocusedMsDelta: Math.max(0, nowMs - state.focusStartedAt),
        };
      }
      sendEngagementEvent(formIndex, form, { status: entry.status }, { fieldTimingsDelta: delta, lastActivityAt: new Date(nowMs).toISOString() });
    }

    // A form that survives across page views (SPA navigation/idle-split
    // without the DOM node being recreated) must be re-armed for view
    // detection here — observeFormForEngagement below only re-observes it
    // if its stamped page_view_id no longer matches the current one.
    // Without this, "viewed" only ever fires on that form's very first
    // page view, and every page view after silently skips straight to
    // started/submitted with no recorded position.
    document.querySelectorAll("form").forEach(observeFormForEngagement);
  }

  function classifyField(input) {
    const signals = [
      input.name, input.id, input.placeholder,
      input.getAttribute("aria-label"), input.getAttribute("autocomplete"),
    ].map((s) => normalize(s || ""));
    if (signals.some((s) => EMAIL_KEYS.some((k) => s.includes(normalize(k))))) return { type: "email", key: null };
    if (signals.some((s) => NAME_KEYS.some((k) => s.includes(normalize(k))))) return { type: "name", key: null };
    if (signals.some((s) => PHONE_KEYS.some((k) => s.includes(normalize(k))))) return { type: "phone", key: null };
    // Doesn't match any known field type — still worth knowing WHERE people
    // give up, so it's reported as a custom field with its raw identifier
    // rather than being dropped.
    return { type: "custom", key: input.name || input.id || input.placeholder || null };
  }

  // persistentPatch merges into engagementState (status/lastFieldType/
  // lastFieldKey/formTopY/formBottomY) and is remembered for future calls.
  // transient (fieldTimingsDelta/lastActivityAt) is send-only — NEVER
  // merged into engagementState, or an already-flushed field delta would
  // get resent on every later unrelated call for this form.
  function sendEngagementEvent(formIndex, form, persistentPatch, transient) {
    try {
      if (!isConversionForm(form)) {
        jhLog("[Tracker] 🟡 Form engagement skipped — isConversionForm() gate failed:", { formIndex, persistentPatch });
        return;
      }
      if (shouldSkip(form)) {
        jhLog("[Tracker] 🟡 Form engagement skipped — shouldSkip() gate failed:", { formIndex, persistentPatch });
        return;
      }
      resetEngagementStateIfNewPageView();
      const entry = engagementState.get(formIndex) || {};
      Object.assign(entry, persistentPatch);
      engagementState.set(formIndex, entry);

      const payload = {
        api_key: apiKey,
        visitor_id,
        session_id,
        page_view_id,
        page_path: window.location.pathname,
        form_index: formIndex,
        status: entry.status,
        last_field_type: entry.lastFieldType || null,
        last_field_key: entry.lastFieldKey || null,
        form_top_y: entry.formTopY ?? null,
        form_bottom_y: entry.formBottomY ?? null,
        has_marked_fields: form.querySelector("[data-track-field]") ? true : undefined,
        field_timings_delta: (transient && transient.fieldTimingsDelta) || undefined,
        last_activity_at: (transient && transient.lastActivityAt) || undefined,
      };
      jhLog("[Tracker] 📋 Form engagement → sending:", payload);
      _originalFetch(ENGAGEMENT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(payload),
        credentials: "omit",
        keepalive: true,
      })
        .then((r) => jhLog("[Tracker] ✅ Form engagement sent, status:", r.status, payload.status))
        .catch((err) => jhLog("[Tracker] ❌ Form engagement send error:", err));
    } catch (err) {
      jhLog("[Tracker] ❌ Form engagement error:", err);
    }
  }

  // ── VIEW DETECTION — fires once per form per page view, the first time it
  // becomes at least half visible. Records its real pixel position at that
  // moment (getBoundingClientRect, same technique page_structure already
  // uses for headers) so the dashboard can draw it where the form actually
  // sits, not a guess. ──
  const engagementObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const form = entry.target;
        const formIndex = Array.from(document.forms).indexOf(form);
        if (formIndex === -1) continue;
        resetEngagementStateIfNewPageView();
        if (engagementState.has(formIndex)) continue; // already recorded for this page view
        const rect = form.getBoundingClientRect();
        const nowIso = new Date().toISOString();
        sendEngagementEvent(
          formIndex,
          form,
          { status: "viewed", formTopY: Math.round(rect.top + window.scrollY), formBottomY: Math.round(rect.bottom + window.scrollY) },
          { lastActivityAt: nowIso }
        );
        engagementObserver.unobserve(form);
      }
    },
    { threshold: 0.5 }
  );

  function observeFormForEngagement(form) {
    try {
      // Stamped with the page_view_id it was last (re-)armed for, not a
      // permanent flag — a form that survives across page views (SPA nav,
      // idle-split) needs "viewed" to fire again for EACH page view, since
      // position/engagement is tracked per page view, not once per DOM
      // element for its whole lifetime.
      if (form.__jhEngagementObservedForPv === page_view_id) return;
      form.__jhEngagementObservedForPv = page_view_id;
      engagementObserver.observe(form);
    } catch (err) {
      jhLog("[Tracker] ❌ Failed to observe form for engagement:", err);
    }
  }

  // The install snippet is a bare <script src="..."> with no defer/async,
  // meant to be pasted in <head> — meaning document.body does not exist yet
  // at the moment this file executes. observe(document.body, ...) on a null
  // body throws synchronously and would have silently killed engagement
  // tracking's setup entirely (observer, focus listener, page-leave hook —
  // none of it ever attaches) with no visible error unless the console
  // happened to be open. Deferred to DOMContentLoaded when needed; runs
  // immediately if body already exists (script placed after it, or a late
  // dynamic injection).
  function initFormEngagementDomWatchers() {
    try {
      document.querySelectorAll("form").forEach(observeFormForEngagement);
      // Catches forms that mount later (SPA navigation, lazy-rendered content) —
      // same reason page structure/HubSpot detection elsewhere in this file
      // also watch the DOM instead of only scanning once at load.
      new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType !== 1) continue;
            if (node.tagName === "FORM") observeFormForEngagement(node);
            if (node.querySelectorAll) node.querySelectorAll("form").forEach(observeFormForEngagement);
          }
        }
      }).observe(document.body, { childList: true, subtree: true });
    } catch (err) {
      jhLog("[Tracker] ❌ Form engagement DOM watcher setup failed:", err);
    }
  }

  if (document.body) {
    initFormEngagementDomWatchers();
  } else {
    document.addEventListener("DOMContentLoaded", initFormEngagementDomWatchers);
  }

  // ── FIELD FOCUS ("started" + per-field dwell-time clock start) — one
  // delegated listener instead of wiring every field individually, so
  // dynamically added fields are covered too. Only sends a network event
  // on the form's very FIRST-ever focus (viewed → started, needed
  // immediately for first_input_at); moving focus to a 2nd/3rd/etc. field
  // of an already-started form only updates local state here — nothing is
  // sent until that field actually blurs. ──
  document.addEventListener(
    "focusin",
    function (e) {
      try {
        const target = e.target;
        if (!target || !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
        const form = target.closest("form");
        if (!form) return;
        if (!fieldAllowed(form, target)) return;
        const formIndex = Array.from(document.forms).indexOf(form);
        if (formIndex === -1) return;
        resetEngagementStateIfNewPageView();
        const existing = engagementState.get(formIndex);
        if (existing && (existing.status === "submitted" || existing.status === "abandoned")) return;

        const { type, key } = classifyField(target);
        const fieldKey = fieldTimingsKey(type, key);
        if (!fieldVisitState.has(formIndex)) fieldVisitState.set(formIndex, new Map());
        fieldVisitState.get(formIndex).set(fieldKey, { focusStartedAt: Date.now(), keydownAtThisVisit: null });

        if (!existing || existing.status === "viewed") {
          sendEngagementEvent(
            formIndex,
            form,
            { status: "started", lastFieldType: type, lastFieldKey: type === "custom" ? key : null },
            { lastActivityAt: new Date().toISOString() }
          );
        } else {
          // Already started — just move the local "currently on this
          // field" pointer, no network call for merely tabbing to another
          // field of a form the server already knows is in progress.
          existing.lastFieldType = type;
          existing.lastFieldKey = type === "custom" ? key : null;
          engagementState.set(formIndex, existing);
        }
      } catch (err) {
        jhLog("[Tracker] ❌ Form engagement focus handler error:", err);
      }
    },
    true
  );

  // ── KEYDOWN — LOCAL ONLY, never a network call. Records the first
  // keystroke in the CURRENT visit to this field (not resent on every
  // key), piggybacked into that field's next blur-flush. This is exactly
  // what keeps this feature from becoming a request-per-keystroke problem. ──
  document.addEventListener(
    "keydown",
    function (e) {
      try {
        const target = e.target;
        if (!target || !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
        const form = target.closest("form");
        if (!form) return;
        if (!fieldAllowed(form, target)) return;
        const formIndex = Array.from(document.forms).indexOf(form);
        if (formIndex === -1) return;
        const visits = fieldVisitState.get(formIndex);
        if (!visits) return;
        const { type, key } = classifyField(target);
        const state = visits.get(fieldTimingsKey(type, key));
        if (state && state.keydownAtThisVisit === null) state.keydownAtThisVisit = Date.now();
      } catch (err) {
        jhLog("[Tracker] ❌ Form engagement keydown handler error:", err);
      }
    },
    true
  );

  // ── FIELD BLUR — the actual flush point. Fires whether the visitor
  // unfocused onto nothing (clicked outside the form) or moved straight to
  // another field — browsers guarantee blur on the old field before focus
  // on the new one, so this always runs first either way. Sends this ONE
  // field's accumulated visit delta; status/form-level fields are
  // untouched (this never finalizes anything). ──
  document.addEventListener(
    "focusout",
    function (e) {
      try {
        const target = e.target;
        if (!target || !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
        const form = target.closest("form");
        if (!form) return;
        if (!fieldAllowed(form, target)) return;
        const formIndex = Array.from(document.forms).indexOf(form);
        if (formIndex === -1) return;
        const entry = engagementState.get(formIndex);
        if (!entry || entry.status === "submitted" || entry.status === "abandoned") return; // nothing left to report against

        const { type, key } = classifyField(target);
        const fieldKey = fieldTimingsKey(type, key);
        const nowMs = Date.now();
        const delta = buildFieldDelta(formIndex, fieldKey, nowMs);
        if (!delta) return; // no matching open visit — nothing to flush

        sendEngagementEvent(
          formIndex,
          form,
          { status: entry.status, lastFieldType: type, lastFieldKey: type === "custom" ? key : null },
          { fieldTimingsDelta: { [fieldKey]: delta }, lastActivityAt: delta.lastUnfocusAt }
        );
      } catch (err) {
        jhLog("[Tracker] ❌ Form engagement blur handler error:", err);
      }
    },
    true
  );

  // ── PAGE LEAVE — tab hidden / SPA route change. Deliberately does NOT
  // finalize the form as abandoned anymore (that used to happen here) —
  // leaving the current PAGE is not the same as leaving the SITE, and the
  // visitor may come straight back and keep filling this exact form in.
  // All this does now is flush whatever field is still open (defensive:
  // some browsers don't reliably fire a native blur just because the tab
  // became hidden), via the exact same hook analytics already uses for
  // "the visitor is leaving this page." Real finalization only happens on
  // a true session end — see sessionEndListeners below and the
  // session_end sweep server-side in /api/track/route.js. ──
  pageLeaveListeners.push(function () {
    resetEngagementStateIfNewPageView();
    for (const [formIndex, entry] of engagementState.entries()) {
      if (entry.status !== "viewed" && entry.status !== "started") continue;
      const form = document.forms[formIndex];
      if (!form) continue;
      const nowMs = Date.now();
      const openDelta = collectOpenFieldDeltas(formIndex, nowMs);
      if (!openDelta) continue; // nothing was open — nothing to flush, status stays as-is
      const nowIso = new Date(nowMs).toISOString();
      sendEngagementEvent(formIndex, form, { status: entry.status }, { fieldTimingsDelta: openDelta, lastActivityAt: nowIso });
    }
  });

  // ── SESSION END — the true finalization boundary. Fires from
  // ensureSession() closing an idle session (the only way a session ends
  // from the browser) — see the pageLeaveListeners registration in the outer
  // scope for why session-ending is tracked completely separately from
  // ordinary page-leave. Finalizes THIS page's own form(s) immediately,
  // for precision in the common case; a form left mid-fill on a page the
  // visitor has since navigated away from entirely has no live JS context
  // left to finalize itself here — the server's session_end sweep is the
  // authoritative backstop that covers that case. ──
  sessionEndListeners.push(function () {
    for (const [formIndex, entry] of engagementState.entries()) {
      if (entry.status !== "viewed" && entry.status !== "started") continue;
      const form = document.forms[formIndex];
      if (!form) continue;
      const nowMs = Date.now();
      const openDelta = collectOpenFieldDeltas(formIndex, nowMs);
      const nowIso = new Date(nowMs).toISOString();
      sendEngagementEvent(formIndex, form, { status: "abandoned" }, { fieldTimingsDelta: openDelta || undefined, lastActivityAt: nowIso });
    }
  });

  // ── MARK SUBMITTED — called from sendFormCapture above the moment a real
  // submission is captured, so this table never disagrees with leads.
  // Also flushes whatever field was open at that moment (the one they were
  // just in when they hit submit) in the SAME request, rather than losing
  // that last field's dwell time. ──
  function markEngagementSubmitted(form) {
    try {
      const formIndex = Array.from(document.forms).indexOf(form);
      jhLog("[Tracker] 🔎 markEngagementSubmitted called, formIndex:", formIndex, form);
      if (formIndex === -1) {
        jhLog("[Tracker] 🟡 Form engagement skipped — form not found in document.forms");
        return;
      }
      const nowMs = Date.now();
      const openDelta = collectOpenFieldDeltas(formIndex, nowMs);
      const nowIso = new Date(nowMs).toISOString();
      sendEngagementEvent(formIndex, form, { status: "submitted" }, { fieldTimingsDelta: openDelta || undefined, lastActivityAt: nowIso });
    } catch (err) {
      jhLog("[Tracker] ❌ Form engagement submit-mark error:", err);
    }
  }

})();

//////////////////////////////////////////

  // -------------------------------------------------------
  // PAGE STRUCTURE TRACKING — independent, never breaks analytics or forms
  //
  // Reports the page's headings (and where they sit) so the dashboard can
  // draw a visit on the page as the visitor saw it. Runs for EVERY page view
  // (including SPA route changes), a moment after the page settles, and
  // resends only when the structure changed since the last send for that
  // path or 24 hours passed (so the server can see "still the same"). The
  // server fingerprints it and keeps each distinct structure as a version:
  // see app/api/track-structure/route.js.
  // -------------------------------------------------------
  (function () {
    const STRUCTURE_API_URL = `${API_BASE}/api/track-structure`;
    const CACHE_KEY = "jh_sc";
    const RESEND_AFTER_MS = 24 * 60 * 60 * 1000;
    const SETTLE_MS = 2500; // lazy content and fonts need a moment to move headings
    const MAX_HEADERS = 80;

    function hashOf(str) {
      let h = 5381;
      for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
      return String(h);
    }
    function readCache() {
      try {
        return JSON.parse(localStorage.getItem(CACHE_KEY) || "{}") || {};
      } catch (e) {
        return {};
      }
    }
    function writeCache(c) {
      try {
        const keys = Object.keys(c);
        if (keys.length > 100) delete c[keys[0]]; // bounded
        localStorage.setItem(CACHE_KEY, JSON.stringify(c));
      } catch (e) {}
    }

    function capturePageStructure(forPageViewId) {
      try {
        // The visitor moved on (or this window paused) before the page settled.
        if (!pageViewOpen || page_view_id !== forPageViewId) return;

        const nodes = Array.from(document.querySelectorAll("h1, h2, h3")).slice(0, MAX_HEADERS);
        if (nodes.length === 0) return;

        // documentElement, not body: matches getPageHeightPx() used everywhere
        // else, so page_height reads from one box in every place.
        const pageHeight = getPageHeightPx();
        const structures = [];
        nodes.forEach((h, index) => {
          const text = (h.innerText || "").trim();
          if (!text) return;
          structures.push({
            header_index: index,
            header_text: text.slice(0, 200),
            header_tag: h.tagName.toLowerCase(),
            position_y: Math.round(h.getBoundingClientRect().top + window.scrollY),
          });
        });
        if (structures.length === 0) return;

        const path = window.location.pathname;
        const hash = hashOf(JSON.stringify([structures.map((s) => [s.header_tag, s.header_text, Math.round(s.position_y / 50)]), Math.round(pageHeight / 100)]));
        const cache = readCache();
        const now = Date.now();
        if (cache[path] && cache[path].h === hash && now - cache[path].t < RESEND_AFTER_MS) return; // unchanged, recently reported

        _originalFetch(STRUCTURE_API_URL, {
          method: "POST",
          headers: SEND_HEADERS,
          body: JSON.stringify({
            api_key: apiKey,
            host: window.location.hostname,
            page_url: window.location.href,
            visitor_id,
            page_view_id: forPageViewId,
            page_path: path,
            page_height: pageHeight,
            viewport_width: getViewportWidthPx(),
            structures,
          }),
          credentials: "omit",
          keepalive: true,
        })
          .then(function () {
            cache[path] = { h: hash, t: now };
            writeCache(cache);
            jhLog("[Tracker] structure sent:", structures.length, "headers");
          })
          .catch(function (err) {
            jhLog("[Tracker] structure send error:", err);
          });
      } catch (err) {
        jhLog("[Tracker] structure capture error:", err);
      }
    }

    function schedule() {
      const forPageViewId = page_view_id;
      const run = function () {
        setTimeout(function () {
          capturePageStructure(forPageViewId);
        }, SETTLE_MS);
      };
      if (document.readyState === "complete") run();
      else window.addEventListener("load", run, { once: true });
    }

    pageOpenListeners.push(schedule);
    if (pageViewOpen) schedule(); // the first page view opened before this block ran
  })();

  // -------------------------------------------------------
  // TRACKING HEALTH + CLICK TRACKING — independent
  //
  // data-conversion (on a <form>), data-track-field (on a field inside a form)
  // and data-track-click (on anything clickable) are easy to put in the wrong
  // place and assume they work. So the tracker reports, once per page per 6
  // hours, what it FOUND: how many were placed correctly and how many sit in a
  // wrong place. The server pairs that with real events (a real conversion,
  // real field timings, real clicks) to show "found" vs "proven working" in
  // Settings. See app/api/track/route.js (health events).
  // -------------------------------------------------------
  (function () {
    const HEALTH_KEY = "jh_hr";
    const REPORT_EVERY_MS = 6 * 60 * 60 * 1000;
    const SETTLE_MS = 3000;

    function buildReport() {
      const report = {};
      const forms = document.querySelectorAll("form");
      const convAll = document.querySelectorAll("[data-conversion]");
      let marked = 0;
      let wrongValue = 0;
      let wrongElement = 0;
      convAll.forEach(function (el) {
        const isTrue = el.getAttribute("data-conversion") === "true";
        if (el.tagName === "FORM") {
          if (isTrue) marked++;
          else wrongValue++;
        } else if (!isTrue) {
          wrongValue++;
        } else if (el.querySelector("form, iframe, .hbspt-form, [id^='hsForm_']") || el.querySelector("script[src*='hsforms'], script[src*='marketo'], script[src*='mktoForms']")) {
          marked++; // a wrapper around a form or a vendor embed: valid, the vendor renders the form inside it
        } else {
          wrongElement++;
        }
      });
      if (forms.length > 0 || convAll.length > 0) {
        report.conversion_form = { forms: forms.length, marked: marked, wrong_value: wrongValue, wrong_element: wrongElement };
      }

      // Forms inside an iframe from another website are invisible to the page: the tracker can only hear the
      // few providers that tell the parent page when a form is submitted.
      const EVENT_PROVIDERS = [["typeform.com", "Typeform"], ["calendly.com", "Calendly"], ["jotform.com", "Jotform"], ["hsforms.", "HubSpot"]];
      const BLIND_PROVIDERS = [["pardot.com", "Pardot"], ["zohopublic.com", "Zoho Forms"], ["zoho.com/forms", "Zoho Forms"], ["pipedrive.com", "Pipedrive"], ["docs.google.com/forms", "Google Forms"], ["forms.gle", "Google Forms"], ["tally.so", "Tally"], ["airtable.com", "Airtable"], ["forms.office.com", "Microsoft Forms"], ["salesforce.com", "Salesforce"], ["force.com", "Salesforce"], ["mailchimp.com", "Mailchimp"], ["list-manage.com", "Mailchimp"], ["wufoo.com", "Wufoo"], ["formstack.com", "Formstack"], ["cognitoforms.com", "Cognito Forms"], ["paperform.co", "Paperform"], ["fillout.com", "Fillout"]];
      let eventTracked = 0;
      let blind = 0;
      const names = [];
      document.querySelectorAll("iframe").forEach(function (fr) {
        const src = (fr.getAttribute("src") || fr.getAttribute("data-src") || "").toLowerCase();
        if (!src) return;
        const ev = EVENT_PROVIDERS.find(function (p) { return src.indexOf(p[0]) !== -1; });
        const bl = ev ? null : BLIND_PROVIDERS.find(function (p) { return src.indexOf(p[0]) !== -1; });
        if (ev) eventTracked++;
        else if (bl) blind++;
        else return;
        const n = (ev || bl)[1];
        if (names.indexOf(n) === -1) names.push(n);
      });
      if (eventTracked + blind > 0) report.iframe_forms = { count: eventTracked + blind, event_tracked: eventTracked, untracked: blind, providers: names.slice(0, 5) };

      const fieldEls = document.querySelectorAll("[data-track-field]");
      if (fieldEls.length > 0) {
        let inForm = 0;
        fieldEls.forEach(function (el) {
          if (el.closest("form")) inForm++;
        });
        report.field_attr = { marked: fieldEls.length, in_form: inForm, outside_form: fieldEls.length - inForm };
      }

      const clickEls = document.querySelectorAll("[data-track-click]");
      if (clickEls.length > 0) report.click_attr = { marked: clickEls.length };
      return report;
    }

    function sendReport(forPageViewId) {
      try {
        if (!pageViewOpen || page_view_id !== forPageViewId) return;
        const report = buildReport();
        if (Object.keys(report).length === 0) return;
        const path = window.location.pathname;
        let seen = {};
        try {
          seen = JSON.parse(localStorage.getItem(HEALTH_KEY) || "{}") || {};
        } catch (e) {}
        const now = Date.now();
        const sig = JSON.stringify(report);
        if (seen[path] && seen[path].sig === sig && now - seen[path].t < REPORT_EVERY_MS) return;
        sendEvent({ type: "health", visitor_id, session_id, page_path: path, page_url: window.location.href, report: report });
        seen[path] = { sig: sig, t: now };
        try {
          const keys = Object.keys(seen);
          if (keys.length > 100) delete seen[keys[0]];
          localStorage.setItem(HEALTH_KEY, JSON.stringify(seen));
        } catch (e) {}
      } catch (err) {
        jhLog("[Tracker] health report error:", err);
      }
    }

    pageOpenListeners.push(function () {
      const forPageViewId = page_view_id;
      const run = function () {
        setTimeout(function () {
          sendReport(forPageViewId);
        }, SETTLE_MS);
      };
      if (document.readyState === "complete") run();
      else window.addEventListener("load", run, { once: true });
    });
    if (pageViewOpen) {
      const id = page_view_id;
      setTimeout(function () {
        sendReport(id);
      }, SETTLE_MS);
    }

    // CLICKS on elements the owner marked: data-track-click="signup-button".
    // An empty value falls back to the element's id, then its visible text.
    // Rate-limited per name so a double-click or a loop cannot flood.
    const lastClickAt = {};
    let clicksThisPageView = 0;
    let clicksForPageViewId = null;
    document.addEventListener(
      "click",
      function (e) {
        try {
          if (e.isTrusted === false) return;
          const el = e.target && e.target.closest ? e.target.closest("[data-track-click]") : null;
          if (!el || !pageViewOpen) return;
          if (clicksForPageViewId !== page_view_id) {
            clicksForPageViewId = page_view_id;
            clicksThisPageView = 0;
          }
          if (clicksThisPageView >= 100) return;
          const name = (el.getAttribute("data-track-click") || el.id || (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40) || "unnamed").slice(0, 80);
          const now = Date.now();
          if (lastClickAt[name] && now - lastClickAt[name] < 1000) return;
          lastClickAt[name] = now;
          clicksThisPageView++;
          sendEvent({ type: "click", visitor_id, session_id, page_view_id, page_path: window.location.pathname, name: name });
        } catch (err) {
          jhLog("[Tracker] click error:", err);
        }
      },
      true
    );
  })();
    //hubbb

    // -------------------------------------------------------
  // HUBSPOT FORM CAPTURE — fully independent
  // Works with embedded HubSpot forms (non-iframe and postMessage iframe)
  // Respects specify_form mode: if ON, only captures HubSpot forms
  // whose nearest container has data-conversion="true"
  // If this entire block throws, nothing else in tracker is affected
  // -------------------------------------------------------
 (function () {

    const HS_FORM_API_URL = `${API_BASE}/api/track-form`;
    // ─────────────────────────────────────────────────────────
    // DEDUP GUARD
    // HubSpot fires onFormSubmit AND onFormSubmitted for the same
    // submission. We track form_id + a short timestamp window so
    // we never double-send the same form.
    // ─────────────────────────────────────────────────────────
    const _recentlySentForms = new Map(); // form_id → timestamp
    const DEDUP_WINDOW_MS = 5000; // 5 seconds

    function isDuplicate(formId) {
      const last = _recentlySentForms.get(formId);
      if (!last) return false;
      return Date.now() - last < DEDUP_WINDOW_MS;
    }

    function markSent(formId) {
      _recentlySentForms.set(formId, Date.now());
    }

    // ─────────────────────────────────────────────────────────
    // SPECIFY_FORM CHECK FOR HUBSPOT
    //
    // HubSpot renders its own DOM so you can't put data-conversion
    // on the <form> element directly. Instead, the business wraps
    // their HubSpot embed div with data-conversion="true":
    //
    //   <div data-conversion="true">
    //     <script charset="utf-8" type="text/javascript" src="//js.hsforms.net/forms/..."></script>
    //   </div>
    //
    // For postMessage events (iframe HubSpot), we check if ANY
    // element on the page with data-conversion="true" contains
    // a HubSpot embed (hbspt or hs-form class). If yes = allowed.
    // If the page has no such wrapper = blocked in specify mode.
    //
    // For direct DOM HubSpot forms (non-iframe), we walk up the
    // DOM from the form element itself to find the wrapper.
    // ─────────────────────────────────────────────────────────
    function isHubSpotConversionAllowed(formEl) {
      // specifyFormMode is defined in the outer FORM CAPTURE IIFE scope
      // and is accessible here because this IIFE is inside the same outer IIFE
      if (!jhState.specifyFormMode) {
        // Global mode — always allow
        return true;
      }

      // Specify mode — need data-conversion="true" on a parent container
      if (formEl) {
        // Walk up the DOM from the actual form element
        let el = formEl;
        while (el && el !== document.body) {
          if (el.getAttribute && el.getAttribute("data-conversion") === "true") {
            jhLog("[Tracker][HubSpot] ✅ Found data-conversion='true' wrapper:", el);
            return true;
          }
          el = el.parentElement;
        }
        jhLog("[Tracker][HubSpot] IGNORED — no data-conversion='true' parent found for form:", formEl);
        return false;
      }

      // postMessage path — no form element reference available
      // Check if the page has ANY HubSpot embed wrapped in data-conversion="true"
      const conversionWrappers = document.querySelectorAll("[data-conversion='true']");
      for (const wrapper of conversionWrappers) {
        // HubSpot embed containers have class "hbspt-form" or children with "hs-form"
        if (
          wrapper.querySelector(".hbspt-form") ||
          wrapper.querySelector(".hs-form") ||
          wrapper.querySelector("[id^='hsForm_']") ||
          wrapper.querySelector("iframe[src*='hsforms']") ||
          wrapper.classList.contains("hbspt-form")
        ) {
          jhLog("[Tracker][HubSpot] ✅ Found data-conversion wrapper containing HubSpot embed:", wrapper);
          return true;
        }
      }

      jhLog("[Tracker][HubSpot] IGNORED — specify_form=true but no HubSpot form inside a data-conversion='true' wrapper");
      return false;
    }

    // ─────────────────────────────────────────────────────────
    // FIELD NORMALISER
    // HubSpot sends fields as an array of {name, value} objects
    // from onFormSubmit, or as a flat key:value object from
    // onFormSubmitted.submissionValues. Handle both shapes.
    // ─────────────────────────────────────────────────────────
    function normaliseFields(raw) {
      if (!raw) return {};

      // Array shape: [{name: "email", value: "..."}, ...]
      if (Array.isArray(raw)) {
        const out = {};
        for (const field of raw) {
          if (field && field.name) out[field.name] = field.value || "";
        }
        return out;
      }

      // Object shape: {email: "...", firstname: "..."}
      if (typeof raw === "object") return { ...raw };

      return {};
    }

    // ─────────────────────────────────────────────────────────
    // EXTRACT CONTACT INFO from normalised fields
    // ─────────────────────────────────────────────────────────
    function extractContactFromFields(fields) {
      const email =
        fields.email ||
        fields.email_address ||
        fields.mail ||
        null;

      const name =
        fields.name ||
        fields.full_name ||
        fields.fullname ||
        (fields.firstname && fields.lastname
          ? `${fields.firstname} ${fields.lastname}`.trim()
          : fields.firstname || fields.lastname || null);

      const phone =
        fields.phone ||
        fields.phone_number ||
        fields.mobilephone ||
        fields.tel ||
        null;

      return { email, name, phone };
    }

    // ─────────────────────────────────────────────────────────
    // SEND to /api/track-form
    // Uses _originalFetch (captured at the very top of tracker.js)
    // so it bypasses the fetch interceptor and avoids infinite loops
    // ─────────────────────────────────────────────────────────
    function sendHubSpotCapture(args) {
      const { formId, fields, formEl, eventName } = args;
      // The form mode arrives from /api/site-config a moment after load: wait for it, never guess.
      if (!jhState.configLoaded) {
        jhState.waiters.push(function () {
          sendHubSpotCapture(args);
        });
        return;
      }
      try {
        // Dedup check — HubSpot fires multiple events per submission
        if (isDuplicate(formId)) {
          jhLog("[Tracker][HubSpot] Dedup — already sent formId:", formId);
          return;
        }

        // Specify form mode gate
        if (!isHubSpotConversionAllowed(formEl || null)) return;

        const { email, name, phone } = extractContactFromFields(fields);

        jhLog("[Tracker][HubSpot] ✅ Capturing submission:", {
          formId,
          eventName,
          email,
          name,
          phone,
          rawFields: fields,
        });

        markSent(formId);

        const payload = {
          api_key: apiKey,           // from outer tracker scope
          visitor_id,                // from outer tracker scope
          session_id,                // from outer tracker scope
          page_url: window.location.href,
          page_path: window.location.pathname,
          name: name || null,
          email: email || null,
          phone: phone || null,
          confidence: email ? "high" : "low",
          raw_data: {
            ...fields,
            _source: "hubspot",
            _form_id: formId,
            _event: eventName,
          },
          is_labelled_conversion: true, // HubSpot forms that pass the gate are always conversions
        };

        _originalFetch(HS_FORM_API_URL, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: JSON.stringify(payload),
          credentials: "omit",
          keepalive: true,
        })
          .then(function () {
            jhLog("[Tracker][HubSpot] ✅ Payload sent for formId:", formId);
          })
          .catch(function (err) {
            jhLog("[Tracker][HubSpot] ❌ Send error:", err);
          });

      } catch (err) {
        jhLog("[Tracker][HubSpot] ❌ sendHubSpotCapture error:", err);
      }
    }

    // ─────────────────────────────────────────────────────────
    // METHOD A: postMessage listener
    //
    // HubSpot's embedded forms (and iframe forms) fire window messages
    // with type "hsFormCallback". This catches ALL HubSpot forms on
    // the page regardless of how they're embedded.
    //
    // We listen to TWO events:
    //   onFormSubmit     — fires BEFORE submit, has fields array
    //                      Use this as primary capture
    //   onFormSubmitted  — fires AFTER confirmed submit, has submissionValues
    //                      Use as fallback/confirmation if onFormSubmit missed
    //
    // Attach listener IMMEDIATELY (before HubSpot loads) so we never miss it.
    // ─────────────────────────────────────────────────────────
    window.addEventListener("message", function (event) {
      try {
        const msg = event.data;

        // Guard: must be a HubSpot form callback message
        if (!msg || msg.type !== "hsFormCallback") return;

        const eventName = msg.eventName;
        const formId = msg.id || msg.formId || "unknown";

        jhLog("[Tracker][HubSpot] postMessage event:", eventName, "formId:", formId);

        if (eventName === "onFormSubmit") {
          // msg.data is an array of {name, value} field objects
          const fields = normaliseFields(msg.data);
          jhLog("[Tracker][HubSpot] onFormSubmit fields:", fields);
          sendHubSpotCapture({ formId, fields, formEl: null, eventName });
        }

        if (eventName === "onFormSubmitted") {
          // msg.data.submissionValues is a flat key:value object
          const fields = normaliseFields(
            msg.data && msg.data.submissionValues ? msg.data.submissionValues : msg.data
          );
          jhLog("[Tracker][HubSpot] onFormSubmitted fields:", fields);
          sendHubSpotCapture({ formId, fields, formEl: null, eventName });
        }

      } catch (err) {
        jhLog("[Tracker][HubSpot] ❌ postMessage handler error:", err);
      }
    });

    // ─────────────────────────────────────────────────────────
    // METHOD B: Direct DOM HubSpot form submit listener
    //
    // Some HubSpot setups render the form directly in the page DOM
    // (not in an iframe). These forms have class "hs-form".
    // We catch their native submit event as a fallback.
    //
    // Uses MutationObserver to handle lazy-loaded HubSpot forms
    // that aren't in the DOM when the tracker runs.
    // ─────────────────────────────────────────────────────────
    const _attachedHsForms = new WeakSet(); // track which forms we've already bound

    function attachToHsForm(form) {
      if (_attachedHsForms.has(form)) return; // already attached
      _attachedHsForms.add(form);

      jhLog("[Tracker][HubSpot] Attaching submit listener to direct DOM hs-form:", form);

      form.addEventListener("submit", function (e) {
        try {
          const formId =
            form.getAttribute("id") ||
            form.querySelector("[name='hs_form_id']")?.value ||
            form.action ||
            "hs-direct-" + Date.now();

          // Build fields from DOM inputs
          const rawFields = {};
          const inputs = form.querySelectorAll("input, select, textarea");
          for (const input of inputs) {
            const key = input.name || input.id;
            if (!key) continue;
            if (key.toLowerCase().includes("password")) continue;
            rawFields[key] = input.value || "";
          }

          jhLog("[Tracker][HubSpot] Direct DOM form submit, fields:", rawFields);
          sendHubSpotCapture({ formId, fields: rawFields, formEl: form, eventName: "directDOMSubmit" });
        } catch (err) {
          jhLog("[Tracker][HubSpot] ❌ Direct DOM submit handler error:", err);
        }
      }, true); // capture phase
    }

    // Scan existing DOM for any hs-form elements already present
    function scanForHsForms() {
      const hsForms = document.querySelectorAll("form.hs-form, form[id^='hsForm_']");
      jhLog("[Tracker][HubSpot] DOM scan found", hsForms.length, "HubSpot form(s)");
      for (const form of hsForms) {
        attachToHsForm(form);
      }
    }

    // MutationObserver — catches HubSpot forms that render AFTER page load
    // (lazy load, React component mount, single-page app navigation)
    const _hsObserver = new MutationObserver(function (mutations) {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1) continue; // skip non-elements

          // Check if the added node itself is a HubSpot form
          if (
            node.tagName === "FORM" &&
            (node.classList.contains("hs-form") || (node.id && node.id.startsWith("hsForm_")))
          ) {
            attachToHsForm(node);
          }

          // Check descendants — HubSpot often adds a wrapper div containing the form
          const nested = node.querySelectorAll
            ? node.querySelectorAll("form.hs-form, form[id^='hsForm_']")
            : [];
          for (const form of nested) {
            attachToHsForm(form);
          }
        }
      }
    });

    // document.body does not exist yet when the script sits in <head> (the recommended place); observing
    // null threw here and silently disabled this whole section for every <head> install.
    function startHsObserver() {
      _hsObserver.observe(document.body, { childList: true, subtree: true });
    }
    if (document.body) startHsObserver();
    else document.addEventListener("DOMContentLoaded", startHsObserver);

    // Initial scan in case HubSpot already rendered before tracker ran
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", scanForHsForms);
    } else {
      scanForHsForms();
    }

    jhLog("[Tracker][HubSpot] ✅ HubSpot capture initialised — postMessage + DOM observer active");

  })(); // END HUBSPOT CAPTURE IIFE

  // -------------------------------------------------------
  // FORMS IN AN IFRAME (Typeform, Calendly, Jotform) — independent
  //
  // The page cannot read inside an iframe from another website, so name and email are out of reach.
  // These providers do announce a completed submission to the parent page with postMessage, which is
  // enough to count the conversion in the visit (as a lead with no name or email: an anonymous
  // conversion). Providers that announce nothing (Pardot, Zoho, Pipedrive, Google Forms...) cannot be
  // tracked from the page at all; the health report in Settings says so.
  //
  // In "labelled forms only" mode the iframe, or an element around it, must carry data-conversion="true".
  // -------------------------------------------------------
  (function () {
    const FORM_API_URL = API_BASE + "/api/track-form";
    const PROVIDERS = [
      { id: "typeform", host: /(^|\.)typeform\.com$/, test: function (d) { return !!d && typeof d === "object" && typeof d.type === "string" && /submit/i.test(d.type); } },
      { id: "calendly", host: /(^|\.)calendly\.com$/, test: function (d) { return !!d && typeof d === "object" && d.event === "calendly.event_scheduled"; } },
      {
        id: "jotform",
        host: /(^|\.)jotform\.(com|eu)$/,
        test: function (d) {
          if (typeof d === "string") return d.indexOf("submission-completed") !== -1;
          return !!d && typeof d === "object" && /submission-completed/.test(String(d.action || d.type || d.event || ""));
        },
      },
    ];
    const recent = {};

    window.addEventListener("message", function (e) {
      try {
        let host = "";
        try {
          host = new URL(e.origin).hostname;
        } catch (err) {
          return;
        }
        const provider = PROVIDERS.find(function (p) { return p.host.test(host) && p.test(e.data); });
        if (!provider) return;
        let frame = null;
        document.querySelectorAll("iframe").forEach(function (f) {
          try {
            if (f.contentWindow === e.source) frame = f;
          } catch (err) {}
        });
        const marked = !!(frame && frame.closest && frame.closest('[data-conversion="true"]'));
        const responseId = e.data && typeof e.data.responseId === "string" ? e.data.responseId.slice(0, 64) : undefined;

        jhWhenConfigured(function () {
          if (jhState.specifyFormMode && !marked) return;
          const now = Date.now();
          if (recent[provider.id] && now - recent[provider.id] < 5000) return;
          recent[provider.id] = now;
          _originalFetch(FORM_API_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=UTF-8" },
            body: JSON.stringify({
              api_key: apiKey,
              host: window.location.host,
              visitor_id,
              session_id,
              page_url: window.location.href,
              page_path: window.location.pathname,
              name: null,
              email: null,
              phone: null,
              confidence: "low",
              raw_data: { _source: provider.id, _kind: "iframe_submission", _response_id: responseId },
              is_labelled_conversion: marked,
            }),
            credentials: "omit",
            keepalive: true,
          }).catch(function () {});
          jhLog("[Tracker][iframe] " + provider.id + " submission announced by the embed");
        });
      } catch (err) {
        jhLog("[Tracker][iframe] error:", err);
      }
    });
  })(); // END IFRAME PROVIDERS IIFE
  
})();


