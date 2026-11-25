// The paint catalogue: about 5,300 paints from 16 brands, in
// data/paint-catalogue.js (built by scripts/make-catalogue.js). It's loaded
// the first time it's needed: the paint form's Find box, quick add on the
// paints page, or planning a recipe with a paint you don't own.
"use strict";

const CATALOGUE_FILE = "data/paint-catalogue.js";
const CATALOGUE_MATCHES = 30; // suggestions shown at a time

// Load the catalogue once, as a <script>, which works from file:// too.
// Resolves with `catalogue.paints`; rejects if the file can't be loaded,
// and the next call tries again.
function loadCatalogue() {
  catalogue.load ??= new Promise((res, rej) => {
    let ready = () => {
      if (typeof PAINT_CATALOGUE === "undefined")
        return rej(new Error("no catalogue"));
      let { brands, ranges, types, paints } = PAINT_CATALOGUE;
      catalogue.paints = paints.map(
        ([b, r, name, code, hex, t, discontinued]) => {
          let brand = brands[b],
            range = ranges[r],
            label = `${name} · ${brand} ${range}${discontinued ? " (discontinued)" : ""}`;
          return {
            brand,
            range,
            name,
            code,
            hex: hex ? "#" + hex : "",
            type: types[t],
            label,
            text: `${name} ${brand} ${range} ${code}`.toLowerCase(),
          };
        },
      );
      catalogue.byLabel = new Map(catalogue.paints.map((p) => [p.label, p]));
      res(catalogue.paints);
    };
    if (typeof PAINT_CATALOGUE !== "undefined") return ready();
    let s = document.createElement("script");
    s.src = CATALOGUE_FILE;
    s.onload = ready;
    s.onerror = () => {
      s.remove();
      catalogue.load = null;
      rej(new Error("couldn't load the catalogue"));
    };
    document.head.append(s);
  });
  return catalogue.load;
}
// Catalogue paints matching `text`: every word must appear in the name,
// brand, range or code. Names that start with the text come first.
function findInCatalogue(text, limit = CATALOGUE_MATCHES) {
  let q = String(text).trim().toLowerCase(),
    words = q.split(/\s+/).filter(Boolean);
  if (!catalogue.paints || !words.length) return [];
  let rank = (p) => {
    let n = p.name.toLowerCase();
    return n.startsWith(q) ? 0 : n.includes(q) ? 1 : 2;
  };
  return catalogue.paints
    .filter((p) => words.every((w) => p.text.includes(w)))
    .map((p) => [rank(p), p])
    .sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name))
    .slice(0, limit)
    .map(([, p]) => p);
}
// The catalogue's exact entry for a label picked from a suggestion list.
function catalogueEntry(label) {
  return catalogue.byLabel?.get(label) || null;
}
function catalogueOptions(list) {
  return list.map((p) => `<option value="${esc(p.label)}"></option>`).join("");
}
// The catalogue's brands, and a brand's ranges, for suggestions; empty
// until the catalogue has loaded.
function catalogueBrands() {
  return catalogue.paints
    ? [...new Set(catalogue.paints.map((p) => p.brand))]
    : [];
}
function catalogueRanges(brand) {
  let b = String(brand ?? "")
    .trim()
    .toLowerCase();
  if (!catalogue.paints || !b) return [];
  return [
    ...new Set(
      catalogue.paints
        .filter((p) => p.brand.toLowerCase() === b)
        .map((p) => p.range),
    ),
  ];
}
// A paint record from a catalogue entry, plus `extra` fields.
function paintFromCatalogue(p, extra = {}) {
  return {
    id: id(),
    name: p.name,
    brand: p.brand,
    range: p.range,
    type: p.type,
    colour: p.hex,
    ...extra,
  };
}

// The paint form's Find box, above its fields.
function catalogueFindHtml() {
  return `<div class="full catalogfind"><label>Find in the paint catalogue<input id="catalogueFind" type="search" list="catalogueList" autocomplete="off" placeholder="Type a paint name or code…"></label><datalist id="catalogueList"></datalist><small class="muted" id="catalogueHint" role="status">About 5,300 paints from 16 brands. Picking one fills in the details below.</small></div>`;
}
// Typing in the Find box: suggest matches; picking one fills the form.
async function catalogueFindInput(input) {
  let form = input.form,
    hint = form.querySelector("#catalogueHint");
  try {
    await loadCatalogue();
  } catch {
    hint.textContent = "The paint catalogue couldn't be loaded.";
    return;
  }
  let p = catalogueEntry(input.value);
  if (p) {
    fillPaintForm(form, p);
    input.value = "";
    form.querySelector("#catalogueList").innerHTML = "";
    hint.textContent = `Filled in from the catalogue: ${p.label}.`;
    return;
  }
  form.querySelector("#catalogueList").innerHTML = catalogueOptions(
    input.value.trim().length >= 2 ? findInCatalogue(input.value) : [],
  );
}
// Fill the paint form's name, brand, range, type and colour from `p`.
// Stock, quantity, price and notes are left as they are.
function fillPaintForm(form, p) {
  let el = form.elements;
  el.name.value = p.name;
  el.brand.value = p.brand;
  el.range.value = p.range;
  el.type.value = p.type;
  form.querySelector('[data-nocolour="colour"]').checked = !p.hex;
  if (p.hex) el.colour.value = p.hex.toLowerCase();
  refreshSuggestions(form);
}
// When the paint form opens, load the catalogue in the background, then
// add its brands and ranges to the suggestions.
function catalogueForForm(form) {
  if (formSection !== "paints") return;
  loadCatalogue()
    .then(() => {
      if (form.isConnected && formSection === "paints")
        refreshSuggestions(form);
    })
    .catch(() => {});
}

