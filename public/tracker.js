// /public/tracker.js
(function () {
  const _originalFetch = window.fetch;

  const scriptTag = document.currentScript;
  const apiKey = scriptTag.getAttribute("data-key");
  const API_BASE = new URL(scriptTag.src).origin;

  const API_URL = `${API_BASE}/api/track`;

  if (!apiKey) {
    console.error("Tracker: Missing data-key");
    return;
  }
  function getVisitorId() {
    let id = localStorage.getItem("visitor_id");
    if (!id) { id = crypto.randomUUID(); localStorage.setItem("visitor_id", id); }
    return id;
  }

  // function getSessionId() {
  //   let id = sessionStorage.getItem("session_id");
  //   if (!id) { id = crypto.randomUUID(); sessionStorage.setItem("session_id", id); }
  //   return id;
  // } //with this (originally this block doesnt work/logic)
  // Session lives in sessionStorage — same tab/window = same session
// sessionStorage is cleared automatically when the browser tab is closed
// This means one session = one continuous site visit, never resets on page nav
function getSessionId() {
  let id = sessionStorage.getItem("jh_session_id");
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem("jh_session_id", id);
    console.log("🟢 NEW SESSION CREATED:", id);
  } else {
    console.log("🔵 EXISTING SESSION:", id);
  }
  return id;
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

  function getViewportHeightPx() {
    return window.innerHeight || document.documentElement.clientHeight || 0;
  }

  // ─────────────────────────────────────────────────────────────────────
  // TEMPORARY DEBUG HUD — REMOVE ONCE THE PAGE-HEIGHT INVESTIGATION IS DONE
  //
  // On-screen readout so page_height accuracy can be checked against
  // DevTools directly on the live page, instead of estimating from the
  // scrollbar. Shows what firePageViewStart() actually sent (the
  // potentially-too-early measurement) side by side with the CURRENT live
  // value, so a mismatch between them is visible immediately, plus
  // documentElement vs body in case those two boxes disagree.
  //
  // To remove: delete this whole IIFE and the two `window.__jhDebug...`
  // writes lower down (search "TEMP DEBUG").
  // ─────────────────────────────────────────────────────────────────────
  (function () {
    try {
      const box = document.createElement("div");
      box.id = "jh-debug-hud";
      box.style.cssText =
        "position:fixed;bottom:8px;left:8px;z-index:2147483647;background:rgba(0,0,0,0.85);color:#0f0;" +
        "font:11px/1.5 monospace;padding:8px 10px;border-radius:6px;white-space:pre;pointer-events:none;" +
        "box-shadow:0 2px 8px rgba(0,0,0,0.5);";
      document.documentElement.appendChild(box);

      function render() {
        const de = document.documentElement.scrollHeight;
        const body = document.body ? document.body.scrollHeight : 0;
        const vh = getViewportHeightPx();
        const scrollY = window.scrollY;
        const denom = getPageHeightPx() - vh;
        const depth = denom > 0 ? (scrollY / denom).toFixed(3) : "0.000";
        const sentStart = window.__jhDebugSentAtStart;
        const sentEnd = window.__jhDebugSentAtEnd;
        box.textContent =
          "[JH DEBUG — page_height/viewport_height]\n" +
          "LIVE documentElement.scrollHeight: " + de + "px\n" +
          "LIVE body.scrollHeight:            " + body + "px" + (body !== de ? "  ⚠ DIFFERS from documentElement" : "") + "\n" +
          "LIVE window.innerHeight (viewport): " + vh + "px\n" +
          "LIVE scrollY:                       " + scrollY + "px\n" +
          "LIVE computed scroll_depth:         " + depth + "\n" +
          "---\n" +
          "SENT at page_view_start: page_height=" + (sentStart === undefined ? "(pending)" : sentStart === null ? "null (throttled — see PAGE_HEIGHT_UPDATE_INTERVAL_MS)" : sentStart + "px") + "\n" +
          "SENT at page_view_end:   page_height=" + (sentEnd === undefined ? "(not fired yet)" : sentEnd === null ? "null (throttled)" : sentEnd + "px");
      }

      render();
      window.addEventListener("scroll", render, { passive: true });
      window.addEventListener("resize", render);
      setInterval(render, 1000); // catches async content growing the page even without a scroll/resize event
    } catch (err) {
      console.error("[Tracker][DEBUG HUD] failed to mount:", err);
    }
  })();
  // ─────────────────────────────────────────────────────────────────────

  const visitor_id = getVisitorId();
 

  // -------------------------------
// SESSION LIFECYCLE (NEW - ISOLATED)
// -------------------------------

// SESSION LIFECYCLE
// session_start fires ONCE on first visit to the site (when sessionStorage has no id yet)
// session_end fires ONCE when the user closes/leaves the site entirely
// Neither fires on page navigation — session_id stays the same across all pages
// isNewSession MUST be checked BEFORE getSessionId() writes to sessionStorage
const isNewSession = !sessionStorage.getItem("jh_session_id");
const session_id = getSessionId();

function fireSessionStart() {
  // Only send if this is a brand new session — not a page navigation
  if (!isNewSession) return;
  console.log("🟢 SESSION START FIRING:", session_id);
  sendEvent({
    type: "session_start",
    visitor_id,
    session_id,
    referrer: document.referrer || null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    user_agent: navigator.userAgent,
  });
}

function fireSessionEnd() {
  // Fires on tab close / browser navigation away from site
  // Uses sendExitEvent (keepalive fetch) so it survives page unload
  console.log("🔴 SESSION END FIRING:", session_id);
  const payload = [{
    type: "session_end",
    visitor_id,
    session_id,
    api_key: apiKey,
  }];
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  // keepalive fetch first, sendBeacon fallback
  try {
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch (e) {
    navigator.sendBeacon(API_URL, blob);
  }
}

// Fire start only on new sessions, fire end on every unload
fireSessionStart();
window.addEventListener("beforeunload", fireSessionEnd);


  /////////////////////////////////////////////
  // Mutable — resets on every new page view (tab return)
  let page_view_id = crypto.randomUUID();
  let startTime = Date.now();
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
  function sendEvent(event) {
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
     body: JSON.stringify([event]), //, working version(session row not adding so ,)
      keepalive: true,
    }).catch((err) => console.error("Tracker send failed:", err));
  }

  // function sendExitEvent(event) {
  //   const payload = [{ ...event, api_key: apiKey }];
  //   const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });

  //   try {
  //     fetch(API_URL, {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json", "x-api-key": apiKey },
  //       body: JSON.stringify(payload),
  //       keepalive: true,
  //     });
  //     sent = true;
  //   } catch (e) {}

  //   if (!sent) {
  //     navigator.sendBeacon(API_URL, blob);
  //   }
  // } //was replaced with this
  function sendExitEvent(event) {
  // keepalive fetch survives page unload — sendBeacon is fallback only
  const payload = [{ ...event, api_key: apiKey }];
  const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
  let sent = false;

  try {
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(payload),
      keepalive: true,
    });
    sent = true;
  } catch (e) {}

  if (!sent) {
    navigator.sendBeacon(API_URL, blob);
  }
}


  // ── PAGE HEIGHT TRACKER ──────────────────────────────────────────────────
