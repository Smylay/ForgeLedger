// The painting queue: each item's stages and split counts, drawing an
// item, and its actions: Next stage and Back, +1 and -1, Split by stage,
// Move 1 and Back 1, reordering and the completion prompt. The stage editor
// is stages.js.
"use strict";

// The default middle stages: as edited, else as shipped.
function defaultStages() {
  return cleanStages(db.queueStages) || DEFAULT_STAGES;
}
// A stored list of middle stages (the default `db.queueStages`, or an
// item's own `stages`) as usable names: trimmed, non-empty, unique ignoring
// case, and not "Not started" or "Complete". Null if nothing is usable.
function cleanStages(list) {
  if (!Array.isArray(list)) return null;
  let seen = new Set(["not started", "complete"]),
    out = [];
  for (let s of list) {
    let name = typeof s === "string" ? s.trim().slice(0, MAX_STAGE_NAME) : "";
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out.length ? out.slice(0, MAX_STAGES) : null;
}
// Whether a queue item has stages of its own instead of the default.
function ownStages(q) {
  return !!cleanStages(q?.stages);
}
// A queue item's stages in order, Not started to Complete: its own, else
// the default. With no item, the default.
function queueStages(q) {
  return [
    "Not started",
    ...(cleanStages(q?.stages) || defaultStages()),
    "Complete",
  ];
}
// How far through the stages a queue item is, from 0 (Not started) to the
// last stage (Complete). Blank or unknown stages count as Not started.
function stageIndex(q) {
  return Math.max(0, queueStages(q).indexOf(q.stage || "Not started"));
}
// How many models a queue item covers: its own model count, else its
// miniature's, else 1.
function queueTotal(q) {
  let m = linked(column(defs.queue, "miniature"), q.miniature);
  return Number(q.models) || Number(m?.quantity) || 1;
}
// Models done in a queue item's current stage (`stageDone`), kept within
// 0 to queueTotal() whatever is stored.
function stageDoneCount(q) {
  let n = Math.floor(Number(q.stageDone) || 0);
  return Math.min(queueTotal(q), Math.max(0, n));
}

// Split queue items: models at different stages. `split` holds a count per
// stage name, e.g. { Priming: 2, Basecoating: 3 }; no `split` means every
// model is at `stage`. While split, `stage` and `stageDone` are kept in
// step (the least advanced stage, and how many models are past it), so
// code that only reads `stage` still works.
function isSplit(q) {
  return isRecord(q.split);
}
// One count per stage, in stage order, adding up to queueTotal(). Stored
// counts may be junk or out of date (the model count changed): extra
// models start at Not started, and missing ones come off the least
// advanced stages first.
function splitCounts(q) {
  let stages = queueStages(q),
    total = queueTotal(q),
    counts = stages.map((s) =>
      Object.hasOwn(q.split, s)
        ? Math.max(0, Math.floor(Number(q.split[s]) || 0))
        : 0,
    ),
    extra = counts.reduce((a, b) => a + b, 0) - total;
  if (extra < 0) counts[0] -= extra;
  for (let i = 0; extra > 0; i++) {
    let cut = Math.min(counts[i], extra);
    counts[i] -= cut;
    extra -= cut;
  }
  return counts;
}
// Counts for an item that isn't split yet: models done in the current
// stage are already at the next one.
function splitFrom(q) {
  let stages = queueStages(q),
    n = stageIndex(q),
    total = queueTotal(q),
    done = n === 0 || n === stages.length - 1 ? 0 : stageDoneCount(q),
    counts = stages.map(() => 0);
  counts[n] = total - done;
  if (done) counts[n + 1] += done;
  return counts;
}
// Save counts on an item, keeping `stage` and `stageDone` in step.
function storeSplit(q, counts) {
  let stages = queueStages(q),
    n = counts.findIndex((c) => c > 0);
  if (n < 0) n = 0;
  q.split = Object.fromEntries(
    stages.map((s, i) => [s, counts[i]]).filter(([, c]) => c > 0),
  );
  q.stage = stages[n];
  q.stageDone =
    n === stages.length - 1
      ? 0
      : counts.slice(n + 1).reduce((a, b) => a + b, 0);
}
// "Priming 2 · Basecoating 3", the stages that have models.
function splitText(q) {
  let counts = splitCounts(q);
  return queueStages(q)
    .map((s, i) => (counts[i] ? `${s} ${counts[i]}` : ""))
    .filter(Boolean)
    .join(" · ");
}

// A queue item's work so far, in models: each model counts its stage's
// share of the item's stages (Not started 0, Complete 1). Models done in
// the current stage count at the next one.
function queueWork(q) {
  let last = queueStages(q).length - 1;
  if (isSplit(q))
    return splitCounts(q).reduce((a, c, i) => a + (c * i) / last, 0);
  let n = stageIndex(q),
    total = queueTotal(q),
    done = n === 0 || n === last ? 0 : stageDoneCount(q);
  return ((total - done) * n + done * (n + 1)) / last;
}

// Where a queue item stands: its stages, which one it's at, and its
// counts. Drawing an item, below, reads only this.
function queueState(q) {
  let stages = queueStages(q),
    last = stages.length - 1,
    split = isSplit(q),
    counts = split ? splitCounts(q) : null,
    // A split item is as far on as its least advanced model.
    n = split
      ? Math.max(
          0,
          counts.findIndex((c) => c > 0),
        )
      : stageIndex(q),
    done = n === last,
    total = queueTotal(q),
    count = stageDoneCount(q),
    working = n > 0 && !done; // in a stage that +1 counts towards
  let status = split
    ? splitText(q)
    : working
      ? `${stages[n]}: ${count} of ${total} done`
      : stages[n];
  return {
    stages,
    last,
    split,
    counts,
    n,
    done,
    total,
    count,
    working,
    status,
  };
}
// The progress bar: one step per stage after "Not started". Earlier stages
// are full, the current one filled as far as its count, later ones empty.
// Split, each step fills with the share of models past it (or, for
// Complete, at it), and the bar's value is the models' average step.
function queueProgressHtml(v, name) {
  let { stages, last, split, counts, n, done, total, count, status } = v;
  let past = (j) =>
    j === last ? counts[last] : counts.slice(j + 1).reduce((a, b) => a + b, 0);
  let fill = (k) =>
    split
      ? Math.round((100 * past(k + 1)) / total)
      : done || k < n - 1
        ? 100
        : k === n - 1
          ? Math.round((100 * count) / total)
          : 0;
  let now = split
    ? Math.round((10 * counts.reduce((a, c, j) => a + c * j, 0)) / total) / 10
    : n;
  return `<div class="stages" role="progressbar" aria-label="Progress of ${name}" aria-valuemin="0" aria-valuemax="${last}" aria-valuenow="${now}" aria-valuetext="${esc(status)}${split ? "" : `, step ${n} of ${last}`}">${stages
    .slice(1)
    .map(
      (s, k) =>
        `<span title="${esc(s)}"><i style="width:${fill(k)}%"></i></span>`,
    )
    .join("")}</div>`;
}
// Split: each stage that has models, with buttons to move one on, and one
// back. Shown when every model is at Complete too, so one can go back.
function queueSplitHtml(v, qid, name) {
  let { stages, last, split, counts } = v;
  if (!split) return "";
  let on = (s, j) =>
    `<button class="btn" data-adv="${qid}" data-from="${j}" aria-label="Move 1 to ${esc(stages[j + 1])} from ${esc(s)}, ${name}">Move 1 to ${esc(stages[j + 1])}</button>`;
  let back = (s, j) =>
    `<button class="btn" data-moveback="${qid}" data-from="${j}" aria-label="Back 1 to ${esc(stages[j - 1])} from ${esc(s)}, ${name}">Back 1</button>`;
  return `<div class="splitrow" role="group" aria-label="Models by stage, ${name}">${stages
    .map((s, j) =>
      counts[j]
        ? `<span class="splitstage">${esc(s)} <b>${counts[j]}</b>${j < last ? on(s, j) : ""}${j > 0 ? back(s, j) : ""}</span>`
        : "",
    )
    .join("")}</div>`;
}
// The buttons under the progress bar: Next stage, +1, -1 and Back (not
// while split), and the Split by stage toggle.
function queueStepsHtml(v, qid, name) {
  let { stages, split, n, done, total } = v;
  let next =
    done || split
      ? ""
      : `<button class="btn" data-next="${qid}" aria-label="Next: ${esc(stages[n + 1])} for ${name}">Next: ${esc(stages[n + 1])}</button>`;
  // +1 counts in the current stage; from "Not started" it starts the first.
  let plus =
    done || split
      ? ""
      : `<button class="btn" data-plus="${qid}" aria-label="+1 done in ${esc(stages[Math.max(n, 1)])} for ${name}">+1 done</button>`;
  // Going back, for an item taken too far: -1 takes back a +1, and Back
  // returns to the previous stage. Complete items have them too.
  let back =
    split || n === 0
      ? ""
      : `<button class="btn" data-minus="${qid}" aria-label="−1 done for ${name}">−1 done</button><button class="btn" data-back="${qid}" aria-label="Back: ${esc(stages[n - 1])} for ${name}">Back: ${esc(stages[n - 1])}</button>`;
  // The toggle: off, every model is at one stage, as before.
  let splitBtn =
    done || total < 2
      ? ""
      : `<button class="btn" data-split="${qid}" aria-pressed="${split}" aria-label="Split by stage: ${name}">Split by stage</button>`;
  let all = next + plus + back + splitBtn;
  return all ? `<div class="qsteps">${all}</div>` : "";
}
// The row buttons, on the right: reordering, Stages, Edit and Delete.
function queueRowActsHtml(i, qid, name) {
  return `<span class="rowacts"><button data-top="${i}" aria-label="Move ${name} to top">Top</button><button data-up="${i}" aria-label="Move ${name} up">↑</button><button data-down="${i}" aria-label="Move ${name} down">↓</button><button data-stages="${qid}" aria-label="Stages for ${name}">Stages</button><button data-edit="${qid}">Edit</button><button class="del" data-del="${qid}">Delete</button></span>`;
}
// One queue item: drag handle, position, details with a stage progress
// bar and the buttons that move it on or back, then its row buttons.
// Buttons carry the item id (next, plus) or its position (top, up, down),
// which the click listener in app.js reads.
function queueItemHtml(q, i) {
  let v = queueState(q),
    { stages, split, n, done, total, working, status } = v,
    m = linked(column(defs.queue, "miniature"), q.miniature),
    low = done ? [] : lowRecipePaints(m),
    qid = esc(q.id),
    name = esc(q.name);
  let details = `${split && !done ? "Split by stage" : esc(stages[n])} · ${total} model(s)${ownStages(q) ? " · own stages" : ""}${q.due ? " · due " + esc(q.due) + " " + dueBadge(q.due, done) : ""}`;
  let countLine =
    working && !split
      ? `<div class="muted stagecount">${esc(status)}</div>`
      : "";
  let lowLine = low.length
    ? `<div class="warnline">Low paint: ${low.map((p) => `${esc(p.name)} (${esc(p.stock)})`).join(", ")}</div>`
    : "";
  return `<div class="qitem" data-index="${i}"><span class="handle" aria-hidden="true" title="Drag to reorder">⠿</span><div class="qnum">${i + 1}</div><div class="qbody"><b>${name}</b><div class="muted">${details}</div>${queueProgressHtml(v, name)}${countLine}${queueStepsHtml(v, qid, name)}${queueSplitHtml(v, qid, name)}${lowLine}</div><div class="qactions">${queueRowActsHtml(i, qid, name)}</div></div>`;
}
function renderQueue() {
  document.querySelector("#queueContent").innerHTML = db.queue.length
    ? db.queue.map(queueItemHtml).join("")
    : '<div class="card empty">Painting queue is empty.</div>';
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
    stages = queueStages(q),
    n = q && !isSplit(q) ? stageIndex(q) : stages.length;
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

// Back: the previous stage, with Undo, its count starting at 0. It undoes
// Next, for an item taken too far.
function prevStage(qid) {
  let q = db.queue.find((x) => x.id === qid);
  if (!q || isSplit(q)) return;
  let stages = queueStages(q),
    n = stageIndex(q);
  if (n === 0) return;
  let to = stages[n - 1];
  let saved = commitWithUndo(
    () => {
      q.stage = to;
      q.stageDone = 0;
    },
    () => `Moved "${q.name}" back to ${to}`,
  );
  if (!saved) return;
  let id = CSS.escape(qid);
  refocus(`[data-back="${id}"]`, `[data-next="${id}"]`, `[data-edit="${id}"]`);
}

// +1: one more model done in a queue item's current stage, with Undo.
// From "Not started" it starts the first stage. When every model is done
// the item moves on to the next stage, whose count starts at 0; reaching
// Complete asks about the linked miniature.
function plusOneDone(qid) {
  let q = db.queue.find((x) => x.id === qid);
  if (!q || isSplit(q)) return;
  let stages = queueStages(q),
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

// -1: takes back one +1, with Undo. With models done in the current stage,
// one fewer is done; otherwise the item goes back to the previous stage,
// with all but one model done there (from the first stage, back to Not
// started). So it undoes +1 exactly, even one that moved the item on.
function minusOneDone(qid) {
  let q = db.queue.find((x) => x.id === qid);
  if (!q || isSplit(q)) return;
  let stages = queueStages(q),
    n = stageIndex(q),
    total = queueTotal(q),
    count = n < stages.length - 1 ? stageDoneCount(q) : 0;
  if (n === 0) return;
  let to = count ? n : n - 1,
    left = count ? count - 1 : to === 0 ? 0 : total - 1;
  let saved = commitWithUndo(
    () => {
      q.stage = stages[to];
      q.stageDone = left;
    },
    () =>
      to === 0
        ? `"${q.name}": back to Not started`
        : `"${q.name}": ${stages[to]} ${left} of ${total} done`,
  );
  if (!saved) return;
  let id = CSS.escape(qid);
  refocus(`[data-minus="${id}"]`, `[data-plus="${id}"]`, `[data-edit="${id}"]`);
}

// Split by stage: on, the models done in the current stage are counted at
// the next one; off, every model joins the least advanced stage, and the
// models past it count as done there. Both with Undo.
function toggleSplit(qid) {
  let q = db.queue.find((x) => x.id === qid);
  if (!q) return;
  let on = !isSplit(q);
  let saved = commitWithUndo(
    () => {
      if (on) storeSplit(q, splitFrom(q));
      else {
        storeSplit(q, splitCounts(q)); // bring stage and stageDone up to date
        delete q.split;
      }
    },
    () =>
      on
        ? `Split "${q.name}" by stage`
        : `Joined "${q.name}": ${q.stage}${q.stageDone ? `, ${q.stageDone} of ${queueTotal(q)} done` : ""}`,
  );
  if (saved) refocus(`[data-split="${CSS.escape(qid)}"]`);
}
// Split: move one model from stage `from` to the next, with Undo. The last
// model reaching Complete asks about the linked miniature.
function moveOneOn(qid, from) {
  let q = db.queue.find((x) => x.id === qid);
  if (!q || !isSplit(q)) return;
  let stages = queueStages(q),
    counts = splitCounts(q);
  if (!(from >= 0 && from < stages.length - 1 && counts[from] > 0)) return;
  counts[from]--;
  counts[from + 1]++;
  let saved = commitWithUndo(
    () => storeSplit(q, counts),
    () => `"${q.name}": 1 moved to ${stages[from + 1]} (${splitText(q)})`,
  );
  if (!saved) return;
  let id = CSS.escape(qid);
  // Stay on this stage's button while it has models, else follow the model.
  refocus(
    `[data-adv="${id}"][data-from="${from}"]`,
    `[data-adv="${id}"][data-from="${from + 1}"]`,
    `[data-split="${id}"]`,
    `[data-edit="${id}"]`,
  );
  if (q.stage === "Complete") askComplete(q);
}

// Split: move one model from stage `from` back to the one before, with
// Undo.
function moveOneBack(qid, from) {
  let q = db.queue.find((x) => x.id === qid);
  if (!q || !isSplit(q)) return;
  let stages = queueStages(q),
    counts = splitCounts(q);
  if (!(from > 0 && from < stages.length && counts[from] > 0)) return;
  counts[from]--;
  counts[from - 1]++;
  let saved = commitWithUndo(
    () => storeSplit(q, counts),
    () => `"${q.name}": 1 back to ${stages[from - 1]} (${splitText(q)})`,
  );
  if (!saved) return;
  let id = CSS.escape(qid);
  // Stay on this stage's button while it has models, else follow the model.
  refocus(
    `[data-moveback="${id}"][data-from="${from}"]`,
    `[data-moveback="${id}"][data-from="${from - 1}"]`,
    `[data-adv="${id}"][data-from="${from - 1}"]`,
    `[data-split="${id}"]`,
    `[data-edit="${id}"]`,
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

// A miniature's Queue button: add it to the end of the queue, linked to it.
function queueMiniature(mid) {
  let m = db.miniatures.find((x) => x.id === mid);
  if (!m) return;
  let queued = commit(() =>
    db.queue.push({
      id: id(),
      name: m.name,
      miniature: m.id,
      project: m.project || "",
      stage: "Not started",
      models: m.quantity || 1,
      due: "",
      notes: "",
    }),
  );
  renderNav();
  if (queued) toast("Added to queue");
}
// Top, ↑ and ↓ on item `i`. Focus stays on the same button of the item that
// moved.
function reorderQueue(dir, i) {
  let j = dir === "top" ? 0 : dir === "up" ? i - 1 : i + 1,
    moved = moveQueueItem(i, j);
  renderQueue();
  refocus(`[data-${dir}="${moved ? j : i}"]`);
}
