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