// Reads page height at start time. Throttled: only sends if height changed
// OR more than PAGE_HEIGHT_UPDATE_INTERVAL_MS has passed since last send.
// Stored in sessionStorage so it persists across page navigations in same tab.
const PAGE_HEIGHT_UPDATE_INTERVAL_MS = 6 * 60 * 1000; // 6 minutes

function getPageHeightPayload() {
  try {
    const currentHeight = getPageHeightPx();
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
    console.error("[Tracker] page height error:", err);
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
  };
  // Only attach page_height when throttle allows
  if (pageHeight !== null) {
    event.page_height = pageHeight;
    console.log("[Tracker] 📐 Sending page_height:", pageHeight, "for", window.location.pathname);
  }
  window.__jhDebugSentAtStart = pageHeight; // TEMP DEBUG — see HUD above
  console.log("[Tracker] 🚩 entry_scroll:", entryScroll.toFixed(3), "| viewport_height:", viewportHeight, "for", window.location.pathname);
  sendEvent(event);
}

  function firePageViewEnd() {
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
    console.log(
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
      console.log("[Tracker] 📐 Sending corrected page_height at exit:", exitPageHeight, "for", window.location.pathname);
    }
    window.__jhDebugSentAtEnd = exitPageHeight; // TEMP DEBUG — see HUD above
    sendExitEvent({
      type: "page_view_end",
      visitor_id,
      session_id,
      page_view_id,
      duration: Date.now() - startTime,
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

  // INITIAL PAGE LOAD
  // firePageViewStart();               //fixing null closes
  // INITIAL PAGE LOAD
  // Guard: only fire if tab is visible right now.
  // If the page loaded in a background tab, visibilitychange → "visible" will fire it.
  // Without this guard, pages loading while hidden fire once here AND once on visibilitychange,
  // creating a duplicate row.
  if (document.visibilityState !== "hidden") {
    firePageViewStart();
    console.log("[Tracker] ✅ Initial page_view_start fired (tab visible):", page_view_id);
  } else {
    console.log("[Tracker] ⏳ Tab hidden on load — waiting for visibilitychange to fire page_view_start");
  }

  // TAB VISIBILITY CYCLE
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      // User left — close current page_view row
      firePageViewEnd();
    } else if (document.visibilityState === "visible") {
      // User returned — fresh page_view_id and timer, open new row
      page_view_id = crypto.randomUUID();
      startTime = Date.now();
      maxScrollDepth = getScrollDepth(); // ← seed at entry point, not 0
      maxScrollReachedAt = null;
      revisitStartDepth = null;
      firePageViewStart();
    }
  });
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
        console.log("[Tracker] Path unchanged (internal history call, not a real navigation) — skipping:", newPath);
        return;
      }

      lastTrackedPath = newPath;
      console.log("[Tracker] 🔀 Route change detected →", oldPath, "→", newPath, "— closing page_view:", page_view_id);

      // Step 1: close the current page_view with accurate duration + scroll
      firePageViewEnd();

      // Step 2: after a brief tick so window.location has updated, open new page_view
      setTimeout(function () {
        page_view_id = crypto.randomUUID();
        startTime = Date.now();
        maxScrollDepth = getScrollDepth(); // ← seed at entry point, not 0
        maxScrollReachedAt = null;
        revisitStartDepth = null;
        firePageViewStart();
        console.log("[Tracker] ✅ New page_view_start after route change:", page_view_id, window.location.pathname);
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

    console.log("[Tracker] ✅ Next.js pushState route handler active");
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
            console.log("[Tracker] 📜 New max scroll depth:", maxScrollDepth.toFixed(3), "at", maxScrollReachedAt);
          } else if (revisitStartDepth === null || currentDepth < revisitStartDepth) {
            // Not a new deepest point — climbing back up (or already at a
            // new high point of this backtrack). Only updates when they go
            // HIGHER than any point already seen during this backtrack;
            // scrolling back down without exceeding that doesn't move it.
            revisitStartDepth = currentDepth;
            console.log("[Tracker] 🔁 New revisit-start depth:", revisitStartDepth.toFixed(3));
          }
        } catch (err) {
          console.error("[Tracker] ❌ Max scroll tracking error:", err);
        }
      }, SCROLL_THROTTLE_MS);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    console.log("[Tracker] ✅ Max scroll depth tracker active (throttle=" + SCROLL_THROTTLE_MS + "ms)");
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

  function extractName(form) {
    const tracked = form.querySelector('[data-track="name"]');
    if (tracked && getInputValue(tracked)) return getInputValue(tracked).trim();
    const allInputs = getAllInputs(form);
    for (const input of allInputs) {
      const signals = [
        input.name, input.id, input.placeholder,
        input.getAttribute("aria-label"), input.getAttribute("autocomplete")
      ].map(s => normalize(s || ""));
      const isNameField = signals.some(s => NAME_KEYS.some(k => s.includes(normalize(k))));
      if (isNameField) {
        const val = getInputValue(input);
        if (val) return val.trim();
      }
    }
    return null;
  }

  function extractPhone(form) {
    const telInput = form.querySelector('input[type="tel"]');
    if (telInput && getInputValue(telInput)) return getInputValue(telInput).trim();
    const tracked = form.querySelector('[data-track="phone"]');
    if (tracked && getInputValue(tracked)) return getInputValue(tracked).trim();
    const allInputs = getAllInputs(form);
    for (const input of allInputs) {
      const signals = [input.name, input.id, input.placeholder].map(s => normalize(s || ""));
      const isPhoneField = signals.some(s => PHONE_KEYS.some(k => s.includes(normalize(k))));
      if (isPhoneField) {
        const val = getInputValue(input);
        if (val) return val.trim();
      }
    }
    return null;
  }

  function buildRawData(form) {
    const raw = {};
    const allInputs = getAllInputs(form);
    for (const input of allInputs) {
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
  function isConversionForm(form) {
    if (!specifyFormMode) {
      // Global mode: capture everything that passes shouldSkip
      return true;
    }
    // Specify mode: ONLY forms with data-conversion="true"
    const hasAttr = form.getAttribute("data-conversion") === "true";
    if (!hasAttr) {
      console.log("[Tracker] IGNORED — form missing data-conversion='true':", form);
    }
    return hasAttr;
  }

  // ─────────────────────────────────────────────────────────────────────
  // SEND — fires the actual capture after all gates pass
  // ─────────────────────────────────────────────────────────────────────
  function sendFormCapture(form) {
    try {
      if (!form || form.tagName !== "FORM") {
        console.warn("[Tracker] sendFormCapture called with non-form element:", form);
        return;
      }

      // Gate 1: conversion form check (respects specifyFormMode)
      if (!isConversionForm(form)) return;

      // Gate 2: skip password forms, search forms, single-field non-email forms
      if (shouldSkip(form)) {
        console.log("[Tracker] Form skipped by shouldSkip:", form);
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
        console.log("[Tracker] Duplicate form capture suppressed (submit event + fetch interceptor both fired):", signature);
        return;
      }
      lastCaptureSignature = signature;
      lastCaptureAt = now;

      console.log("[Tracker] ✅ Form captured:", { name, email, phone, raw });

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
        is_labelled_conversion: form.getAttribute("data-conversion") === "true",
      };

      _originalFetch(FORM_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "omit",
        keepalive: true,
      }).then(() => {
        console.log("[Tracker] ✅ Form payload sent successfully");
      }).catch((err) => {
        console.error("[Tracker] ❌ Form send error:", err);
      });

    } catch (err) {
      console.error("[Tracker] ❌ Form capture error:", err);
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  // QUEUE PROCESSOR — replays any forms that submitted before config loaded
  // ─────────────────────────────────────────────────────────────────────
  function processPendingForms() {
    if (pendingForms.length === 0) return;
    console.log("[Tracker] Processing", pendingForms.length, "queued form submission(s) now that config is loaded");
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

      if (specifyFormMode) {
        console.log("[Tracker] ✅ specify_form=TRUE — ONLY forms with data-conversion='true' will be captured");
      } else {
        console.log("[Tracker] ✅ specify_form=FALSE — ALL forms will be captured (global mode)");
      }

      // Replay any submissions that queued up before config loaded
      processPendingForms();
    })
    .catch(function(err) {
      // Config fetch failed — default to GLOBAL mode so no conversions are silently lost
      console.warn("[Tracker] ⚠️ site-config fetch failed, defaulting to global mode:", err.message);
      specifyFormMode = false;
      configLoaded = true;
      processPendingForms();
      console.log();
    });

  // ─────────────────────────────────────────────────────────────────────
  // METHOD 1: Native submit event (capture phase — fires before React handlers)
  //
  // If config is not loaded yet: queue the form, process after config arrives.
  // If config is loaded: process immediately.
  // ─────────────────────────────────────────────────────────────────────
  document.addEventListener("submit", function (e) {
    console.log("[Tracker] Submit event fired on:", e.target);
    if (!configLoaded) {
      console.log("[Tracker] Config not yet loaded — queuing submission");
      pendingForms.push({ form: e.target });
      return;
    }
    sendFormCapture(e.target);
  }, true);

  // ─────────────────────────────────────────────────────────────────────
  // METHOD 2: Fetch interceptor
  // Catches React forms that call fetch() directly without a DOM submit event.
  //
  // Same queue logic: if config isn't loaded yet, queue and replay later.
  // ─────────────────────────────────────────────────────────────────────
  //const _originalFetch = window.fetch;              //moved this to the top
  window.fetch = function (...args) {
    try {
      const forms = document.querySelectorAll("form");
      for (const form of forms) {
        if (shouldSkip(form)) continue;

        // In specify mode, skip non-labelled forms immediately (no email scan needed)
        if (configLoaded && specifyFormMode && form.getAttribute("data-conversion") !== "true") continue;

        const email = extractEmail(form);
        if (email) {
          console.log("[Tracker] Fetch intercepted — found form with email:", form);
          if (!configLoaded) {
            console.log("[Tracker] Config not yet loaded — queuing fetch-intercepted submission");
            pendingForms.push({ form });
          } else {
            sendFormCapture(form);
          }
          break; // only capture the first matching form per fetch call
        }
      }
    } catch (err) {
      console.error("[Tracker] ❌ Fetch intercept error:", err);
    }
    return _originalFetch.apply(this, args);
  };

})();

