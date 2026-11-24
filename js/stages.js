// The stage editor: the default stages, or one queue item's own, and
// moving items when stages are renamed, reordered or deleted.
"use strict";

// The stage editor: the default list (`qid` null) or one queue item's own.
// Rows keep the stage name they started with (`data-orig`), so Save can
// tell a renamed stage from a deleted one.
function openStages(qid) {
  let q = qid ? db.queue.find((x) => x.id === qid) : null;
  if (qid && !q) return;
  editingStages = { qid: q ? q.id : null };
  document.querySelector("#stagesTitle").textContent = q
    ? `Stages for "${q.name}"`
    : "Default stages";
  document.querySelector("#stagesHint").textContent = q
    ? ownStages(q)
      ? "This item has its own stages. Not started and Complete are always first and last."
      : "This item uses the default stages. Saving here gives it its own copy to change."
    : "Queue items use these unless they have their own. Not started and Complete are always first and last.";
  document.querySelector("#resetStages").hidden = !(q && ownStages(q));
  document.querySelector("#stageList").innerHTML =
    '<li class="fixed">Not started</li>' +
    queueStages(q)
      .slice(1, -1)
      .map((s) => stageRowHtml(s, s))
      .join("") +
    '<li class="fixed">Complete</li>';
  numberStageRows();
  document.querySelector("#stagesDialog").showModal();
}
function stageRowHtml(name, orig) {
  return `<li data-row${orig === null ? "" : ` data-orig="${esc(orig)}"`}><input name="stage" value="${esc(name)}" required maxlength="${MAX_STAGE_NAME}" /><button type="button" class="btn" data-sup>↑</button><button type="button" class="btn" data-sdown>↓</button><button type="button" class="btn" data-sdel>Delete</button></li>`;
}
// Label the rows by position, and disable moves and deletes that can't
// happen: there's always at least one stage.
function numberStageRows() {
  let rows = [...document.querySelectorAll("#stageList li[data-row]")];
  rows.forEach((li, i) => {
    let n = `stage ${i + 1}`;
    li.querySelector("input").setAttribute("aria-label", `Name of ${n}`);
    li.querySelector("[data-sup]").setAttribute("aria-label", `Move ${n} up`);
    li.querySelector("[data-sdown]").setAttribute(
      "aria-label",
      `Move ${n} down`,
    );
    li.querySelector("[data-sdel]").setAttribute("aria-label", `Delete ${n}`);
    li.querySelector("[data-sup]").disabled = i === 0;
    li.querySelector("[data-sdown]").disabled = i === rows.length - 1;
    li.querySelector("[data-sdel]").disabled = rows.length === 1;
  });
  document.querySelector("#addStage").disabled = rows.length >= MAX_STAGES;
}
// ↑, ↓ and Delete on a row. Moves shift the neighbouring row, so the
// pressed button never leaves the page and keeps focus.
function stageRowAction(b) {
  let li = b.closest("li[data-row]");
  if (!li) return;
  let prev = li.previousElementSibling,
    next = li.nextElementSibling;
  if (b.hasAttribute("data-sup") && prev?.hasAttribute("data-row"))
    li.after(prev);
  if (b.hasAttribute("data-sdown") && next?.hasAttribute("data-row"))
    li.before(next);
  if (b.hasAttribute("data-sdel")) {
    let to = next?.hasAttribute("data-row") ? next : prev;
    li.remove();
    numberStageRows();
    // The neighbour's Delete, or its name when it's the last stage left.
    let del = to?.querySelector("[data-sdel]");
    return (del?.disabled ? to.querySelector("input") : del)?.focus();
  }
  numberStageRows();
  if (b.disabled)
    (b.hasAttribute("data-sup")
      ? li.querySelector("[data-sdown]")
      : li.querySelector("[data-sup]")
    ).focus();
}
function addStageRow() {
  let rows = document.querySelectorAll("#stageList li[data-row]");
  if (rows.length >= MAX_STAGES) return;
  document
    .querySelector("#stageList li.fixed:last-child")
    .insertAdjacentHTML("beforebegin", stageRowHtml("", null));
  numberStageRows();
  let all = document.querySelectorAll("#stageList li[data-row]");
  all[all.length - 1].querySelector("input").focus();
}
// Save: check the names, then apply. Returns false to keep the editor open.
function saveStages() {
  let rows = [...document.querySelectorAll("#stageList li[data-row]")].map(
      (li) => ({
        input: li.querySelector("input"),
        orig: li.hasAttribute("data-orig") ? li.dataset.orig : null,
        name: li.querySelector("input").value.trim(),
      }),
    ),
    seen = new Set();
  for (let r of rows) {
    let key = r.name.toLowerCase();
    let problem = !r.name
      ? "Give this stage a name."
      : key === "not started" || key === "complete"
        ? `"${r.name}" is always the first or last stage.`
        : seen.has(key)
          ? "Another stage already has this name."
          : "";
    seen.add(key);
    r.input.setCustomValidity(problem);
    if (problem) {
      r.input.reportValidity();
      return false;
    }
  }
  return applyStages(editingStages?.qid, rows);
}
// What each old stage becomes: its row's new name, or for a deleted stage
// the next stage that's kept (else the one before it), so items at it move
// on rather than back, and never straight to Complete.
function stageMap(oldList, rows) {
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
// Rename an item's stage and split counts with `map`. Returns whether any
// of its models were at a deleted stage.
function remapStages(q, { map, deleted }) {
  let moved = false;
  if (Object.hasOwn(map, q.stage)) {
    if (deleted.has(q.stage)) {
      q.stageDone = 0; // its count was for the stage that's gone
      moved = true;
    }
    q.stage = map[q.stage];
  }
  if (isSplit(q)) {
    let split = {};
    for (let [k, c] of Object.entries(q.split)) {
      let n = Math.max(0, Math.floor(Number(c) || 0)),
        to = Object.hasOwn(map, k) ? map[k] : k;
      if (deleted.has(k) && n) moved = true;
      split[to] = (split[to] || 0) + n;
    }
    q.split = split;
    storeSplit(q, splitCounts(q)); // in step with the new order
  }
  return moved;
}
function applyStages(qid, rows) {
  let q = qid ? db.queue.find((x) => x.id === qid) : null;
  if (qid && !q) return true;
  let names = rows.map((r) => r.name),
    plan = stageMap(queueStages(q).slice(1, -1), rows),
    moved = 0;
  commitWithUndo(
    () => {
      if (q) q.stages = names;
      else db.queueStages = names;
      for (let t of q ? [q] : db.queue.filter((x) => !ownStages(x)))
        if (remapStages(t, plan)) moved++;
    },
    () =>
      (q ? `Saved the stages for "${q.name}"` : "Saved the default stages") +
      (moved ? `; ${moved} item(s) moved on from a deleted stage` : ""),
  );
  return true; // close the editor even if saving failed: commit said why
}
// An item goes back to the default stages. A stage the default doesn't
// have becomes the default stage in the same place.
function useDefaultStages(qid) {
  let q = db.queue.find((x) => x.id === qid);
  if (!q) return;
  let def = defaultStages(),
    map = {},
    deleted = new Set();
  queueStages(q)
    .slice(1, -1)
    .forEach((s, i) => {
      if (def.includes(s)) return (map[s] = s);
      map[s] = def[Math.min(i, def.length - 1)];
      deleted.add(s);
    });
  commitWithUndo(
    () => {
      delete q.stages;
      remapStages(q, { map, deleted });
    },
    () => `"${q.name}" uses the default stages again`,
  );
}
