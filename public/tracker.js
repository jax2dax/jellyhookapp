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
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem("visitor_id", id);
    }
    return id;
  }

  function getSessionId() {
    let id = sessionStorage.getItem("session_id");
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem("session_id", id);
    }
    return id;
  }

  const visitor_id = getVisitorId();
  const session_id = getSessionId();
  const page_view_id = crypto.randomUUID();

  const startTime = Date.now();

//   function sendEvent(event) {
//     fetch(API_URL, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//         "x-api-key": apiKey
//       },
//       body: JSON.stringify([event]) // ✅ MUST BE ARRAY
//     }).catch((err) => {
//       console.error("Tracker send failed:", err);
//     });
//   }
//replaced with 
function sendEvent(event) {
  fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey
    },
    body: JSON.stringify([event]),
    keepalive: true // 🔥 CRITICAL for page exit
  }).catch((err) => {
    console.error("Tracker send failed:", err);
  });
}
//startPage View
  // =========================
  // PAGE VIEW START
  // =========================
  
//   sendEvent({
        //   type: "page_view_start",
            //   visitor_id,
                //   session_id,
                //   page_view_id,
                //   page_url: window.location.href,
            //   page_path: window.location.pathname,
            //   page_title: document.title,
            //   referrer: document.referrer,
        // });
        //replaced with 

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
  device_type: /Mobi|Android/i.test(navigator.userAgent)
    ? "mobile"
    : "desktop",
});

  // =========================
  // PAGE VIEW END
  // =========================
  window.addEventListener("beforeunload", () => {
    const duration = Date.now() - startTime;

        // sendEvent({
            //   type: "page_view_end",
            //   visitor_id,
            //   session_id,
            //   page_view_id,
            //   duration,
            //   scroll_depth: getScrollDepth()
            // });
            //replaced with 
        sendEvent({
        type: "page_view_end",
        visitor_id,
        session_id,
        page_view_id,
        duration,
        scroll_depth: getScrollDepth(),
        language: navigator.language,
        user_agent: navigator.userAgent,
        device_type: /Mobi|Android/i.test(navigator.userAgent)
            ? "mobile"
            : "desktop",
        });

  });

  function getScrollDepth() {
    const scrolled = window.scrollY;
    const height = document.body.scrollHeight - window.innerHeight;
    return height > 0 ? scrolled / height : 0;
  }
})();