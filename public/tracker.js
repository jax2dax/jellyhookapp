(function () {
  const API_URL = "http://localhost:3000/api/track";

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

  function getSessionId() {
    let id = sessionStorage.getItem("session_id");
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem("session_id", id); }
    return id;
  }

  function getScrollDepth() {
    const scrolled = window.scrollY;
    const height = document.body.scrollHeight - window.innerHeight;
    return height > 0 ? Math.round((scrolled / height) * 100) / 100 : 0;
  }

  const visitor_id = getVisitorId();
  const session_id = getSessionId();

  // Mutable — resets on every new page view (tab return)
  let page_view_id = crypto.randomUUID();
  let startTime = Date.now();

  function sendEvent(event) {
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify([event]),
      keepalive: true,
    }).catch((err) => console.error("Tracker send failed:", err));
  }

  function sendExitEvent(event) {
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
// FORM CAPTURE — fully independent, never affects analytics
// -------------------------------------------------------
(function () {
  const FORM_API_URL = "http://localhost:3000/api/track-form"; // 🚀 DEPLOY: replace with production domain

  const NAME_KEYS = ["name", "full_name", "fullname", "first_name", "firstname", "your_name", "contact_name", "fname", "full name", "fullname"];
  const EMAIL_KEYS = ["email", "email_address", "emailaddress", "your_email", "contact_email", "mail", "e-mail"];
  const PHONE_KEYS = ["phone", "phone_number", "phonenumber", "tel", "telephone", "mobile", "cell"];

  function normalize(str) {
    return (str || "").toLowerCase().replace(/[-\s]/g, "_");
  }

  // Read actual current value from input — works for React controlled inputs
  // React stores value in input.value even for controlled components
  function getInputValue(input) {
    return input.value || "";
  }

  // Get ALL inputs from form including React-controlled ones
  function getAllInputs(form) {
    return Array.from(form.querySelectorAll(
      "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='checkbox']):not([type='radio']), textarea, select"
    ));
  }

  function extractEmail(form) {
    // Priority 1: type="email" — most reliable signal
    const emailInputs = form.querySelectorAll('input[type="email"]');
    for (const el of emailInputs) {
      const val = getInputValue(el);
      if (val && val.includes("@") && val.includes(".")) return val.trim();
    }

    // Priority 2: data-track attribute
    const tracked = form.querySelector('[data-track="email"]');
    if (tracked) {
      const val = getInputValue(tracked);
      if (val && val.includes("@")) return val.trim();
    }

    // Priority 3: placeholder/name/id contains email keyword
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

    // Priority 4: any input whose current value looks like an email
    for (const input of allInputs) {
      const val = getInputValue(input);
      if (val && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return val.trim();
    }

    return null;
  }

  function extractName(form) {
    // Priority 1: data-track
    const tracked = form.querySelector('[data-track="name"]');
    if (tracked && getInputValue(tracked)) return getInputValue(tracked).trim();

    // Priority 2: placeholder/name/id/autocomplete signals
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
    // Priority 1: type="tel"
    const telInput = form.querySelector('input[type="tel"]');
    if (telInput && getInputValue(telInput)) return getInputValue(telInput).trim();

    // Priority 2: data-track
    const tracked = form.querySelector('[data-track="phone"]');
    if (tracked && getInputValue(tracked)) return getInputValue(tracked).trim();

    // Priority 3: signals
    const allInputs = getAllInputs(form);
    for (const input of allInputs) {
      const signals = [input.name, input.id, input.placeholder]
        .map(s => normalize(s || ""));
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
      // Never store passwords
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

  function sendFormCapture(form) {
    try {
      if (!form || form.tagName !== "FORM") return;
      if (shouldSkip(form)) {
        console.log("[Tracker] Form skipped:", form);
        return;
      }

      const email = extractEmail(form);
      const name = extractName(form);
      const phone = extractPhone(form);
      const raw = buildRawData(form);

      console.log("[Tracker] Form captured:", { name, email, phone, raw });

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
      };

      // fetch with credentials: omit — required for cross-origin with wildcard CORS
      // keepalive: true — survives page navigation just like sendBeacon
      _originalFetch(FORM_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "omit",
        keepalive: true,
      }).then(() => {
        console.log("[Tracker] Form payload sent successfully");
      }).catch((err) => {
        console.error("[Tracker] Form send error:", err);
      });

    } catch (err) {
      console.error("[Tracker] Form capture error:", err);
    }
  }

  // METHOD 1: Native submit event — capture phase fires before React handlers
  document.addEventListener("submit", function (e) {
    console.log("[Tracker] Submit event fired on:", e.target);
    sendFormCapture(e.target);
  }, true);

  // METHOD 2: Intercept fetch — catches WaitlistForm which submits via fetch
  // without ever firing a DOM submit (calls e.preventDefault then fetch directly)
  const _originalFetch = window.fetch;
  window.fetch = function (...args) {
    try {
      // Find if any form on page has filled email — this fetch is likely a form submit
      const forms = document.querySelectorAll("form");
      for (const form of forms) {
        if (shouldSkip(form)) continue;
        const email = extractEmail(form);
        // Only capture if there's an email — avoids capturing unrelated fetches
        if (email) {
          console.log("[Tracker] Fetch intercepted with form data:", form);
          sendFormCapture(form);
          break;
        }
      }
    } catch (err) {
      console.error("[Tracker] Fetch intercept error:", err);
    }
    return _originalFetch.apply(this, args);
  };

})();

})();


