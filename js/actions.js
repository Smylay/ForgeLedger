// User actions that change data or files: delete, wishlist, queue
// completion, backup export/import and CSV.
"use strict";

// Delete a record and offer Undo. Links to it from other records, such as
// miniatures in a deleted project, are cleared.
function remove(sec, recordId) {
  let item = db[sec].find((x) => x.id === recordId),
    unlinked = 0;
  if (!item) return;
  commitWithUndo(
    () => {
      db[sec] = db[sec].filter((x) => x.id !== recordId);
      for (let [k, d] of Object.entries(defs))
        for (let f of d.fields)
          if (f.to === sec)
            for (let r of db[k])
              if (r[f.key] === recordId) {
                r[f.key] = "";
                unlinked++;
              } else if (asList(r[f.key]).includes(recordId)) {
                r[f.key] = asList(r[f.key]).filter((x) => x !== recordId);
                unlinked++;
              }
    },
    () =>
      `Deleted "${item.name}"` +
      (unlinked ? ` and unlinked ${unlinked} item(s) from it` : ""),
  );
}

// Add restock entries for paints to the wishlist, linked to each paint.
function addToWishlist(paints) {
  if (!paints.length) return;
  commitWithUndo(
    () => {
      for (let p of paints)
        db.wishlist.push({
          id: id(),
          name: optionLabel(p),
          category: "Paint",
          priority: "High",
          paint: p.id,
          price: p.price || "",
          url: "",
          notes: "Restock",
        });
    },
    () =>
      paints.length === 1
        ? `Added "${optionLabel(paints[0])}" to the wishlist`
        : `Added ${paints.length} paints to the wishlist`,
  );
}

// A linked queue item was just marked Complete: ask whether to update its
// miniature and whether to take it off the queue.
function askComplete(q) {
  let m = linked(column(defs.queue, "miniature"), q.miniature);
  if (!m) return;
  let done =
      m.status === "Complete" && Number(m.painted) >= Number(m.quantity || 1),
    mini = document.querySelector("#completeMini"),
    dialog = document.querySelector("#completeDialog");
  completing = q.id;
  document.querySelector("#completeText").textContent =
    `"${q.name}" is complete. What else should change?`;
  document.querySelector("#completeMiniLabel").textContent = done
    ? `"${m.name}" is already marked complete`
    : `Mark "${m.name}" complete, with ${m.quantity || 1} of ${m.quantity || 1} painted`;
  mini.checked = !done;
  mini.disabled = done;
  document.querySelector("#completeRemove").checked = false;
  dialog.showModal();
}
function applyComplete() {
  let q = db.queue.find((x) => x.id === completing),
    m = q && db.miniatures.find((x) => x.id === q.miniature),
    mini = document.querySelector("#completeMini"),
    updateMini = m && mini.checked && !mini.disabled,
    drop = q && document.querySelector("#completeRemove").checked;
  if (!updateMini && !drop) return;
  commitWithUndo(
    () => {
      if (updateMini) {
        m.status = "Complete";
        m.painted = m.quantity || "1";
      }
      if (drop) db.queue = db.queue.filter((x) => x.id !== q.id);
    },
    () => {
      let parts = [];
      if (updateMini) parts.push(`marked "${m.name}" complete`);
      if (drop) parts.push(`removed "${q.name}" from the queue`);
      let text = parts.join(" and ");
      return text[0].toUpperCase() + text.slice(1);
    },
  );
}

function exportJSON() {
  download(JSON.stringify(db, null, 2), `forgeledger-backup-${today()}.json`);
  try {
    localStorage.setItem(BACKUP_KEY, String(Date.now()));
  } catch {}
  renderBackupState();
  if (section === "dashboard") renderDashboard();
}
function csv() {
  let arr = db[section];
  if (!arr.length) return toast("Nothing to export");
  let keys = [...new Set(arr.flatMap(Object.keys))],
    cell = (v) => {
      let s = String(v ?? "");
      // Stop spreadsheets running a cell as a formula; plain numbers are kept.
      if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    },
    text = [
      keys.map(cell).join(","),
      ...arr.map((o) => keys.map((k) => cell(o[k])).join(",")),
    ].join("\n");
  download(text, section + ".csv", "text/csv");
}
function importJSON(file) {
  let r = new FileReader();
  r.onload = () => {
    let data, problem;
    try {
      data = JSON.parse(r.result);
      problem = problemWith(data);
    } catch {
      problem = "it isn't valid JSON";
    }
    if (problem) return toast(`Can't import this file: ${problem}.`, 5000);
    if (hasUserData()) {
      if (
        !confirm(
          "Replace all current data with this backup?\n\nA copy of your current data will be downloaded first.",
        )
      )
        return;
      download(
        JSON.stringify(db, null, 2),
        `forgeledger-before-import-${today()}.json`,
      );
    }
    let next = fromBackup(data);
    if (!commit(() => (db = next))) return;
    go("dashboard");
    toast("Backup imported");
  };
  r.readAsText(file);
}

