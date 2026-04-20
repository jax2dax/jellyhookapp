// /public/tracker.js
(function () {
  const API_URL = "http://localhost:3000/api/track";
  const _originalFetch = window.fetch;

  const scriptTag = document.currentScript;
  const apiKey = scriptTag.getAttribute("data-key");

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

  function getScrollDepth() {
    const scrolled = window.scrollY;
    const height = document.body.scrollHeight - window.innerHeight;
    return height > 0 ? Math.round((scrolled / height) * 100) / 100 : 0;
  }

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


  function firePageViewStart() {
    sendEvent({
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
    });
  }

  function firePageViewEnd() {
    sendExitEvent({
      type: "page_view_end",
      visitor_id,
      session_id,
      page_view_id,
      duration: Date.now() - startTime,
      scroll_depth: getScrollDepth(),
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

    function handleRouteChange(newUrl) {
      // Don't fire if the URL path didn't actually change (hash-only changes, etc.)
      const newPath = typeof newUrl === "string"
        ? newUrl.replace(/^https?:\/\/[^/]+/, "").split("?")[0]
        : window.location.pathname;

      if (newPath === window.location.pathname && typeof newUrl === "string" && newUrl.includes("#")) {
        console.log("[Tracker] Hash-only change, skipping route handler");
        return;
      }

      console.log("[Tracker] 🔀 Route change detected → closing page_view:", page_view_id);

      // Step 1: close the current page_view with accurate duration + scroll
      firePageViewEnd();

      // Step 2: after a brief tick so window.location has updated, open new page_view
      setTimeout(function () {
        page_view_id = crypto.randomUUID();
        startTime = Date.now();
        firePageViewStart();
        console.log("[Tracker] ✅ New page_view_start after route change:", page_view_id, window.location.pathname);
      }, 50);
    }

    history.pushState = function (state, title, url) {
      _origPushState(state, title, url);
      handleRouteChange(url);
    };

    history.replaceState = function (state, title, url) {
      _origReplaceState(state, title, url);
      // replaceState is used by Next.js scroll restoration — only handle if path changes
      const newPath = typeof url === "string" ? url.split("?")[0] : window.location.pathname;
      if (newPath !== window.location.pathname) {
        handleRouteChange(url);
      }
    };

    window.addEventListener("popstate", function () {
      handleRouteChange(window.location.pathname);
    });

    console.log("[Tracker] ✅ Next.js pushState route handler active");
  })();

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
  const FORM_API_URL = "http://localhost:3000/api/track-form"; // 🚀 DEPLOY: replace with production domain
  const SITE_CONFIG_URL = "http://localhost:3000/api/site-config"; // 🚀 DEPLOY: replace with production domain

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
    const STRUCTURE_API_URL = "http://localhost:3000/api/track-structure"; // 🚀 DEPLOY: replace with production domain

    function capturePageStructure() {
      try {
        const headers = document.querySelectorAll("h1, h2, h3");
        if (headers.length === 0) return;

        const pageHeight = document.body.scrollHeight;
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

    const HS_FORM_API_URL = "http://localhost:3000/api/track-form"; // 🚀 DEPLOY: replace domain

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


