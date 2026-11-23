// Loading, checking, repairing, migrating and saving data, and undo.
"use strict";

function isRecord(x) {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

// Say why `data` can't be used as ForgeLedger data, or return "" if it can.
// Imports with a problem are rejected; saved data with one is repaired.
function problemWith(data) {
  if (!isRecord(data)) return "it isn't a ForgeLedger backup";
  if (!COLLECTIONS.some((k) => k in data))
    return "it has no ForgeLedger data in it";
  if (Number(data.schemaVersion) > SCHEMA_VERSION)
    return "it was made by a newer version of ForgeLedger";
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
function fillIds(data) {
  for (let k of COLLECTIONS) {
    let seen = new Set();
    for (let r of data[k] || []) {
      if (typeof r.id === "number") r.id = String(r.id);
      if (typeof r.id !== "string" || !r.id || seen.has(r.id)) r.id = id();
      seen.add(r.id);
    }
  }
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
  data.schemaVersion = SCHEMA_VERSION;
  return data;
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
    data = JSON.parse(raw);
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
  return true;
}

// Apply a change to db and save it. If saving fails, undo the change so
// what's on screen always matches what's stored. Any change ends the
// chance to undo the last delete, so Undo can never revert later work.
function commit(change) {
  let before = structuredClone(db);
  undo = null;
  change();
  if (save()) return true;
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
    JSON.stringify(
      COLLECTIONS.map((k) =>
        k === "skills" ? d.skills.map(({ id: _, ...s }) => s) : d[k],
      ),
    );
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
