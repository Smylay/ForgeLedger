// State and start-up. Loads last: the other files only declare functions
// and constants, and nothing runs until this file does.
"use strict";

let memoryOnly = false, // storage is blocked: changes live in memory only
  recovered = null, // { raw, problem } when saved data needed repair
  undo = null, // copy of db from just before the last undoable change
  completing = null, // id of the queue item the completion prompt is about
  buying = null, // { id, row } of the wishlist item the Bought prompt is about
  editingStages = null, // { qid } while the stage editor is open (null qid: default)
  viewing = null, // { id, index, url } of the miniature whose photos are open
  newRewards = [], // wishlist ids of rewards a change unlocked, until dismissed
  // Auto-save to a file (autosave.js): off, on, paused or error.
  autoSave = { handle: null, state: "off", savedAt: 0, error: "" },
  photoDbOpen = null, // the photo database, opened once (photos.js)
  photoCheck = null, // whether photos can be saved here, checked once
  photoUrls = new Map(), // object URLs of photo thumbnails, by id
  sort = { key: "", dir: 1 }, // table sort for the current section
  upgraded = false, // load() upgraded saved data from an older schema
  toastTimer;
let db = load(),
  section = "dashboard",
  formSection = null, // the collection the add/edit form saves to
  // The paint catalogue (catalogue.js): its load, and its paints once loaded.
  catalogue = { load: null, paints: null, byLabel: null },
  editId = null;
if (upgraded) save();
// What each row and notice button does, by its data-* attribute. Buttons
// are drawn without handlers; this one click listener reads the attribute.
// To add a button, render it with a new data-* attribute and add it here.
const BUTTON_ACTIONS = {
  edit: (b) =>
    openForm(
      section,
      db[section].find((x) => x.id === b.dataset.edit),
    ),
  del: (b) => remove(section, b.dataset.del),
  sort: (b) => sortBy(b.dataset.sort),
  scale: setScale,
  step: stepCount,
  recovery: (b) =>
    b.dataset.recovery === "download"
      ? downloadRecovered()
      : dismissRecovered(),
  wish: (b) => addToWishlist(db.paints.filter((p) => p.id === b.dataset.wish)),
  wishall: addLowToWishlist,
  bought,
  unreward: (b) => dismissReward(b.dataset.unreward),
  demo: (b) =>
    b.dataset.demo === "load"
      ? loadDemo()
      : b.dataset.demo === "clear"
        ? clearDemo()
        : keepDemo(),
  photos: (b) => openPhotos(b.dataset.photos),
  usedin: (b) => showUsedIn(b.dataset.usedin),
  addreward: (b) => addReward(b.dataset.addreward),
  stages: (b) => openStages(b.dataset.stages),
  queue: (b) => queueMiniature(b.dataset.queue),
  next: (b) => nextStage(b.dataset.next),
  plus: (b) => plusOneDone(b.dataset.plus),
  split: (b) => toggleSplit(b.dataset.split),
  adv: (b) => moveOneOn(b.dataset.adv, Number(b.dataset.from)),
  top: (b) => reorderQueue("top", +b.dataset.top),
  up: (b) => reorderQueue("up", +b.dataset.up),
  down: (b) => reorderQueue("down", +b.dataset.down),
};
document.addEventListener("click", (e) => {
  let link = e.target.closest("a[data-sec]");
  if (link && e.button === 0 && !(e.ctrlKey || e.metaKey || e.shiftKey)) {
    e.preventDefault();
    go(link.dataset.sec);
    return;
  }
  let b = e.target.closest("button");
  if (!b) return;
  for (let [attr, act] of Object.entries(BUTTON_ACTIONS))
    if (b.dataset[attr] !== undefined) act(b);
});
document.querySelector("#addBtn").onclick = () => openForm(section);
for (let form of document.querySelectorAll(".quickadd"))
  form.onsubmit = (e) => {
    e.preventDefault();
    if (form.id === "skillAdd") addSkill(form);
    else quickAdd(form);
  };
// Quick add on the paints page suggests catalogue paints (catalogue.js).
document.querySelector("#listView .quickadd").oninput = (e) =>
  quickCatalogueInput(e.target);
