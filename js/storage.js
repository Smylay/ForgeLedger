// Loading, checking, repairing, migrating and saving data, and undo.
"use strict";

function isRecord(x) {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}
// Parse saved or imported data. Keys named toString or valueOf are dropped
// wherever they are: JSON can't hold functions, so such a key would make
// String() or Number() throw on the object holding it, stopping a page from
// drawing. No field has either name.
function parseData(text) {
  return JSON.parse(text, (k, v) =>
    k === "toString" || k === "valueOf" ? undefined : v,
  );
}

// Say why `data` can't be used as ForgeLedger data, or return "" if it can.
// Imports with a problem are rejected; saved data with one is repaired.
function problemWith(data) {
  if (!isRecord(data)) return "it isn't a ForgeLedger backup";
  if (!COLLECTIONS.some((k) => k in data))
    return "it has no ForgeLedger data in it";
  if (Number(data.schemaVersion) > SCHEMA_VERSION)
    return `it was made by a newer version of ForgeLedger${typeof data.appVersion === "string" ? ` (${data.appVersion.slice(0, 20)})` : ""}`;
  let bad = COLLECTIONS.find(
    (k) => k in data && !(Array.isArray(data[k]) && data[k].every(isRecord)),
  );
  return bad ? `the "${bad}" section is damaged` : "";
}

// Keep every usable collection and record; drop what can't be used.
function repair(data) {
  for (let k of COLLECTIONS) {
    if (Array.isArray(data[k])) data[k] = data[k].filter(isRecord);
    else delete data[k];
  }
  return data;
}

// Give every record a unique string id; hand-made backups may lack one.
// Queue items' model cards get them too, unique across the board.
function fillIds(data) {
  let fill = (list, seen) => {
    for (let r of list) {
      if (!isRecord(r)) continue;
      if (typeof r.id === "number") r.id = String(r.id);
      if (typeof r.id !== "string" || !r.id || seen.has(r.id)) r.id = id();
      seen.add(r.id);
    }
  };
  for (let k of COLLECTIONS)
    if (Array.isArray(data[k])) fill(data[k], new Set());
  let cards = new Set();
  for (let q of Array.isArray(data.queue) ? data.queue : [])
    if (isRecord(q) && Array.isArray(q.cards)) fill(q.cards, cards);
  return data;
}

// Bring data from an older schema up to SCHEMA_VERSION. When stored data
// changes shape, add a step here rather than renaming fields in place.
function migrate(data) {
  let from = Number(data.schemaVersion) || 0;
  // 0 (no schemaVersion) -> 1: the version field was added, nothing else.
  // 1 -> 2: paint stock is a level (Full ... Empty) instead of Remaining %.
  // The old `remaining` value stays in the record but is no longer read.
  if (from < 2)
    for (let p of data.paints || [])
      if (p.stock === undefined) p.stock = stockFromPercent(p.remaining);
  // 2 -> 3: the "Shade" paint type is now "Shade/Wash".
  if (from < 3)
    for (let p of data.paints || [])
      if (p.type === "Shade") p.type = "Shade/Wash";
  // 3 -> 4: queue stages can be edited (`queueStages`, and a queue item's
  // own `stages`). Both are new and optional, so nothing is converted; the
  // version stops older copies of the app mangling custom stage names.
  // 4 -> 5: miniatures can have `photos`, and backups carry the images in a
  // top-level `photos`. Nothing is converted; the version stops older
  // copies from loading a backup's images into localStorage.
  // 5 -> 6: the queue is a board of model cards. Each item's stage, count
  // and split become one card per model, in the matching phase.
  if (from < 6) cardsFromStages(data);
  data.schemaVersion = SCHEMA_VERSION;
  return data;
}

