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

})();