// Choosing "Other" in the skill picker shows a box for the name.
document.querySelector("#skillAdd select").onchange = (e) => {
  let input = e.target.form.elements.name,
    other = e.target.value === "other";
  input.hidden = !other;
  input.required = other;
  if (other) input.focus();
};
document.querySelector("#itemForm").onsubmit = submit;
// Enter in the catalogue and plan boxes picks a suggestion; it doesn't save
// the form.
document.querySelector("#itemForm").onkeydown = (e) => {
  if (e.key === "Enter" && ["catalogueFind", "planPaint"].includes(e.target.id))
    e.preventDefault();
};
document.querySelector("#itemForm").oninput = (e) => {
  let form = e.currentTarget;
  for (let el of form.elements) el.setCustomValidity?.(""); // re-check on save
  if (e.target.type === "color")
    form.querySelector(`[data-nocolour="${e.target.name}"]`).checked = false;
  if (e.target.name) updateSuggestions(form, e.target.name);
  if (e.target.id === "catalogueFind") catalogueFindInput(e.target);
  if (e.target.id === "planPaint") planPaintInput(e.target);
};
// Runs as the button is clicked; the dialog closes itself afterwards.
document.querySelector("#completeForm").onsubmit = (e) => {
  if (e.submitter?.value === "apply") applyComplete();
};
// A toast shown inside a dialog (see toast()) goes back to the page when
// the dialog closes. "close" doesn't bubble, so listen while capturing.
document.addEventListener(
  "close",
  (e) => {
    let t = document.querySelector("#toast");
    if (e.target.contains(t)) document.body.append(t);
  },
  true,
);
// Settings.
document.querySelector("#settingsBtn").onclick = openSettings;
document.querySelector("#closeSettings").onclick = () =>
  document.querySelector("#settingsDialog").close();
document.querySelector("#themeSetting").onchange = (e) =>
  setTheme(e.target.value);
document.querySelector("#currencySetting").onchange = (e) =>
  setCurrency(e.target.value);
document.querySelector("#settingsKeysOn").onchange = (e) =>
  setShortcuts(e.target.checked);
document.querySelector("#settingsKeysList").onclick = () => {
  document.querySelector("#settingsDialog").close();
  openKeys();
};
document.querySelector("#eraseAll").onclick = eraseAll;
document.querySelector("#autoSaveChoose").onclick = chooseAutoSave;
document.querySelector("#autoSaveResume").onclick = resumeAutoSave;
document.querySelector("#autoSaveStop").onclick = stopAutoSave;
for (let el of document.querySelectorAll(".appversion"))
  el.textContent = APP_VERSION;
// The photo viewer.
document.querySelector("#closePhotos").onclick = () =>
  document.querySelector("#photosDialog").close();
document.querySelector("#addPhotos").onclick = () =>
  document.querySelector("#photoFile").click();
document.querySelector("#photoFile").onchange = (e) => {
  let files = [...e.target.files];
  e.target.value = ""; // so picking the same file again still works
  addPhotoFiles(files);
};
document.querySelector("#photoStrip").onclick = (e) => {
  let b = e.target.closest("button[data-pick]");
  if (b) showPhoto(Number(b.dataset.pick));
};
document.querySelector("#coverPhoto").onclick = makeCover;
document.querySelector("#removePhoto").onclick = removePhoto;
document.querySelector("#photosDialog").onclose = () => {
  let mid = viewing?.id;
  if (viewing?.url) URL.revokeObjectURL(viewing.url);
  viewing = null;
  if (mid) refocus(`[data-photos="${CSS.escape(mid)}"]`);
};
// The stage editor.
document.querySelector("#stagesBtn").onclick = () => openStages(null);
document.querySelector("#stageList").onclick = (e) => {
  let b = e.target.closest("button");
  if (b) stageRowAction(b);
};
// A name problem can involve two rows (a repeat), so any edit clears all
// of them; Save checks again.
document.querySelector("#stageList").oninput = () => {
  for (let input of document.querySelectorAll("#stageList input"))
    input.setCustomValidity("");
};
document.querySelector("#addStage").onclick = addStageRow;
document.querySelector("#resetStages").onclick = () => {
  useDefaultStages(editingStages?.qid);
  document.querySelector("#stagesDialog").close();
};
document.querySelector("#stagesForm").onsubmit = (e) => {
  if (e.submitter?.value === "save" && !saveStages()) e.preventDefault();
};
// Closing returns focus to the button that opened the editor, redrawn by now.
document.querySelector("#stagesDialog").onclose = () => {
  let qid = editingStages?.qid;
  editingStages = null;
  refocus(qid ? `[data-stages="${CSS.escape(qid)}"]` : "#stagesBtn");
};
document.querySelector("#boughtForm").onsubmit = (e) => {
  if (e.submitter?.value === "apply")
    applyBought(new FormData(e.currentTarget).get("to"));
};
// Closing returns focus to the Bought button, which may be gone by now.
document.querySelector("#boughtDialog").onclose = () => {
  if (buying) focusBought(buying.row);
  buying = null;
};
document.querySelector("#toastAction").onclick = () => {
  let snapshot = undo;
  if (!snapshot || !commit(() => (db = snapshot))) return;
  renderNav();
  render();
  toast("Restored");
};
document.querySelector("#closeModal").onclick = document.querySelector(
  "#cancelModal",
).onclick = () => document.querySelector("#modal").close();
document.querySelector("#backupBtn").onclick = exportJSON;
document.querySelector("#importBtn").onclick = () =>
  document.querySelector("#importFile").click();
