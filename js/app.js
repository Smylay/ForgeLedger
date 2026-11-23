// State and start-up. Loads last: the other files only declare functions
// and constants, and nothing runs until this file does.
"use strict";

let memoryOnly = false, // storage is blocked: changes live in memory only
  recovered = null, // { raw, problem } when saved data needed repair
  undo = null, // copy of db from just before the last undoable change
  completing = null, // id of the queue item the completion prompt is about
  sort = { key: "", dir: 1 }, // table sort for the current section
  toastTimer;
let db = load(),
  section = "dashboard",
  editId = null;
document.addEventListener("click", (e) => {
  let link = e.target.closest("a[data-sec]");
  if (link && e.button === 0 && !(e.ctrlKey || e.metaKey || e.shiftKey)) {
    e.preventDefault();
    go(link.dataset.sec);
    return;
  }
  let b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.edit)
    openForm(
      section,
      db[section].find((x) => x.id === b.dataset.edit),
    );
  if (b.dataset.recovery === "download")
    download(recovered.raw, `forgeledger-unreadable-data-${today()}.json`);
  if (b.dataset.recovery === "dismiss") {
    recovered = null;
    renderAlerts();
  }
  if (b.dataset.del) remove(section, b.dataset.del);
  if (b.dataset.sort) {
    sort =
      sort.key === b.dataset.sort
        ? { key: sort.key, dir: -sort.dir }
        : { key: b.dataset.sort, dir: 1 };
    renderTable();
  }
  if (b.dataset.wish)
    addToWishlist(db.paints.filter((p) => p.id === b.dataset.wish));
  if (b.dataset.wishall !== undefined) {
    let wanted = new Set(db.wishlist.map((w) => w.paint));
    addToWishlist(db.paints.filter((p) => isLow(p) && !wanted.has(p.id)));
  }
  if (b.dataset.queue) {
    let m = db.miniatures.find((x) => x.id === b.dataset.queue);
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
  if (b.dataset.up !== undefined || b.dataset.down !== undefined) {
    let i = +(b.dataset.up ?? b.dataset.down),
      j = b.dataset.up !== undefined ? i - 1 : i + 1;
    if (j >= 0 && j < db.queue.length)
      commit(() => ([db.queue[i], db.queue[j]] = [db.queue[j], db.queue[i]]));
    renderQueue();
  }
});
document.querySelector("#addBtn").onclick = () => openForm(section);
document.querySelector("#itemForm").onsubmit = submit;
document.querySelector("#itemForm").oninput = (e) => {
  let form = e.currentTarget;
  for (let el of form.elements) el.setCustomValidity?.(""); // re-check on save
  if (e.target.type === "color")
    form.querySelector(`[data-nocolour="${e.target.name}"]`).checked = false;
};
// Runs as the button is clicked; the dialog closes itself afterwards.
document.querySelector("#completeForm").onsubmit = (e) => {
  if (e.submitter?.value === "apply") applyComplete();
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
  if (e.target.dataset.skill) {
    let level = +e.target.value;
    let saved = commit(
      () =>
        (db.skills.find((x) => x.id === e.target.dataset.skill).level = level),
    );
    if (!saved) return renderSkills();
    e.target.closest(".skill").querySelector(".skilltop strong").textContent =
      level + "/9";
  }
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
// Back, forward, and typed or bookmarked addresses.
window.addEventListener("hashchange", () => {
  if (sectionFromHash() !== section) show(sectionFromHash());
});
show(sectionFromHash());
renderBackupState();
renderAlerts();
