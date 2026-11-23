// Small helpers with no app state: ids, escaping, money, messages, downloads.
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
function money(n) {
  return "£" + (Number(n) || 0).toFixed(2);
}
// Show a short message, optionally with an action button (e.g. "Undo").
function toast(s, ms = 1800, action = "") {
  let e = document.querySelector("#toast"),
    btn = document.querySelector("#toastAction");
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
const today = () => new Date().toISOString().slice(0, 10);
