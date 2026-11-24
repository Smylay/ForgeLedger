// Settings: the theme, the currency prices are shown in, keyboard
// shortcuts, and erasing everything. Auto-save has its own file.
"use strict";

// Currencies to choose from in Settings: name, and the locale that sets
// how amounts look (e.g. "£4.50", "4,50 kr"). Stored as `db.currency`;
// missing means GBP. Changing it changes the symbol, not the amounts.
const CURRENCIES = {
  GBP: ["Pound sterling", "en-GB"],
  EUR: ["Euro", "en-IE"],
  USD: ["US dollar", "en-US"],
  CAD: ["Canadian dollar", "en-CA"],
  AUD: ["Australian dollar", "en-AU"],
  NZD: ["New Zealand dollar", "en-NZ"],
  JPY: ["Japanese yen", "ja-JP"],
  CHF: ["Swiss franc", "de-CH"],
  SEK: ["Swedish krona", "sv-SE"],
  NOK: ["Norwegian krone", "nb-NO"],
  DKK: ["Danish krone", "da-DK"],
  PLN: ["Polish złoty", "pl-PL"],
};
// The chosen currency's code; anything unknown counts as GBP.
function currencyCode() {
  return Object.hasOwn(CURRENCIES, db?.currency) ? db.currency : "GBP";
}
function moneyFormat() {
  let code = currencyCode();
  return new Intl.NumberFormat(CURRENCIES[code][1], {
    style: "currency",
    currency: code,
  });
}
// An amount in the chosen currency, e.g. "£4.50". Blank or junk is 0.
function money(n) {
  return moneyFormat().format(Number(n) || 0);
}
function currencySymbol() {
  return moneyFormat()
    .formatToParts(0)
    .find((p) => p.type === "currency").value;
}
// A money field's label with the currency symbol, e.g. "Cost (£)".
function priced(label) {
  return `${label} (${currencySymbol()})`;
}
// Data replacing the current data keeps the chosen currency, unless it
// brings its own (a backup made since currencies could be chosen).
function withCurrency(next) {
  if (!Object.hasOwn(next, "currency") && db.currency)
    next.currency = db.currency;
  return next;
}
function setCurrency(code) {
  if (!Object.hasOwn(CURRENCIES, code)) return;
  if (!commit(() => (db.currency = code))) return;
  renderNav();
  render();
  toast(`Prices are shown in ${CURRENCIES[code][0]}`);
}
function themeSetting() {
  try {
    let t = localStorage.getItem(THEME_KEY);
    return THEMES.includes(t) ? t : "dark";
  } catch {
    return "dark";
  }
}
function setTheme(t) {
  if (!THEMES.includes(t)) return;
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {}
}
function shortcutsOn() {
  try {
    return localStorage.getItem(SHORTCUTS_KEY) !== "off";
  } catch {
    return true;
  }
}
// The single-key shortcuts switch, in Settings and in the shortcuts list.
function setShortcuts(on) {
  try {
    localStorage.setItem(SHORTCUTS_KEY, on ? "on" : "off");
  } catch {}
}
function openKeys() {
  document.querySelector("#keysOn").checked = shortcutsOn();
  document.querySelector("#keysDialog").showModal();
}
// Settings: theme, currency, auto-save, shortcuts and erasing everything.
function openSettings() {
  renderSettings();
  document.querySelector("#settingsDialog").showModal();
}
function renderSettings() {
  document.querySelector("#themeSetting").value = themeSetting();
  let pick = document.querySelector("#currencySetting");
  if (!pick.options.length)
    pick.innerHTML = Object.entries(CURRENCIES)
      .map(
        ([code, [name, locale]]) =>
          `<option value="${code}">${name} (${new Intl.NumberFormat(locale, { style: "currency", currency: code }).format(4.5)})</option>`,
      )
      .join("");
  pick.value = currencyCode();
  document.querySelector("#settingsKeysOn").checked = shortcutsOn();
  renderAutoSave();
}
// Erase everything: data and photos. A backup downloads first, and
// auto-saving stops before anything is erased, so its file keeps the data.
// There's no Undo: the photos are gone.
async function eraseAll() {
  if (
    !confirm(
      "Erase all your ForgeLedger data and photos in this browser?\n\nA backup downloads first. This can't be undone.",
    )
  )
    return;
  await stopAutoSave();
  download(await backupJson(db), `forgeledger-before-erase-${today()}.json`);
  if (!commit(() => (db = structuredClone(defaults)))) return;
  try {
    if (await photosWork())
      await deletePhotos((await allPhotos()).map((p) => p.id));
  } catch {}
  for (let url of photoUrls.values()) URL.revokeObjectURL(url);
  photoUrls.clear();
  newRewards = [];
  renderRewardNotice();
  document.querySelector("#settingsDialog").close();
  go("dashboard");
  renderNav();
  render();
  toast("Erased all data. The backup is in your downloads.", 6000);
}
