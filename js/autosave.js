// Auto-save to a file: after each change, a full backup (photos included)
// is written to a file the user picked once. It uses the File System Access
// API, which only Chromium browsers have; elsewhere Settings says so.
//
// The file's handle is kept in IndexedDB (AUTOSAVE_DB), so it's remembered
// between visits. Browsers ask for permission again after a restart, so a
// remembered file starts "paused" until the user clicks Resume.

const AUTOSAVE_DB = "forgeledger_files";
const AUTOSAVE_DELAY = 1500; // ms after the last change before writing

function autoSaveSupported() {
  return typeof window.showSaveFilePicker === "function";
}
// Run `fn(store)` on the handle store and resolve with its request's result.
function handleTx(mode, fn) {
  return new Promise((res, rej) => {
    let q = indexedDB.open(AUTOSAVE_DB, 1);
    q.onupgradeneeded = () => q.result.createObjectStore("handles");
    q.onerror = () => rej(q.error);
    q.onsuccess = () => {
      let t = q.result.transaction("handles", mode),
        req = fn(t.objectStore("handles"));
      t.oncomplete = () => res(req?.result);
      t.onerror = t.onabort = () => rej(t.error || new Error("aborted"));
    };
  });
}

// At start-up: pick up a remembered file.
async function loadAutoSave() {
  if (autoSaveSupported())
    try {
      let handle = await handleTx("readonly", (s) => s.get("autosave"));
      if (handle) {
        let p = await handle.queryPermission({ mode: "readwrite" });
        autoSave = {
          ...autoSave,
          handle,
          state: p === "granted" ? "on" : "paused",
        };
      }
    } catch {}
  renderAutoSave();
}
async function chooseAutoSave() {
  let handle;
  try {
    handle = await window.showSaveFilePicker({
      suggestedName: "forgeledger-autosave.json",
      types: [
        {
          description: "ForgeLedger backup",
          accept: { "application/json": [".json"] },
        },
      ],
    });
  } catch {
    return; // cancelled
  }
  autoSave = { ...autoSave, handle, state: "on", error: "" };
  try {
    await handleTx("readwrite", (s) => s.put(handle, "autosave"));
  } catch {} // then it's only remembered until the page closes
  await writeAutoSave();
}
async function resumeAutoSave() {
  let p = "denied";
  try {
    p = await autoSave.handle.requestPermission({ mode: "readwrite" });
  } catch {}
  autoSave.state = p === "granted" ? "on" : "paused";
  if (autoSave.state === "on") await writeAutoSave();
  else renderAutoSave();
}
async function stopAutoSave() {
  clearTimeout(autoSave.timer);
  autoSave = { handle: null, state: "off", savedAt: 0, error: "" };
  try {
    await handleTx("readwrite", (s) => s.delete("autosave"));
  } catch {}
  renderAutoSave();
}
// After each save: write the file once changes stop for AUTOSAVE_DELAY.
function scheduleAutoSave() {
  if (autoSave.state !== "on") return;
  clearTimeout(autoSave.timer);
  autoSave.timer = setTimeout(writeAutoSave, AUTOSAVE_DELAY);
}
// One write at a time; a change during a write writes again afterwards.
async function writeAutoSave() {
  if (autoSave.state !== "on" || !autoSave.handle) return;
  if (autoSave.writing) return void (autoSave.again = true);
  autoSave.writing = true;
  try {
    let text = await backupJson(db),
      out = await autoSave.handle.createWritable();
    await out.write(text);
    await out.close();
    autoSave.savedAt = Date.now();
    autoSave.error = "";
    try {
      localStorage.setItem(BACKUP_KEY, String(autoSave.savedAt));
    } catch {}
    renderBackupState();
    if (section === "dashboard") renderDashboard();
  } catch (e) {
    if (e?.name === "NotAllowedError") autoSave.state = "paused";
    else {
      autoSave.state = "error";
      autoSave.error = e?.message || "unknown error";
    }
  } finally {
    autoSave.writing = false;
    renderAutoSave();
    if (autoSave.again) {
      autoSave.again = false;
      scheduleAutoSave();
    }
  }
}

function renderAutoSave() {
  let { state, handle, savedAt, error } = autoSave,
    name = handle?.name || "your file",
    time = savedAt
      ? new Date(savedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
  let text = !autoSaveSupported()
    ? "Auto-saving to a file needs Chrome, Edge or another Chromium-based browser. In this browser, use Export backup."
    : state === "on"
      ? `On: saving to ${name}${time ? `. Last saved at ${time}.` : "."}`
      : state === "paused"
        ? `Paused: the browser needs your permission again to save to ${name}.`
        : state === "error"
          ? `Couldn't save to ${name} (${error}). Choose a file again, or stop.`
          : "Off. Choose a file, and ForgeLedger saves a full backup to it, photos included, after every change.";
  document.querySelector("#autoSaveStatus").textContent = text;
  document.querySelector("#autoSaveChoose").hidden =
    !autoSaveSupported() || state === "on" || state === "paused";
  document.querySelector("#autoSaveResume").hidden = state !== "paused";
  document.querySelector("#autoSaveStop").hidden = state === "off";
  document.querySelector("#autoSaveState").textContent =
    state === "on"
      ? `Auto-save: on${time ? ` (${time})` : ""}`
      : state === "paused"
        ? "Auto-save: paused"
        : state === "error"
          ? "Auto-save: failed"
          : "";
}