document.querySelector("#importFile").onchange = (e) => {
  let file = e.target.files[0];
  e.target.value = ""; // so choosing the same file again still triggers
  if (file) importJSON(file);
};
document.querySelector("#csvBtn").onclick = csv;
document.querySelector("#search").oninput = renderTable;
document.querySelector("#filter").onchange = renderTable;
document.querySelector("#skillsContent").oninput = (e) => {
  let s = db.skills.find((x) => x.id === e.target.dataset.skill);
  if (!s) return;
  let level = +e.target.value;
  if (!commit(() => Object.assign(s, { level, changed: today() })))
    return renderSkills();
  updateSkillCard(s);
  renderSkillOverview();
};
// Another tab saved: adopt its data so this tab doesn't overwrite it later.
window.addEventListener("storage", (e) => {
  if (e.key === BACKUP_KEY) renderBackupState();
  if (e.key !== KEY || e.newValue === null) return;
  db = load();
  undo = null; // undoing now would revert the other tab's change
  renderNav();
  render();
  renderAlerts();
  toast("Updated with changes from another tab");
});
// Drag a queue item by its handle, with a mouse, pen or finger. The list
// stays put while dragging (a line shows where the item will land), so
// the pointer capture on the handle isn't lost; the move is saved on
// release. The Top and arrow buttons do the same from the keyboard.
document.querySelector("#queueContent").addEventListener("pointerdown", (e) => {
  let handle = e.target.closest(".handle");
  if (!handle || e.button !== 0) return;
  let list = e.currentTarget,
    item = handle.closest(".qitem"),
    from = +item.dataset.index,
    to = from;
  e.preventDefault();
  try {
    handle.setPointerCapture(e.pointerId); // keep events if the pointer leaves
  } catch {}
  item.classList.add("dragging");
  let others = [...list.querySelectorAll(".qitem")].filter((x) => x !== item);
  let clear = () =>
    others.forEach((o) => o.classList.remove("drop-before", "drop-after"));
  let move = (ev) => {
    // The new position is how many other items sit above the pointer.
    to = others.filter((o) => {
      let r = o.getBoundingClientRect();
      return ev.clientY > r.top + r.height / 2;
    }).length;
    clear();
    if (to < others.length) others[to].classList.add("drop-before");
    else others.at(-1)?.classList.add("drop-after");
  };
  let end = (ev) => {
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", end);
    handle.removeEventListener("pointercancel", end);
    clear();
    item.classList.remove("dragging");
    if (ev.type === "pointerup") moveQueueItem(from, to);
    renderQueue();
  };
  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
});
// Single-key shortcuts (see #keysDialog). They're ignored while typing, with
// Ctrl, Alt or Cmd held, or while a dialog is open, and can be turned off
// (WCAG 2.1.4); the choice is kept outside the data.
const SECTION_KEYS = ["dashboard", ...Object.keys(defs)]; // keys 1 to 8
document.querySelector("#keysBtn").onclick = openKeys;
document.querySelector("#keysOn").onchange = (e) =>
  setShortcuts(e.target.checked);
document.addEventListener("keydown", (e) => {
  if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
  if (!shortcutsOn() || document.querySelector("dialog[open]")) return;
  if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
  let k = e.key.toLowerCase(),
    d = defs[section],
    view = document.querySelector(".view.active");
  if (k === "?") openKeys();
  else if (/^[1-8]$/.test(k)) go(SECTION_KEYS[k - 1]);
  else if (k === "n" && d) openForm(section);
  else if (k === "q" && d)
    view
      .querySelector(".quickadd select, .quickadd input:not([hidden])")
      ?.focus();
  else if (k === "/" && view.id === "listView")
    document.querySelector("#search").focus();
  else return;
  e.preventDefault(); // e.g. so "/" isn't typed into the search box
});
// Back, forward, and typed or bookmarked addresses.
window.addEventListener("hashchange", () => {
  if (sectionFromHash() !== section) show(sectionFromHash());
});
show(sectionFromHash());
renderBackupState();
renderAlerts();
tidyPhotos().catch(() => {}); // delete stored photos nothing uses
loadAutoSave();
