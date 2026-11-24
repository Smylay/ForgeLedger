// Suggestions for free-text boxes such as brand, range, faction and game
// system: what you've already entered first (most used first), then common
// values. They're a <datalist>, so you can still type anything.
"use strict";

// Common values, by the name a field's `suggest` gives. Paint brands are
// spelt as in the paint catalogue (miniature_paints.json).
const SUGGESTION_LISTS = {
  paintBrands: [
    "Citadel",
    "Vallejo",
    "The Army Painter",
    "AK Interactive",
    "AMMO by Mig",
    "Scale75",
    "Monument Hobbies (Pro Acryl)",
    "Two Thin Coats (Duncan Rhodes)",
    "Reaper",
    "Green Stuff World",
    "Kimera Kolors",
    "Coat d'Arms",
    "Foundry",
    "Formula P3 (Privateer Press)",
    "Turbo Dork",
    "Tamiya",
    "Liquitex",
    "Winsor & Newton",
  ],
  toolBrands: [
    "Citadel",
    "The Army Painter",
    "Vallejo",
    "Green Stuff World",
    "Artis Opus",
    "Rosemary & Co",
    "Raphael",
    "da Vinci",
    "Winsor & Newton",
    "Redgrass Games",
    "Harder & Steenbeck",
    "Iwata",
    "Badger",
    "Tamiya",
    "Xuron",
  ],
  miniatureBrands: [
    "Games Workshop",
    "Forge World",
    "Warlord Games",
    "Reaper",
    "Wargames Atlantic",
    "Mantic Games",
    "Atomic Mass Games",
    "Corvus Belli",
    "Para Bellum",
    "Steamforged Games",
    "CMON",
    "Wyrd",
    "Privateer Press",
    "North Star",
    "Victrix",
    "Perry Miniatures",
    "Footsore",
    "WizKids",
  ],
  gameSystems: [
    "Warhammer 40,000",
    "Warhammer: Age of Sigmar",
    "Warhammer: The Old World",
    "The Horus Heresy",
    "Kill Team",
    "Warcry",
    "Necromunda",
    "Blood Bowl",
    "Middle-earth Strategy Battle Game",
    "Bolt Action",
    "Star Wars: Legion",
    "Star Wars: Shatterpoint",
    "Marvel: Crisis Protocol",
    "Infinity",
    "Warmachine",
    "Malifaux",
    "Frostgrave",
    "Stargrave",
    "Kings of War",
    "Conquest",
    "Grimdark Future",
    "Age of Fantasy",
    "BattleTech",
    "Trench Crusade",
    "Dungeons & Dragons",
  ],
};

// The values to suggest for field `f` of collection `sec`, given the form's
// current values `obj`.
// - Your own values come from the same field in `sec`, or in every
//   collection `f.suggestFrom` names (faction is shared by miniatures and
//   projects). Most used first; spelling differences in case count as one.
// - With `f.suggestBy` (range, by brand), values from records whose
//   `suggestBy` field matches the form's are all that's offered, when there
//   are any.
// - Then the common values in SUGGESTION_LISTS[f.suggest], if any.
function suggestions(f, sec, obj = {}) {
  let counts = new Map(),
    add = (v, weight = 1) => {
      if (typeof v !== "string" || !v.trim()) return;
      let k = v.trim().toLowerCase(),
        e = counts.get(k);
      if (e) e.n += weight;
      else counts.set(k, { v: v.trim(), n: weight });
    };
  let records = (f.suggestFrom || [sec]).flatMap((c) => db[c] || []),
    by =
      f.suggestBy &&
      String(obj[f.suggestBy] ?? "")
        .trim()
        .toLowerCase();
  if (by) {
    let match = records.filter(
      (r) =>
        typeof r[f.suggestBy] === "string" &&
        r[f.suggestBy].trim().toLowerCase() === by,
    );
    if (match.length) records = match;
  }
  for (let r of records) add(r[f.key]);
  let yours = [...counts.values()]
    .sort((a, b) => b.n - a.n || a.v.localeCompare(b.v))
    .map((e) => e.v);
  // Then values from elsewhere, like the paint catalogue's ranges for the
  // brand, then the common list; each value once.
  let more = [
      ...(f.suggestMore?.(obj) || []),
      ...(SUGGESTION_LISTS[f.suggest] || []),
    ],
    seen = new Set(counts.keys()),
    rest = [];
  for (let v of more)
    if (!seen.has(v.toLowerCase())) {
      seen.add(v.toLowerCase());
      rest.push(v);
    }
  return [...yours, ...rest];
}
// The <datalist> for a field that suggests values.
function suggestHtml(f, sec, obj) {
  return `<datalist id="suggest-${f.key}">${suggestions(f, sec, obj)
    .map((v) => `<option value="${esc(v)}"></option>`)
    .join("")}</datalist>`;
}
// When a box another field's suggestions follow changes (brand, for range),
// redraw that field's suggestions from the form as it is now.
function updateSuggestions(form, changed) {
  let d = defs[formSection];
  if (!d) return;
  let values = Object.fromEntries(new FormData(form));
  for (let f of d.fields)
    if (f.suggestBy === changed) {
      let list = form.querySelector(`#suggest-${f.key}`);
      if (list) list.outerHTML = suggestHtml(f, formSection, values);
    }
}
// Redraw every suggestion list in the form, e.g. once the paint catalogue
// has loaded.
function refreshSuggestions(form) {
  let d = defs[formSection];
  if (!d) return;
  let values = Object.fromEntries(new FormData(form));
  for (let f of d.fields) {
    let list = f.suggest && form.querySelector(`#suggest-${f.key}`);
    if (list) list.outerHTML = suggestHtml(f, formSection, values);
  }
}
