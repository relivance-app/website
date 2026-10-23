/* Public configuration only. Set data-turnstile-sitekey after approved setup.
   Never put a Turnstile secret or Supabase service credential in this repository. */
(function () {
  "use strict";
  document.getElementById("year").textContent = new Date().getFullYear();
  const form = document.getElementById("access-form");
  const email = document.getElementById("email");
  const button = form.querySelector("button[type=submit]");
  const error = document.getElementById("access-error");
  const success = document.getElementById("access-success");
  const sitekey = form.dataset.turnstileSitekey;
  const endpoint = "https://uvujqophgbujljapifdv.supabase.co/functions/v1/waitlist-signup";
  let token = "";
  let widget;
  let pending = false;
  let completed = false;
  let loadingTimer;
  function setError(message, invalidEmail = false) {
    error.textContent = message;
    error.hidden = !message;
    email.setAttribute("aria-invalid", String(invalidEmail));
  }
  function setButton() { button.disabled = pending || completed || !token; }
  function resetCaptcha() {
    token = "";
    setButton();
    if (widget !== undefined && window.turnstile) {
      try { window.turnstile.reset(widget); }
      catch (_) { setError("Verification is unavailable. Please reload and try again."); }
    }
  }
  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (pending || completed) return;
    const address = email.value.trim().toLowerCase();
    if (new TextEncoder().encode(address).length > 254 || /[\u0000-\u001f\u007f]/u.test(address) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(address)) {
      setError("Please enter a valid email address.", true);
      email.focus();
      return;
    }
    if (!token) { setError("Please complete the security verification."); return; }
    pending = true;
    setError("");
    form.dataset.state = "submitting";
    form.setAttribute("aria-busy", "true");
    email.readOnly = true;
    setButton();
    const submittedToken = token;
    token = "";
    try {
      const response = await fetch(endpoint, {
        method: "POST", credentials: "omit", redirect: "error",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(20000),
        body: JSON.stringify({ email: address, captchaToken: submittedToken,
          website: document.getElementById("website").value }),
      });
      const result = await response.json();
      if (response.ok && result.code === "registered") {
        completed = true;
        form.dataset.state = "success";
        email.value = address;
        email.disabled = true;
        success.textContent = "You’re on the early access list.";
        if (widget !== undefined && window.turnstile) {
          try { window.turnstile.remove(widget); } catch (_) { /* Signup already succeeded. */ }
        }
      } else if (result.code === "invalid_email") {
        setError("Please enter a valid email address.", true);
      } else if (result.code === "verification_required") {
        setError("Please complete a new security verification and try again.");
      } else {
        setError("Something went wrong. Please try again in a moment.");
      }
    } catch (_) {
      setError("Network error. Please try again in a moment.");
    } finally {
      pending = false;
      form.removeAttribute("aria-busy");
      if (!completed) {
        delete form.dataset.state;
        email.readOnly = false;
        resetCaptcha(); // Every submission consumes a token, including retryable failures.
      }
      setButton();
    }
  });
  email.addEventListener("input", () => { if (!pending && !completed) setError(""); });
  if (!sitekey) {
    setError("Signup is temporarily unavailable. Please try again later.");
    return;
  }
  window.waitlistTurnstileReady = function () {
    clearTimeout(loadingTimer);
    try {
      widget = window.turnstile.render("#access-captcha", {
        sitekey, action: "waitlist_signup", appearance: "interaction-only",
        size: window.matchMedia("(max-width: 360px)").matches ? "compact" : "flexible", theme: "auto", "response-field": false,
        callback: (value) => { token = value; if (!pending && !completed) setError(""); setButton(); },
        "expired-callback": () => { token = ""; setButton(); },
        "timeout-callback": () => { resetCaptcha(); },
        "error-callback": () => {
          token = ""; setButton();
          setError("Verification is unavailable. Please reload and try again.");
        },
      });
    } catch (_) { setError("Verification is unavailable. Please reload and try again."); }
  };
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=waitlistTurnstileReady&render=explicit";
  script.async = true;
  script.onerror = () => { clearTimeout(loadingTimer); setError("Verification is unavailable. Please reload and try again."); };
  loadingTimer = setTimeout(() => setError("Verification is unavailable. Please reload and try again."), 15000);
  document.head.appendChild(script);
})();
