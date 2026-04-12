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
  firePageViewStart();

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

})();


