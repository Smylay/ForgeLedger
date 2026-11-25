// Paints: stock helpers, and "Used in" (the miniatures whose recipe uses
// a paint).
"use strict";

// A paint is low when its stock is Low or Empty.
function isLow(p) {
  return p.stock === "Low" || p.stock === "Empty";
}
// The stock level for an old Remaining % value, or "" if it isn't a number.
// migrate() uses it once, when paints move from percentages to levels.
function stockFromPercent(value) {
  if (value === "" || value == null) return "";
  let n = Number(value);
  if (Number.isNaN(n)) return "";
  if (n <= 0) return "Empty";
  if (n < 20) return "Low";
  if (n < 50) return "Half";
  if (n < 80) return "Good";
  return "Full";
}
// The low paints a miniature's recipe uses.
function lowRecipePaints(m) {
  return m
    ? linkedAll(column(defs.miniatures, "paints"), m.paints).filter(isLow)
    : [];
}
// The miniatures whose recipe uses paint `p`.
function usedIn(p) {
  return db.miniatures.filter((m) => asList(m.paints).includes(p.id));
}
// The paints table's "Used in" cell: a button that lists them, or blank.
function usedInHtml(p) {
  let n = usedIn(p).length;
  return n
    ? `<span class="rowacts"><button data-usedin="${esc(p.id)}" aria-label="Used in ${n} miniature${n === 1 ? "" : "s"}: ${esc(p.name)}">${n} miniature${n === 1 ? "" : "s"}</button></span>`
    : "";
}
// The "Used in" dialog: each miniature with its project and status.
function showUsedIn(pid) {
  let p = db.paints.find((x) => x.id === pid);
  if (!p) return;
  let project = column(defs.miniatures, "project");
  document.querySelector("#usedInTitle").textContent = `Used in: ${p.name}`;
  document.querySelector("#usedInList").innerHTML = usedIn(p)
    .map((m) => {
      let proj = linked(project, m.project);
      return `<li><b>${esc(m.name)}</b>${proj ? ` <span class="muted">· ${esc(proj.name)}</span>` : ""}${m.status ? ` <span class="muted">· ${esc(m.status)}</span>` : ""}</li>`;
    })
    .join("");
  document.querySelector("#usedInDialog").showModal();
}

// Restocks: pots of a paint you have, bought again, as { date, price } in
// the paint's optional `restocks` list. Bought on a wishlist item that
// restocks the paint records one; the paint form records or removes them.
// Recorded spend adds their prices. Stored lists may be junk.
function restocks(p) {
  return Array.isArray(p?.restocks) ? p.restocks.filter(isRecord) : [];
}
function restockPrice(r) {
  let n = Number(r.price);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
function restockSpend(p) {
  return restocks(p).reduce((a, r) => a + restockPrice(r), 0);
}
// Record a restock bought today.
function addRestock(p, price) {
  p.restocks = [...restocks(p), { date: today(), price: String(price ?? "") }];
}
// The paint form's Restocks section, below its fields: each restock with a
// Remove box, and a box to record one bought today. Only when editing.
function restocksHtml(p) {
  if (!p?.id) return "";
  let list = restocks(p),
    rows = list
      .map((r, i) => {
        let price = restockPrice(r),
          date =
            (["string", "number"].includes(typeof r.date) && esc(r.date)) ||
            "no date";
        return `<li><span>${date} · ${price ? money(price) : "no price"}</span><label class="check"><input type="checkbox" name="restockRemove" value="${i}" aria-label="Remove the restock of ${date}"> Remove</label></li>`;
      })
      .join("");
  return `<fieldset class="full restocks"><legend>Restocks</legend>${
    list.length
      ? `<ul>${rows}</ul><p class="muted">${money(restockSpend(p))} on ${list.length} restock(s), counted in Recorded spend.</p>`
      : '<p class="muted">None yet. Bought on a wishlist item for this paint records one.</p>'
  }<label>${esc(priced("Record a restock bought today"))}<input type="number" name="restockPrice" min="0" step="0.01" inputmode="decimal"></label></fieldset>`;
}
// Saving the paint form: take the Restocks section's boxes out of the
// record, and apply them to its restocks.
function saveRestocks(o, prev, fd) {
  let remove = new Set(fd.getAll("restockRemove").map(Number)),
    price = String(o.restockPrice ?? "").trim();
  delete o.restockRemove;
  delete o.restockPrice;
  if (!prev || (!remove.size && price === "")) return;
  let list = restocks(prev).filter((_, i) => !remove.has(i));
  if (price !== "") list.push({ date: today(), price });
  o.restocks = list;
}