// Schema 5 queue items to model cards (schema 6). A 5 item had a list of
// stages (its own, else the default), a stage and a count done in it, or
// a split: a count per stage. Each model becomes a card in the board phase
// its stage matches: by name, then old default names (Basecoating is now
// Painting, Basing is Detailing), then by position. Not started is To do
// and Complete is Done. The old fields stay in the item, unread.
const V5_STAGES = ["Building", "Priming", "Basecoating", "Detailing", "Basing"];
const V5_RENAMED = { basecoating: "Painting", basing: "Detailing" };
function cardsFromStages(data) {
  let clean = (list) => {
      if (!Array.isArray(list)) return null;
      let seen = new Set(["not started", "complete"]),
        out = [];
      for (let s of list) {
        let name = typeof s === "string" ? s.trim().slice(0, 40) : "";
        if (!name || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        out.push(name);
      }
      return out.length ? out.slice(0, 20) : null;
    },
    oldDefault = clean(data.queueStages) || V5_STAGES,
    unchanged = oldDefault.join("\n") === V5_STAGES.join("\n");
  // An unchanged default becomes the new default; an edited one is kept.
  if (unchanged) delete data.queueStages;
  let board = [
      FIRST_PHASE,
      ...(cleanPhases(data.queueStages) || DEFAULT_PHASES),
      LAST_PHASE,
    ],
    middle = board.slice(1, -1),
    byName = new Map(middle.map((p) => [p.toLowerCase(), p])),
    minis = new Map(
      (Array.isArray(data.miniatures) ? data.miniatures : [])
        .filter(isRecord)
        .map((m) => [m.id, m]),
    );
  let phaseFor = (name, i, n) => {
    if (i === 0) return FIRST_PHASE;
    if (i === n - 1) return LAST_PHASE;
    let key = name.toLowerCase(),
      renamed = V5_RENAMED[key];
    if (byName.has(key)) return byName.get(key);
    if (renamed && byName.has(renamed.toLowerCase()))
      return byName.get(renamed.toLowerCase());
    // By position: the same share of the way through the list.
    let at = Math.round(((i - 1) / Math.max(1, n - 3)) * (middle.length - 1));
    return middle[Math.min(middle.length - 1, Math.max(0, at))];
  };
  for (let q of Array.isArray(data.queue) ? data.queue : []) {
    if (!isRecord(q) || Array.isArray(q.cards)) continue;
    let list = ["Not started", ...(clean(q.stages) || oldDefault), "Complete"],
      m = minis.get(q.miniature),
      total = Math.min(
        MAX_MODELS,
        Math.floor(Number(q.models)) || Math.floor(Number(m?.quantity)) || 1,
      ),
      counts = list.map(() => 0);
    if (isRecord(q.split)) {
      list.forEach((s, i) => {
        if (Object.hasOwn(q.split, s))
          counts[i] = Math.max(0, Math.floor(Number(q.split[s]) || 0));
      });
      let extra = counts.reduce((a, b) => a + b, 0) - total;
      if (extra < 0) counts[0] -= extra;
      for (let i = 0; extra > 0; i++) {
        let cut = Math.min(counts[i], extra);
        counts[i] -= cut;
        extra -= cut;
      }
    } else {
      let n = Math.max(0, list.indexOf(q.stage || "Not started")),
        last = list.length - 1,
        done =
          n === 0 || n === last
            ? 0
            : Math.min(
                total,
                Math.max(0, Math.floor(Number(q.stageDone) || 0)),
              );
      counts[n] = total - done;
      if (done) counts[n + 1] += done;
    }
    q.cards = [];
    counts.forEach((c, i) => {
      let phase = phaseFor(list[i], i, list.length);
      for (let k = 0; k < c; k++) q.cards.push({ id: id(), phase });
    });
    q.models = String(q.cards.length);
  }
}

function fromBackup(data) {
  return Object.assign(structuredClone(defaults), migrate(fillIds(data)));
}

// Read saved data. If it needs repair, the original is kept under a
// recovery key first, so nothing is ever silently overwritten.
function load() {
  let raw, data;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    memoryOnly = true;
    return structuredClone(defaults);
  }
  if (raw === null) return structuredClone(defaults);
  try {
    data = parseData(raw);
  } catch {
    data = undefined;
  }
  let problem = data === undefined ? "it isn't valid JSON" : problemWith(data);
  if (problem) {
    recovered = { raw, problem };
    try {
      localStorage.setItem(RECOVERY_PREFIX + new Date().toISOString(), raw);
    } catch {}
    data = isRecord(data) ? repair(data) : {};
  }
  // Older saved data is upgraded in memory here; app.js saves it once so
  // storage holds the current schema too. Repaired data isn't saved until
  // the user changes something, so the damaged original is never replaced
  // before they can download it.
  upgraded = !problem && (Number(data.schemaVersion) || 0) < SCHEMA_VERSION;
  return fromBackup(data);
}

function setSaveState(text) {
  document.querySelector("#saveState").textContent = text;
}

function save() {
  if (memoryOnly) {
    setSaveState("Not saved: storage is blocked");
    return true;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(db));
  } catch {
    setSaveState("Not saved");
    toast("Couldn't save: browser storage is full or blocked.", 6000);
    return false;
  }
  setSaveState(
    "Saved " +
      new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
  );
  scheduleAutoSave(); // autosave.js: writes the file too, if it's on
  return true;
}

// Apply a change to db and save it. If saving fails, undo the change so
// what's on screen always matches what's stored. Any change ends the
// chance to undo the last delete, so Undo can never revert later work.
function commit(change) {
  let before = structuredClone(db),
    was = unlockedRewards();
  undo = null;
  change();
  if (save()) {
    noteRewards(was);
    return true;
  }
  db = before;
  return false;
}
// Make a change that the message it shows can undo. `message` is a
// function so it can describe what the change did.
function commitWithUndo(change, message) {
  let before = structuredClone(db);
  if (!commit(change)) return false;
  undo = before;
  renderNav();
  render();
  toast(message(), 8000, "Undo");
  return true;
}

// True once anything differs from a fresh install, ignoring ids.
function hasUserData() {
  let plain = (d) =>
    JSON.stringify([
      ...COLLECTIONS.map((k) =>
        k === "skills" ? d.skills.map(({ id: _, ...s }) => s) : d[k],
      ),
      d.queueStages ?? null,
    ]);
  return plain(db) !== plain(defaults);
}

function backupAgeDays() {
  let t = 0;
  try {
    t = Number(localStorage.getItem(BACKUP_KEY)) || 0;
  } catch {}
  return t ? Math.floor((Date.now() - t) / 864e5) : null;
}

function backupText(days) {
  if (days === null) return "never";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