//////////////////////////////////////////

// -------------------------------------------------------
  // PAGE STRUCTURE TRACKING — independent, never breaks analytics or forms
  // -------------------------------------------------------
 (function () {
    const STRUCTURE_API_URL = `${API_BASE}/api/track-structure`;

    function capturePageStructure() {
      try {
        const headers = document.querySelectorAll("h1, h2, h3");
        if (headers.length === 0) return;

        // documentElement, not body — matches getPageHeightPx() used
        // everywhere else. The two boxes can disagree, and this value is
        // joined against page_views.page_height (framePlate's fallback
        // chain in resolvePageHeight) — reading from two different boxes in
        // two different places would make that fallback inconsistent with
        // itself.
        const pageHeight = getPageHeightPx();
        const structures = [];

        headers.forEach((h, index) => {
          const text = h.innerText?.trim();
          if (!text) return;
          structures.push({
            header_index: index,
            header_text: text,
            header_tag: h.tagName.toLowerCase(),
            position_y: Math.round(h.getBoundingClientRect().top + window.scrollY),
          });
        });

        if (structures.length === 0) return;

        fetch(STRUCTURE_API_URL, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    api_key: apiKey,
    visitor_id,
    page_path: window.location.pathname,
    page_height: pageHeight,
    structures,
  }),
  credentials: "omit",
  keepalive: true
}).then(() => {
  console.log("[Tracker] Structure sent:", structures.length, "headers");
}).catch((err) => {
  console.error("[Tracker] Structure send error:", err);
});

      } catch (err) {
        console.error("[Tracker] Structure capture error:", err);
      }
    }

    // Wait for DOM to fully render before scanning headers
    if (document.readyState === "complete") {
      capturePageStructure();
    } else {
      window.addEventListener("load", capturePageStructure);
    }

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
      if (typeof specifyFormMode === "undefined" || !specifyFormMode) {
        // Global mode — always allow
        return true;
      }

      // Specify mode — need data-conversion="true" on a parent container
      if (formEl) {
        // Walk up the DOM from the actual form element
        let el = formEl;
        while (el && el !== document.body) {
          if (el.getAttribute && el.getAttribute("data-conversion") === "true") {
            console.log("[Tracker][HubSpot] ✅ Found data-conversion='true' wrapper:", el);
            return true;
          }
          el = el.parentElement;
        }
        console.log("[Tracker][HubSpot] IGNORED — no data-conversion='true' parent found for form:", formEl);
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
          wrapper.classList.contains("hbspt-form")
        ) {
          console.log("[Tracker][HubSpot] ✅ Found data-conversion wrapper containing HubSpot embed:", wrapper);
          return true;
        }
      }

      console.log("[Tracker][HubSpot] IGNORED — specify_form=true but no HubSpot form inside a data-conversion='true' wrapper");
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
    function sendHubSpotCapture({ formId, fields, formEl, eventName }) {
      try {
        // Dedup check — HubSpot fires multiple events per submission
        if (isDuplicate(formId)) {
          console.log("[Tracker][HubSpot] Dedup — already sent formId:", formId);
          return;
        }

        // Specify form mode gate
        if (!isHubSpotConversionAllowed(formEl || null)) return;

        const { email, name, phone } = extractContactFromFields(fields);

        console.log("[Tracker][HubSpot] ✅ Capturing submission:", {
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          credentials: "omit",
          keepalive: true,
        })
          .then(function () {
            console.log("[Tracker][HubSpot] ✅ Payload sent for formId:", formId);
          })
          .catch(function (err) {
            console.error("[Tracker][HubSpot] ❌ Send error:", err);
          });

      } catch (err) {
        console.error("[Tracker][HubSpot] ❌ sendHubSpotCapture error:", err);
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

        console.log("[Tracker][HubSpot] postMessage event:", eventName, "formId:", formId);

        if (eventName === "onFormSubmit") {
          // msg.data is an array of {name, value} field objects
          const fields = normaliseFields(msg.data);
          console.log("[Tracker][HubSpot] onFormSubmit fields:", fields);
          sendHubSpotCapture({ formId, fields, formEl: null, eventName });
        }

        if (eventName === "onFormSubmitted") {
          // msg.data.submissionValues is a flat key:value object
          const fields = normaliseFields(
            msg.data && msg.data.submissionValues ? msg.data.submissionValues : msg.data
          );
          console.log("[Tracker][HubSpot] onFormSubmitted fields:", fields);
          sendHubSpotCapture({ formId, fields, formEl: null, eventName });
        }

      } catch (err) {
        console.error("[Tracker][HubSpot] ❌ postMessage handler error:", err);
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

      console.log("[Tracker][HubSpot] Attaching submit listener to direct DOM hs-form:", form);

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

          console.log("[Tracker][HubSpot] Direct DOM form submit, fields:", rawFields);
          sendHubSpotCapture({ formId, fields: rawFields, formEl: form, eventName: "directDOMSubmit" });
        } catch (err) {
          console.error("[Tracker][HubSpot] ❌ Direct DOM submit handler error:", err);
        }
      }, true); // capture phase
    }

    // Scan existing DOM for any hs-form elements already present
    function scanForHsForms() {
      const hsForms = document.querySelectorAll("form.hs-form, form[id^='hsForm_']");
      console.log("[Tracker][HubSpot] DOM scan found", hsForms.length, "HubSpot form(s)");
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

    _hsObserver.observe(document.body, { childList: true, subtree: true });

    // Initial scan in case HubSpot already rendered before tracker ran
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", scanForHsForms);
    } else {
      scanForHsForms();
    }

    console.log("[Tracker][HubSpot] ✅ HubSpot capture initialised — postMessage + DOM observer active");

  })(); // END HUBSPOT CAPTURE IIFE
  
})();


