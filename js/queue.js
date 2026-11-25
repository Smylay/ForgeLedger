// The painting queue: a board of model cards, one card per model, in
// phases from To do to Done; and a list of queue items (units) in priority
// order, which is also their order on the board. Adding models from the
// miniatures page, moving cards, the completion prompt, and keeping each
// miniature in step. The phase editor is stages.js.
"use strict";

// The phases between To do and Done as stored (`queueStages`), cleaned:
// trimmed, cut to MAX_PHASE_NAME, unique ignoring case, without the two end
// names, at most MAX_PHASES. Null if nothing is usable.
function cleanPhases(list) {
  if (!Array.isArray(list)) return null;
  let seen = new Set([FIRST_PHASE.toLowerCase(), LAST_PHASE.toLowerCase()]),
    out = [];
  for (let s of list) {
    let name = typeof s === "string" ? s.trim().slice(0, MAX_PHASE_NAME) : "";
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out.length ? out.slice(0, MAX_PHASES) : null;
}
// Every phase on the board, in order: To do, the edited (or default)
// phases, Done.
function boardPhases() {
  return [
    FIRST_PHASE,
    ...(cleanPhases(db.queueStages) || DEFAULT_PHASES),
    LAST_PHASE,
  ];
}

// A queue item's model cards, `{ id, phase }`; anything else in a stored
// list is ignored. fillIds() gives every card an id.
function cardsOf(q) {
  return Array.isArray(q?.cards)
    ? q.cards.filter((c) => isRecord(c) && typeof c.id === "string")
    : [];
}
// A card's photo id, or "": imported values may be anything.
function cardPhoto(c) {
  return typeof c?.photo === "string" ? c.photo : "";
}
// A model's name, as text: the unit's, numbered by the card's place in it
// when the unit has more than one model.
function modelName(q, c) {
  let cards = cardsOf(q),
    name = String(q?.name ?? "");
  return cards.length > 1
    ? `${name} #${cards.findIndex((x) => x.id === c.id) + 1}`
    : name;
}
// Where a card is, as an index into the board's phases. A phase the board
// doesn't have counts as To do.
function cardIndex(c, phases = boardPhases()) {
  return Math.max(0, phases.indexOf(c.phase));
}
// How many of a queue item's models are in each phase.
function cardCounts(q, phases = boardPhases()) {
  let counts = phases.map(() => 0);
  for (let c of cardsOf(q)) counts[cardIndex(c, phases)]++;
  return counts;
}
// "Building 4 · Done 2": the phases that have models.
function countsText(q) {
  let phases = boardPhases(),
    counts = cardCounts(q, phases);
  return (
    phases
      .map((p, i) => (counts[i] ? `${p} ${counts[i]}` : ""))
      .filter(Boolean)
      .join(" · ") || "No models on the board"
  );
}
// Whether every model of a queue item is Done. One with none isn't.
function entryDone(q) {
  let phases = boardPhases(),
    cards = cardsOf(q);
  return (
    cards.length > 0 &&
    cards.every((c) => cardIndex(c, phases) === phases.length - 1)
  );
}
// A queue item's work so far, in models: each card counts its phase's
// share of the board (To do 0, Done 1). Project progress adds it up. The
// steps are added as whole numbers and divided once, so ten models at 3/5
// make exactly 6, not 5.999….
function queueWork(q) {
  let phases = boardPhases(),
    last = phases.length - 1;
  return cardsOf(q).reduce((a, c) => a + cardIndex(c, phases), 0) / last;
}
function newCards(n, phase) {
  return Array.from({ length: Math.max(0, n) }, () => ({ id: id(), phase }));
}
// "Priming 6 · Done 4" for a list of cards (in board order).
function cardsText(cards) {
  return boardPhases()
    .map((p) => [p, cards.filter((c) => c.phase === p).length])
    .filter(([, n]) => n)
    .map(([p, n]) => `${p} ${n}`)
    .join(" · ");
}

// Phases are editable, so the ones that mean building and priming are
// found by name.
const BUILD_PHASE = /build|assembl/i;
const PRIME_PHASE = /prim/i;
// The last phase between To do and Done whose name matches, or -1.
function phaseNamed(re, phases) {
  return phases.findLastIndex(
    (s, j) => j > 0 && j < phases.length - 1 && re.test(s),
  );
}
// Where a miniature's unpainted models start on the board, from its
// status: Built after the building phase; Primed and In progress after
// priming (else building); otherwise To do. A card in a phase has finished
// the phases before it.
const START_AFTER = {
  Built: [BUILD_PHASE],
  Primed: [PRIME_PHASE, BUILD_PHASE],
  "In progress": [PRIME_PHASE, BUILD_PHASE],
};
function startPhase(m, phases = boardPhases()) {
  let last = phases.length - 1,
    after = Object.hasOwn(START_AFTER, m.status) ? START_AFTER[m.status] : [];
  for (let re of after) {
    let i = phaseNamed(re, phases);
    if (i > 0) return phases[Math.min(i + 1, last - 1)];
  }
  return phases[0];
}
// A miniature's model count, as the board sees it.
function miniSize(m) {
  return Math.min(MAX_MODELS, Math.floor(Number(m.quantity)) || 1);
}
// A miniature's cards on the board, in all its queue items.
function miniCards(m) {
  return db.queue.filter((q) => q.miniature === m.id).flatMap(cardsOf);
}
// How many of a miniature's models aren't on the board yet.
function modelsLeft(m) {
  return Math.max(0, miniSize(m) - miniCards(m).length);
}

// Add 1 and Add all on a miniature's row: put its models on the board, in
// its queue item (made at the end of the queue if it has none), with Undo.
// Painted models go to Done and the rest start where its status says
// (startPhase()). Add 1 adds an unpainted model while there is one. The
// cards agree with the miniature, so it isn't changed.
function addModels(mid, all) {
  let m = db.miniatures.find((x) => x.id === mid);
  if (!m) return;
  let left = modelsLeft(m);
  if (!left) return toast(`Every model of "${m.name}" is on the board`);
  let phases = boardPhases(),
    size = miniSize(m),
    painted =
      m.status === "Complete"
        ? size
        : Math.min(size, Math.max(0, Math.floor(Number(m.painted)) || 0)),
    doneOn = miniCards(m).filter(
      (c) => cardIndex(c, phases) === phases.length - 1,
    ).length,
    paintedLeft = Math.min(left, Math.max(0, painted - doneOn)),
    start = startPhase(m, phases),
    cards = all
      ? [
          ...newCards(paintedLeft, LAST_PHASE),
          ...newCards(left - paintedLeft, start),
        ]
      : newCards(1, left > paintedLeft ? start : LAST_PHASE);
  let q = db.queue.find((x) => x.miniature === m.id),
    made = !q;
  if (made)
    q = {
      id: id(),
      name: m.name,
      miniature: m.id,
      project: m.project || "",
      due: "",
      notes: "",
    };
  let saved = commitWithUndo(
    () => {
      if (made) db.queue.push(q);
      q.cards = [...cardsOf(q), ...cards];
      q.models = String(q.cards.length);
    },
    () =>
      `Added ${cards.length === 1 ? "1 model" : `${cards.length} models`} of "${m.name}" to the board: ${cardsText(cards)}`,
  );
  if (saved) renderNav();
}

// Keep a queue item's miniature in step with the board. Its cards in all
// its queue items count, and while every one of its models is on the board
// the board is in charge, both ways:
// - Built once every card is past the building phase, Primed once every
//   card is past priming, and In progress once any card has finished a
//   phase after priming; with the building or priming phase on the board,
//   Unbuilt before any of that. A Complete miniature stays Complete while
//   every card is Done (the completion prompt sets Complete).
// - Its painted count is its cards in Done.
// While some of its models aren't on the board, it only moves forward: a
// status is never lowered and the painted count never drops. Runs inside
// the change's commit; returns what changed, for the toast, or "".
function syncMiniature(q) {
  let m = q && db.miniatures.find((x) => x.id === q.miniature);
  if (!m) return "";
  let cards = miniCards(m);
  if (!cards.length) return "";
  let phases = boardPhases(),
    last = phases.length - 1,
    at = cards.map((c) => cardIndex(c, phases)),
    least = Math.min(...at),
    most = Math.max(...at),
    done = at.filter((i) => i === last).length,
    size = miniSize(m),
    full = cards.length >= size,
    b = phaseNamed(BUILD_PHASE, phases),
    p = phaseNamed(PRIME_PHASE, phases),
    order = column(defs.miniatures, "status").options,
    current = order.indexOf(m.status),
    reached = -1,
    status = "",
    painted = "";
  if (b > 0 && least > b) reached = 1; // Built
  if (p > 0 && least > p) reached = 2; // Primed
  if (p > 0 && most > p + 1) reached = 3; // In progress
  let want =
    full && (b > 0 || p > 0)
      ? m.status === "Complete" && done === cards.length
        ? current
        : Math.max(0, reached)
      : reached > current && m.status !== "Complete"
        ? reached
        : current;
  if (want !== current && want >= 0) m.status = status = order[want];
  let now = Math.max(0, Math.floor(Number(m.painted)) || 0),
    should = full ? Math.min(done, size) : Math.max(now, Math.min(done, size));
  if (should !== now) m.painted = painted = String(should);
  if (!status && !painted) return "";
  return `miniature "${m.name}" ${status ? `is now ${status}${painted ? `, with ${painted} painted` : ""}` : `now has ${painted} painted`}`;
}
// commitWithUndo for a change to queue item q that keeps its miniature in
// step (syncMiniature) in the same commit, so Undo reverts both. The toast
// says what changed on the miniature.
function commitQueue(q, change, message) {
  let note = "";
  return commitWithUndo(
    () => {
      change();
      note = syncMiniature(q);
    },
    () => message() + (note ? `; ${note}` : ""),
  );
}

// Move some of a queue item's cards to phase `to`, with Undo. The miniature
// follows. When the move finishes the item, every model Done, the
// completion prompt asks about its miniature.
function moveCards(qid, ids, to) {
  let q = db.queue.find((x) => x.id === qid);
  if (!q || !boardPhases().includes(to)) return false;
  let pick = new Set(ids),
    cards = cardsOf(q).filter((c) => pick.has(c.id) && c.phase !== to);
  if (!cards.length) return false;
  let wasDone = entryDone(q);
  let saved = commitQueue(
    q,
    () => {
      for (let c of cards) c.phase = to;
    },
    () =>
      `Moved ${cards.length === 1 ? "1 model" : `${cards.length} models`} of "${q.name}" to ${to}`,
  );
  if (saved && !wasDone && entryDone(q)) askComplete(q);
  return saved;
}
// ◀ and ▶: move a queue item's cards in phase `from` one phase back or on;
// one card if `cardId` is given, else all of them. Focus follows.
function stepCards(qid, from, dir, cardId) {
  let q = db.queue.find((x) => x.id === qid),
    phases = boardPhases(),
    i = phases.indexOf(from),
    to = phases[i + dir];
  if (!q || i < 0 || !to) return;
  let ids = cardId
    ? [cardId]
    : cardsOf(q)
        .filter((c) => phases[cardIndex(c, phases)] === from)
        .map((c) => c.id);
  // One model moved on stays in view: its unit opens in the new phase.
  if (cardId) openUnits.add(qid + "\n" + to);
  if (!moveCards(qid, ids, to)) return;
  let at = `[data-move="${CSS.escape(qid)}"][data-from="${CSS.escape(to)}"]`;
  refocus(
    cardId
      ? `${at}[data-mcard="${CSS.escape(cardId)}"][data-dir="${dir}"]`
      : `${at}:not([data-mcard])[data-dir="${dir}"]`,
    cardId
      ? `${at}[data-mcard="${CSS.escape(cardId)}"]`
      : `${at}:not([data-mcard])`,
    `[data-unit="${CSS.escape(qid)}"][data-from="${CSS.escape(to)}"]`,
  );
}
// Open or close a unit's model cards in one phase of the board.
function toggleUnit(qid, from) {
  let key = qid + "\n" + from;
  if (openUnits.has(key)) openUnits.delete(key);
  else openUnits.add(key);
  renderQueue();
  refocus(`[data-unit="${CSS.escape(qid)}"][data-from="${CSS.escape(from)}"]`);
}

// Saving the queue item form (`formSave`): its model count adds cards at
// To do, or takes cards off, the least advanced first. Blank keeps the
// cards; a new item starts with one card.
function saveQueueEntry(o, prev) {
  let phases = boardPhases(),
    cards = prev ? cardsOf(prev) : [],
    want =
      o.models === ""
        ? prev
          ? cards.length
          : 1
        : Math.min(MAX_MODELS, Math.max(0, Math.floor(Number(o.models)) || 0));
  if (want > cards.length)
    cards = [...cards, ...newCards(want - cards.length, FIRST_PHASE)];
  else if (want < cards.length) {
    let drop = new Set(
      cards
        .map((c, i) => [c, i])
        .sort(
          (a, b) =>
            cardIndex(a[0], phases) - cardIndex(b[0], phases) || b[1] - a[1],
        )
        .slice(0, cards.length - want)
        .map(([c]) => c.id),
    );
    cards = cards.filter((c) => !drop.has(c.id));
  }
  o.cards = cards;
  o.models = String(cards.length);
}
// Quick add on the queue page: a new item with one card at To do.
function quickQueueRecord() {
  return { cards: newCards(1, FIRST_PHASE), models: "1" };
}

// Which view the queue page shows: "board" or "list", kept per browser.
function queueMode() {
  try {
    return localStorage.getItem(QUEUE_VIEW_KEY) === "list" ? "list" : "board";
  } catch {
    return "board";
  }
}
function setQueueMode(mode) {
  try {
    localStorage.setItem(QUEUE_VIEW_KEY, mode === "list" ? "list" : "board");
  } catch {}
  renderQueue();
  refocus(`[data-qview="${mode === "list" ? "list" : "board"}"]`);
}
function renderQueue() {
  let mode = queueMode(),
    box = document.querySelector("#queueContent");
  for (let b of document.querySelectorAll("[data-qview]"))
    b.setAttribute("aria-pressed", String(b.dataset.qview === mode));
  document.querySelector("#queueHint").textContent =
    mode === "board"
      ? "Drag a model or a unit to another phase, or use ◀ and ▶. Open a unit to move its models one at a time. Add models from the miniatures page."
      : "Your units in priority order, which the board follows. Drag a unit by its handle, or use Top, ↑ and ↓, to change the order.";
  box.className = mode === "board" ? "board" : "queue";
  box.innerHTML = !db.queue.length
    ? '<div class="card empty">Nothing on the board yet. Use Add 1 or Add all on the miniatures page, or quick add a unit here.</div>'
    : mode === "board"
      ? boardHtml()
      : db.queue.map(queueItemHtml).join("");
  fillPhotos(box);
}

// The board: one column per phase. In each, the units with models there,
// in priority order, each a heading with its count and ◀ ▶ to move them
// all. A unit with more than one model opens to show its models, each with
// its own ◀ ▶. Cards are numbered by their place in the unit.
function boardHtml() {
  let phases = boardPhases();
  return phases
    .map((p, i) => {
      let units = db.queue
          .map((q) => ({
            q,
            cards: cardsOf(q).filter((c) => cardIndex(c, phases) === i),
          }))
          .filter((u) => u.cards.length),
        n = units.reduce((a, u) => a + u.cards.length, 0);
      return `<section class="phase" data-phase="${esc(p)}" aria-labelledby="phase-${i}"><h3 id="phase-${i}">${esc(p)} <span class="count">${n}</span></h3><div class="phasebody">${units.map((u) => unitHtml(u.q, u.cards, phases, i)).join("") || '<p class="muted none">No models</p>'}</div></section>`;
    })
    .join("");
}
function unitHtml(q, cards, phases, i) {
  let qid = esc(q.id),
    name = esc(q.name),
    from = esc(phases[i]),
    n = cards.length,
    open = n > 1 && openUnits.has(q.id + "\n" + phases[i]),
    number = new Map(cardsOf(q).map((c, k) => [c.id, k + 1]));
  let title =
    n > 1
      ? `<button class="unitname" data-unit="${qid}" data-from="${from}" aria-expanded="${open}">${name} <b>${n}</b></button>`
      : `<span class="unitname">${name}</span>`;
  // A single model here is the heading, so its photo button goes there.
  let head = `<div class="unithead" data-q="${qid}" data-from="${from}"><span class="grip" aria-hidden="true">⠿</span>${title}${n === 1 ? cardPhotoHtml(q, cards[0]) : ""}${arrowsHtml(q, phases, i, null, n > 1 ? `all ${n} of ${name}` : name)}</div>`;
  let list = open
    ? `<ul class="mcards">${cards
        .map(
          (c) =>
            `<li class="mcard" data-q="${qid}" data-mcard="${esc(c.id)}" data-from="${from}"><span class="grip" aria-hidden="true">⠿</span><span class="mname">#${number.get(c.id)}</span>${cardPhotoHtml(q, c)}${arrowsHtml(q, phases, i, c.id, `${name} #${number.get(c.id)}`)}</li>`,
        )
        .join("")}</ul>`
    : "";
  return `<div class="unit${phases[i] === LAST_PHASE ? " finished" : ""}">${head}${list}</div>`;
}
// ◀ and ▶ for a unit's models in phase i, or one model (`cid`).
function arrowsHtml(q, phases, i, cid, what) {
  let one = (dir, label, glyph) =>
    `<button class="arrow" data-move="${esc(q.id)}" data-from="${esc(phases[i])}" data-dir="${dir}"${cid ? ` data-mcard="${esc(cid)}"` : ""} aria-label="Move ${what} ${label} ${esc(phases[i + dir])}">${glyph}</button>`;
  return `<span class="arrows">${i > 0 ? one(-1, "back to", "◀") : ""}${i < phases.length - 1 ? one(1, "on to", "▶") : ""}</span>`;
}
// A model's photo button: its photo's thumbnail, or a camera to add one.
// Either opens the photo viewer for that model (photos.js).
const CAMERA_ICON =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path fill="currentColor" d="M9 4 7.2 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.2L15 4H9Zm3 4.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9Zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Z"/></svg>';
function cardPhotoHtml(q, c) {
  let pid = cardPhoto(c),
    label = `${pid ? "Photo of" : "Add a photo of"} ${esc(modelName(q, c))}`;
  return `<button class="mphoto" data-mphoto="${esc(c.id)}" data-q="${esc(q.id)}" aria-label="${label}">${pid ? `<img class="thumb" data-photo="${esc(pid)}" alt="" width="28" height="28">` : CAMERA_ICON}</button>`;
}

// The list: units in priority order, each with its model count, due date,
// where its models are, and reordering.
function queueProgressHtml(q, name) {
  let phases = boardPhases(),
    last = phases.length - 1,
    counts = cardCounts(q, phases),
    total = counts.reduce((a, b) => a + b, 0),
    past = (j) => counts.slice(j).reduce((a, b) => a + b, 0),
    now = total
      ? Math.round((10 * counts.reduce((a, c, j) => a + c * j, 0)) / total) / 10
      : 0;
  return `<div class="stages" role="progressbar" aria-label="Progress of ${name}" aria-valuemin="0" aria-valuemax="${last}" aria-valuenow="${now}" aria-valuetext="${esc(countsText(q))}">${phases
    .slice(1)
    .map(
      (s, k) =>
        `<span title="${esc(s)}"><i style="width:${total ? Math.round((100 * past(k + 1)) / total) : 0}%"></i></span>`,
    )
    .join("")}</div>`;
}
function queueItemHtml(q, i) {
  let done = entryDone(q),
    m = linked(column(defs.queue, "miniature"), q.miniature),
    low = done ? [] : lowRecipePaints(m),
    qid = esc(q.id),
    name = esc(q.name),
    n = cardsOf(q).length;
  let details = `${n} model${n === 1 ? "" : "s"}${q.due ? " · due " + esc(q.due) + " " + dueBadge(q.due, done) : ""}`;
  let lowLine = low.length
    ? `<div class="warnline">Low paint: ${low.map((p) => `${esc(p.name)} (${esc(p.stock)})`).join(", ")}</div>`
    : "";
  return `<div class="qitem" data-index="${i}"><span class="handle" aria-hidden="true" title="Drag to reorder">⠿</span><div class="qnum">${i + 1}</div><div class="qbody"><b>${name}</b><div class="muted">${details}</div>${queueProgressHtml(q, name)}<div class="qcounts">${esc(countsText(q))}</div>${lowLine}</div><div class="qactions"><span class="rowacts"><button data-top="${i}" aria-label="Move ${name} to top">Top</button><button data-up="${i}" aria-label="Move ${name} up">↑</button><button data-down="${i}" aria-label="Move ${name} down">↓</button><button data-edit="${qid}">Edit</button><button class="del" data-del="${qid}">Delete</button></span></div></div>`;
}
// Move queue item `from` to position `to` (counted without the item).
function moveQueueItem(from, to) {
  if (from === to || to < 0 || to >= db.queue.length) return false;
  return commit(() => db.queue.splice(to, 0, ...db.queue.splice(from, 1)));
}
// Top, ↑ and ↓ on item `i`. Focus stays on the same button of the item that
// moved.
function reorderQueue(dir, i) {
  let j = dir === "top" ? 0 : dir === "up" ? i - 1 : i + 1,
    moved = moveQueueItem(i, j);
  renderQueue();
  refocus(`[data-${dir}="${moved ? j : i}"]`);
}

// Every model of a linked queue item is Done: ask whether to mark its
// miniature complete and whether to take the item off the queue.
function askComplete(q) {
  let m = linked(column(defs.queue, "miniature"), q.miniature);
  if (!m) return;
  let done =
      m.status === "Complete" && Number(m.painted) >= Number(m.quantity || 1),
    mini = document.querySelector("#completeMini"),
    dialog = document.querySelector("#completeDialog");
  completing = q.id;
  document.querySelector("#completeText").textContent =
    `Every model of "${q.name}" is done. What else should change?`;
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
      if (drop) parts.push(`took "${q.name}" off the board`);
      let text = parts.join(" and ");
      return text[0].toUpperCase() + text.slice(1);
    },
  );
}
