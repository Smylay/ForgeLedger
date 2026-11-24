// Small helpers with no app state: ids, escaping, safe colours and links,
// dates, messages, downloads and putting focus back.
"use strict";

function id() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function esc(s) {
  return String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  );
}
// Values from imported backups are untrusted. Only a hex colour may reach a
// style attribute, and only an http(s) address may become a link.
function safeColour(c) {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c ?? "") ? c : "";
}
function safeUrl(u) {
  let s = String(u ?? "").trim();
  return /^https?:\/\//i.test(s) ? s : "";
}
// Show a short message, optionally with an action button (e.g. "Undo").
// While a modal dialog is open the rest of the page is inert, so the toast
// moves into the dialog to keep its button usable; app.js moves it back
// when the dialog closes.
function toast(s, ms = 1800, action = "") {
  let e = document.querySelector("#toast"),
    btn = document.querySelector("#toastAction"),
    host = document.querySelector("dialog[open]") || document.body;
  if (e.parentElement !== host) host.append(e);
  document.querySelector("#toastText").textContent = s;
  btn.textContent = action;
  btn.hidden = !action;
  e.style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (e.style.display = "none"), ms);
}
function download(text, name, type = "application/json") {
  let a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
// Today's date as YYYY-MM-DD in local time, the format date inputs use.
function today() {
  let d = new Date(),
    p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// After a redraw, put keyboard focus back on the control the user was on
// (or the first fallback that's still there and enabled).
function refocus(...selectors) {
  for (let s of selectors) {
    let el = document.querySelector(s);
    if (el && !el.disabled) return el.focus();
  }
}
