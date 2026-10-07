// app/platform/create-site/starterForm.mjs
// The basic contact form offered on the create-site screen for people who do not have a lead form yet.
// Kept as plain text so the screen shows exactly what is copied, and so scripts/tracker-e2e/forms.js can
// load the same string and prove the tracker captures it. If you change it, run that script.
//
// It stores the lead in Jellyhook (the tracker captures the submission before the inline handler runs) and
// shows a thank-you message. To also send it to their own system, the owner replaces the onsubmit handler;
// Jellyhook keeps recording the submission either way.
export const STARTER_FORM = `<form data-conversion="true" onsubmit="event.preventDefault();this.innerHTML='<p>Thanks! We will be in touch.</p>'" style="max-width:420px;font-family:system-ui,sans-serif;font-size:15px">
  <label>Name<br><input name="name" required style="width:100%;padding:8px;margin:4px 0 12px;box-sizing:border-box"></label>
  <label>Email<br><input name="email" type="email" required style="width:100%;padding:8px;margin:4px 0 12px;box-sizing:border-box"></label>
  <label>Phone (optional)<br><input name="phone" type="tel" style="width:100%;padding:8px;margin:4px 0 12px;box-sizing:border-box"></label>
  <label>Message<br><textarea name="message" rows="4" style="width:100%;padding:8px;margin:4px 0 12px;box-sizing:border-box"></textarea></label>
  <button type="submit" style="padding:10px 18px;cursor:pointer">Send</button>
  <p style="font-size:10px;opacity:.5;margin:12px 0 0">Powered by <a href="https://jellyhook.com" style="color:inherit">Jellyhook</a></p>
</form>`;