// One tap on a level button (paint stock, miniature status, …): save it,
// then redraw only that row so it keeps its place and keyboard focus
// stays on the chosen button.
function setScale(b) {
  let f = column(defs[section], b.dataset.scale),
    rec = db[section].find((x) => x.id === b.dataset.id),
    value = b.dataset.value;
  if (!rec || f?.type !== "scale" || !f.options.includes(value)) return;
  if (!commit(() => (rec[f.key] = value))) return;
  redrawRow(rec, `[data-scale="${f.key}"][aria-pressed="true"]`);
}

// Move queue item `from` to position `to` (counted without the item).
function moveQueueItem(from, to) {
  if (from === to || to < 0 || to >= db.queue.length) return false;
  return commit(() => db.queue.splice(to, 0, ...db.queue.splice(from, 1)));
}

// Move a queue item to its next stage, with Undo. Reaching Complete asks
// about its miniature, just as saving the form does.
function nextStage(qid) {
  let q = db.queue.find((x) => x.id === qid),
    stages = queueStages(),
    n = q ? stageIndex(q) : stages.length;
  if (n >= stages.length - 1) return;
  let to = stages[n + 1],
    sel = `[data-next="${CSS.escape(qid)}"]`;
  if (
    !commitWithUndo(
      () => {
        q.stage = to;
        q.stageDone = 0; // each stage counts its own models
      },
      () => `Moved "${q.name}" to ${to}`,
    )
  )
    return;
  refocus(sel, `[data-edit="${CSS.escape(qid)}"]`);
  if (to === "Complete") askComplete(q);
}

// +1: one more model done in a queue item's current stage, with Undo.
// From "Not started" it starts the first stage. When every model is done
// the item moves on to the next stage, whose count starts at 0; reaching
// Complete asks about the linked miniature.
function plusOneDone(qid) {
  let q = db.queue.find((x) => x.id === qid);
  if (!q) return;
  let stages = queueStages(),
    n = stageIndex(q);
  if (n === stages.length - 1) return;
  let stage = stages[Math.max(n, 1)],
    total = queueTotal(q),
    count = (n === 0 ? 0 : stageDoneCount(q)) + 1,
    advance = count >= total,
    to = advance ? stages[Math.max(n, 1) + 1] : stage;
  let saved = commitWithUndo(
    () => {
      q.stage = to;
      q.stageDone = advance ? 0 : count;
    },
    () =>
      advance
        ? `"${q.name}": ${stage} done, moved to ${to}`
        : `"${q.name}": ${stage} ${count} of ${total} done`,
  );
  if (!saved) return;
  refocus(
    `[data-plus="${CSS.escape(qid)}"]`,
    `[data-next="${CSS.escape(qid)}"]`,
    `[data-edit="${CSS.escape(qid)}"]`,
  );
  if (advance && to === "Complete") askComplete(q);
}

// One tap on - or +: change a count by one within its limits, then redraw
// the row (its other counts may have new limits) and keep focus on the
// button, or on the other one if this one is now at its limit.
function stepCount(b) {
  let d = defs[section],
    f = column(d, b.dataset.key),
    rec = db[section].find((x) => x.id === b.dataset.id),
    delta = Number(b.dataset.step);
  if (!rec || !f?.stepper || Math.abs(delta) !== 1) return;
  let blank = rec[f.key] === "" || rec[f.key] == null,
    next = (Number(rec[f.key]) || 0) + delta,
    { lo, hi } = stepRange(d, f, rec);
  if ((blank && delta < 0) || next < lo || (hi !== null && next > hi)) return;
  if (!commit(() => (rec[f.key] = String(next)))) return;
  let btn = (step) => `[data-key="${f.key}"][data-step="${step}"]`;
  redrawRow(rec, btn(delta), btn(-delta));
}

// Quick add: a new record in the current section with just a name, with
// Undo. Search and filter are cleared so the new record is visible, and
// the box is emptied (keeping focus) for the next one.
// The skill picker: a technique from the library, or "Other" with a name.
function addSkill(form) {
  let { pick, name: input } = form.elements,
    name = (pick.value === "other" ? input.value : pick.value).trim();
  if (!name) return;
  if (db.skills.some((s) => sameName(s.name, name)))
    return toast(`"${name}" is already in your skills`);
  let added = commitWithUndo(
    () =>
      db.skills.push({
        id: id(),
        name,
        level: 0,
        notes: "",
        goal: "",
        changed: today(),
      }),
    () => `Added "${name}"`,
  );
  if (!added) return;
  input.value = "";
  input.hidden = true;
  input.required = false;
  pick.value = "";
  pick.focus();
}
function quickAdd(form) {
  let input = form.elements.name,
    name = input.value.trim();
  if (!name || !defs[section]) return;
  document.querySelector("#search").value = "";
  document.querySelector("#filter").value = "";
  let added = commitWithUndo(
    () => db[section].push({ id: id(), name }),
    () => `Added "${name}"`,
  );
  if (!added) return;
  input.value = "";
  input.focus();
}
