// The phase editor (Edit board): rename, reorder, add and delete the
// board's phases between To do and Done, moving model cards to match.
"use strict";

// Open the editor. Rows keep the phase name they started with
// (`data-orig`), so Save can tell a renamed phase from a deleted one.
function openPhases() {
  document.querySelector("#phaseList").innerHTML =
    `<li class="fixed">${esc(FIRST_PHASE)}</li>` +
    boardPhases()
      .slice(1, -1)
      .map((s) => phaseRowHtml(s, s))
      .join("") +
    `<li class="fixed">${esc(LAST_PHASE)}</li>`;
  numberPhaseRows();
  document.querySelector("#phasesDialog").showModal();
}
function phaseRowHtml(name, orig) {
  return `<li data-row${orig === null ? "" : ` data-orig="${esc(orig)}"`}><input name="phase" value="${esc(name)}" required maxlength="${MAX_PHASE_NAME}" /><button type="button" class="btn" data-pup>↑</button><button type="button" class="btn" data-pdown>↓</button><button type="button" class="btn" data-pdel>Delete</button></li>`;
}
// Label the rows by position, and disable moves and deletes that can't
// happen: there's always at least one phase between To do and Done.
function numberPhaseRows() {
  let rows = [...document.querySelectorAll("#phaseList li[data-row]")];
  rows.forEach((li, i) => {
    let n = `phase ${i + 1}`;
    li.querySelector("input").setAttribute("aria-label", `Name of ${n}`);
    li.querySelector("[data-pup]").setAttribute("aria-label", `Move ${n} up`);
    li.querySelector("[data-pdown]").setAttribute(
      "aria-label",
      `Move ${n} down`,
    );
    li.querySelector("[data-pdel]").setAttribute("aria-label", `Delete ${n}`);
    li.querySelector("[data-pup]").disabled = i === 0;
    li.querySelector("[data-pdown]").disabled = i === rows.length - 1;
    li.querySelector("[data-pdel]").disabled = rows.length === 1;
  });
  document.querySelector("#addPhase").disabled = rows.length >= MAX_PHASES;
}
// ↑, ↓ and Delete on a row. Moves shift the neighbouring row, so the
// pressed button never leaves the page and keeps focus.
function phaseRowAction(b) {
  let li = b.closest("li[data-row]");
  if (!li) return;
  let prev = li.previousElementSibling,
    next = li.nextElementSibling;
  if (b.hasAttribute("data-pup") && prev?.hasAttribute("data-row"))
    li.after(prev);
  if (b.hasAttribute("data-pdown") && next?.hasAttribute("data-row"))
    li.before(next);
  if (b.hasAttribute("data-pdel")) {
    let to = next?.hasAttribute("data-row") ? next : prev;
    li.remove();
    numberPhaseRows();
    // The neighbour's Delete, or its name when it's the last phase left.
    let del = to?.querySelector("[data-pdel]");
    return (del?.disabled ? to.querySelector("input") : del)?.focus();
  }
  numberPhaseRows();
  if (b.disabled)
    (b.hasAttribute("data-pup")
      ? li.querySelector("[data-pdown]")
      : li.querySelector("[data-pup]")
    ).focus();
}
function addPhaseRow() {
  let rows = document.querySelectorAll("#phaseList li[data-row]");
  if (rows.length >= MAX_PHASES) return;
  document
    .querySelector("#phaseList li.fixed:last-child")
    .insertAdjacentHTML("beforebegin", phaseRowHtml("", null));
  numberPhaseRows();
  let all = document.querySelectorAll("#phaseList li[data-row]");
  all[all.length - 1].querySelector("input").focus();
}
// Save: check the names, then apply. Returns false to keep the editor open.
function savePhases() {
  let rows = [...document.querySelectorAll("#phaseList li[data-row]")].map(
      (li) => ({
        input: li.querySelector("input"),
        orig: li.hasAttribute("data-orig") ? li.dataset.orig : null,
        name: li.querySelector("input").value.trim(),
      }),
    ),
    ends = [FIRST_PHASE.toLowerCase(), LAST_PHASE.toLowerCase()],
    seen = new Set();
  for (let r of rows) {
    let key = r.name.toLowerCase();
    let problem = !r.name
      ? "Give this phase a name."
      : ends.includes(key)
        ? `"${r.name}" is always the first or last phase.`
        : seen.has(key)
          ? "Another phase already has this name."
          : "";
    seen.add(key);
    r.input.setCustomValidity(problem);
    if (problem) {
      r.input.reportValidity();
      return false;
    }
  }
  return applyPhases(rows);
}
// What each old phase becomes: its row's new name, or for a deleted phase
// the next phase that's kept (else the one before it), so models in it
// move on rather than back, and never straight to Done.
function phaseMap(oldList, rows) {
  let kept = new Map(
      rows.filter((r) => r.orig !== null).map((r) => [r.orig, r.name]),
    ),
    map = {},
    deleted = new Set();
  oldList.forEach((s, i) => {
    if (kept.has(s)) return (map[s] = kept.get(s));
    let after = oldList.slice(i + 1).find((x) => kept.has(x)),
      before = oldList
        .slice(0, i)
        .reverse()
        .find((x) => kept.has(x));
    map[s] = kept.get(after ?? before) ?? rows[0].name;
    deleted.add(s);
  });
  return { map, deleted };
}
// Save the phases, and move every card in one commitWithUndo. Miniatures
// whose models moved on follow (queue.js).
function applyPhases(rows) {
  let names = rows.map((r) => r.name),
    plan = phaseMap(boardPhases().slice(1, -1), rows),
    moved = 0,
    synced = 0;
  commitWithUndo(
    () => {
      db.queueStages = names;
      for (let q of db.queue) {
        for (let c of cardsOf(q))
          if (Object.hasOwn(plan.map, c.phase)) {
            if (plan.deleted.has(c.phase)) moved++;
            c.phase = plan.map[c.phase];
          }
        if (syncMiniature(q)) synced++;
      }
    },
    () =>
      "Saved the board" +
      (moved ? `; ${moved} model(s) moved on from a deleted phase` : "") +
      (synced ? `; ${synced} miniature(s) updated` : ""),
  );
  return true; // close the editor even if saving failed: commit said why
}