// Quick add on the paints page suggests catalogue paints; picking one adds
// it straight away, with its details, as a paint you have (Full, quantity
// 1). Straight away, because while suggestions show, Safari (WebKit) takes
// Enter to close them rather than to submit.
async function quickCatalogueInput(input) {
  if (section !== "paints") return;
  try {
    await loadCatalogue();
  } catch {
    return;
  }
  if (catalogueEntry(input.value)) return input.form.requestSubmit();
  document.querySelector("#quickCatalogue").innerHTML = catalogueOptions(
    input.value.trim().length >= 2 ? findInCatalogue(input.value) : [],
  );
}
function quickCatalogueRecord(name) {
  let p = section === "paints" && catalogueEntry(name);
  return p ? paintFromCatalogue(p, { quantity: "1", stock: "Full" }) : null;
}

// Planning a recipe with a paint you don't own: the box under the
// miniature form's Recipe paints offers your wishlist's paints and the
// catalogue. Picking one adds it to the recipe as a pending choice
// ("wish:<id>" or "cat:<label>"); saving the form turns it into a paint
// (planPaints, below).
function planPaintHtml() {
  return `<div class="full planpaint"><label>Add a paint you don't own yet<input id="planPaint" type="search" list="planList" autocomplete="off" placeholder="From your wishlist or the paint catalogue…"></label><datalist id="planList"></datalist><small class="muted" id="planHint" role="status">Saved as a paint you don't have yet, and added to your wishlist.</small></div>`;
}
// Wishlist paints not yet linked to a paint you have.
function plannableWishes() {
  let paints = new Set(db.paints.map((p) => p.id));
  return db.wishlist.filter(
    (w) =>
      w.category === "Paint" &&
      !paints.has(w.paint) &&
      typeof w.name === "string" &&
      w.name.trim(),
  );
}
function wishLabel(w) {
  return `${w.name} · on your wishlist`;
}
async function planPaintInput(input) {
  let form = input.form,
    hint = form.querySelector("#planHint"),
    text = input.value,
    wishes = plannableWishes(),
    w = wishes.find((x) => wishLabel(x) === text);
  try {
    await loadCatalogue();
  } catch {} // the wishlist still works
  let p = !w && catalogueEntry(text);
  if (w || p) {
    let select = form.elements.paints,
      value = w ? "wish:" + w.id : "cat:" + p.label,
      name = w ? w.name : `${p.name} (${p.brand})`;
    if (![...select.options].some((o) => o.value === value)) {
      let o = document.createElement("option");
      o.value = value;
      o.textContent = `${name}, not owned yet`;
      o.selected = true;
      select.append(o);
    }
    input.value = "";
    form.querySelector("#planList").innerHTML = "";
    hint.textContent = `Added ${name}. Saving adds it to your paints, as not owned yet, and to your wishlist.`;
    return;
  }
  let q = text.trim().toLowerCase();
  form.querySelector("#planList").innerHTML =
    wishes
      .filter((x) => !q || x.name.toLowerCase().includes(q))
      .map((x) => `<option value="${esc(wishLabel(x))}"></option>`)
      .join("") + catalogueOptions(q.length >= 2 ? findInCatalogue(q) : []);
}
// On saving a miniature: turn pending recipe choices into paints. Runs
// inside the save's commit(), so a failed save undoes them too.
// - A wishlist paint becomes a paint (Empty, quantity 0), and the wishlist
//   item restocks it.
// - A catalogue paint becomes one too, with a new wishlist item, unless
//   you already have a paint with that brand and name.
function planPaints(ids) {
  let have = new Set(db.paints.map((p) => p.id)),
    out = [];
  for (let v of ids) {
    if (have.has(v) || typeof v !== "string") out.push(v);
    else if (v.startsWith("wish:")) {
      let w = db.wishlist.find((x) => x.id === v.slice(5));
      if (!w) continue;
      let p = {
        id: id(),
        name: w.name,
        brand: "",
        stock: "Empty",
        quantity: "0",
      };
      db.paints.push(p);
      w.paint = p.id;
      out.push(p.id);
    } else if (v.startsWith("cat:")) {
      let c = catalogueEntry(v.slice(4));
      if (!c) continue;
      let same = db.paints.find(
        (p) =>
          String(p.name).toLowerCase() === c.name.toLowerCase() &&
          String(p.brand).toLowerCase() === c.brand.toLowerCase(),
      );
      if (same) {
        out.push(same.id);
        continue;
      }
      let p = paintFromCatalogue(c, { stock: "Empty", quantity: "0" });
      db.paints.push(p);
      db.wishlist.push({
        id: id(),
        name: `${c.name} (${c.brand})`,
        category: "Paint",
        priority: "Medium",
        paint: p.id,
      });
      out.push(p.id);
    }
  }
  return [...new Set(out)];
}
