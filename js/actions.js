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

// Wishlist categories that have a list to go into when bought.
const BOUGHT_TO = { Paint: "paints", Tool: "tools", Miniature: "miniatures" };

// "Bought" on a wishlist row. A restock (linked to a paint that still
// exists) sets that paint back to Full; Paint, Tool and Miniature items
// are added to that list; anything else asks where it goes. `b` is the
// button, so focus can move to the next row's Bought afterwards.
function bought(b) {
  let w = db.wishlist.find((x) => x.id === b.dataset.bought);
  if (!w) return;
  let row = [...document.querySelectorAll("[data-bought]")].indexOf(b),
    paint = linked(column(defs.wishlist, "paint"), w.paint),
    to = BOUGHT_TO[w.category];
  if (paint || to) {
    if (buy(w, to, paint)) focusBought(row);
    return;
  }
  buying = { id: w.id, row };
  document.querySelector("#boughtText").textContent =
    `Where should "${w.name}" go? It comes off the wishlist either way.`;
  let choice = w.category === "Terrain" ? "miniatures" : "";
  for (let r of document.querySelectorAll("#boughtForm [name=to]"))
    r.checked = r.value === choice;
  document.querySelector("#boughtDialog").showModal();
}
// The Bought prompt's Apply.
function applyBought(to) {
  let w = buying && db.wishlist.find((x) => x.id === buying.id);
  if (w) buy(w, to || null, null);
}
// Take `w` off the wishlist, and restock `paint` or add a record to the
// `to` list (or neither), all with one Undo. Returns whether it saved.
function buy(w, to, paint) {
  let record = !paint && to ? boughtRecord(to, w) : null;
  return commitWithUndo(
    () => {
      db.wishlist = db.wishlist.filter((x) => x.id !== w.id);
      if (paint) paint.stock = "Full";
      if (record) db[to].push(record);
    },
    () =>
      paint
        ? `Bought "${w.name}": "${paint.name}" is Full again`
        : record
          ? `Bought "${w.name}": added to ${defs[to].nav || defs[to].title}`
          : `Bought "${w.name}": taken off the wishlist`,
  );
}
// A new paint, tool or miniature from a wishlist item: its name, price
// and notes, with the product link added to the notes.
function boughtRecord(to, w) {
  let link = safeUrl(w.url),
    notes = [w.notes, link && `Bought from ${link}`].filter(Boolean).join("\n"),
    r = { id: id(), name: w.name, price: w.price || "", notes };
  if (to === "paints") return { ...r, quantity: "1", stock: "Full" };
  if (to === "tools") return { ...r, quantity: "1", condition: "New" };
  return { ...r, status: "Unbuilt" }; // its model count isn't known
}
// After a row goes, focus the Bought button now in its place (or the last
// one), else the quick-add box.
function focusBought(row) {
  let all = document.querySelectorAll("[data-bought]");
  (
    all[Math.min(row, all.length - 1)] ||
    document.querySelector(".view.active .quickadd input")
  )?.focus();
}

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

// The photo viewer for one miniature: the chosen photo large, a strip of
// thumbnails to pick from, and buttons to add, make cover and remove.
function openPhotos(mid) {
  let m = db.miniatures.find((x) => x.id === mid);
  if (!m) return;
  viewing = { id: m.id, index: 0, url: "" };
  document.querySelector("#photoStatus").textContent = "";
  document.querySelector("#photosDialog").showModal();
  renderPhotos();
}
async function renderPhotos() {
  let m = viewing && db.miniatures.find((x) => x.id === viewing.id);
  if (!m) return;
  let ids = photoIds(m),
    i = (viewing.index = Math.max(0, Math.min(viewing.index, ids.length - 1))),
    name = esc(m.name),
    dlg = document.querySelector("#photosDialog");
  document.querySelector("#photosTitle").textContent = `Photos of "${m.name}"`;
  document.querySelector("#photoView").innerHTML = ids.length
    ? `<img data-photo="${esc(ids[i])}" data-size="full" alt="Photo ${i + 1} of ${ids.length} of ${name}"><figcaption>Photo ${i + 1} of ${ids.length}${i === 0 ? " · cover" : ""}</figcaption>`
    : '<p class="muted">No photos yet. Add them from your computer, or your phone\'s camera.</p>';
  document.querySelector("#photoStrip").innerHTML = ids
    .map(
      (p, k) =>
        `<button type="button" data-pick="${k}" aria-label="Show photo ${k + 1}"${k === i ? ' aria-current="true"' : ""}><img data-photo="${esc(p)}" alt=""></button>`,
    )
    .join("");
  document.querySelector("#coverPhoto").disabled = i === 0;
  document.querySelector("#removePhoto").disabled = !ids.length;
  let works = await photosWork();
  document.querySelector("#photosUnavailable").hidden = works;
  document.querySelector("#addPhotos").disabled = !works;
  if (viewing?.url) URL.revokeObjectURL(viewing.url);
  await fillPhotos(dlg);
  if (viewing)
    viewing.url = dlg.querySelector('img[data-size="full"]')?.src || "";
}
function showPhoto(k) {
  if (!viewing) return;
  viewing.index = k;
  renderPhotos().then(() =>
    refocus(`#photoStrip [data-pick="${k}"]`, "#addPhotos"),
  );
}
// Shrink and store picked images, then add them to the miniature with Undo.
// Files the browser can't read (e.g. HEIC on some computers) are named.
async function addPhotoFiles(files) {
  if (!viewing || !files.length) return;
  let mid = viewing.id,
    status = document.querySelector("#photoStatus"),
    recs = [],
    failed = [];
  status.textContent = `Adding ${files.length} photo(s)…`;
  document.querySelector("#addPhotos").disabled = true;
  for (let f of files)
    try {
      recs.push(await photoFromFile(f));
    } catch {
      failed.push(f.name);
    }
  if (recs.length)
    try {
      await putPhotos(recs);
    } catch {
      failed.push(
        ...files.map((f) => f.name).filter((n) => !failed.includes(n)),
      );
      recs = [];
    }
  // Look the miniature up again: another tab may have changed the data.
  let m = db.miniatures.find((x) => x.id === mid);
  if (m && recs.length) {
    let before = photoIds(m).length;
    let added = commitWithUndo(
      () => (m.photos = [...photoIds(m), ...recs.map((r) => r.id)]),
      () => `Added ${recs.length} photo(s) to "${m.name}"`,
    );
    if (added && viewing?.id === mid) viewing.index = before;
  }
  status.textContent = failed.length
    ? `Couldn't add ${failed.join(", ")}. Use JPEG, PNG or WebP images; if they are, the browser's storage may be full.`
    : "";
  await renderPhotos();
  document.querySelector("#addPhotos").focus();
}
// The photo shown becomes the first, which is the cover.
function makeCover() {
  let m = viewing && db.miniatures.find((x) => x.id === viewing.id);
  if (!m) return;
  let ids = photoIds(m),
    pid = ids[viewing.index];
  if (!pid || viewing.index === 0) return;
  if (!commit(() => (m.photos = [pid, ...ids.filter((p) => p !== pid)])))
    return;
  viewing.index = 0;
  render();
  renderPhotos().then(() => refocus("#removePhoto"));
}
// Take the shown photo off the miniature, with Undo. The image stays stored
// until start-up tidies it (tidyPhotos), so Undo can bring it back.
function removePhoto() {
  let m = viewing && db.miniatures.find((x) => x.id === viewing.id);
  if (!m) return;
  let ids = photoIds(m),
    pid = ids[viewing.index];
  if (!pid) return;
  commitWithUndo(
    () => (m.photos = ids.filter((p) => p !== pid)),
    () => `Removed a photo from "${m.name}"`,
  );
  renderPhotos().then(() =>
    refocus("#removePhoto", "#addPhotos", "#closePhotos"),
  );
}

// A backup is the data plus the images its photos use (see photos.js).
async function backupJson(data) {
  let photos = await backupPhotos(data);
  return JSON.stringify(
    Object.keys(photos).length ? { ...data, photos } : data,
    null,
    2,
  );
}
async function exportJSON() {
  download(await backupJson(db), `forgeledger-backup-${today()}.json`);
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
  r.onload = async () => {
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
        await backupJson(db),
        `forgeledger-before-import-${today()}.json`,
      );
    }
    // Store the backup's images first; they never go into localStorage.
    let incoming = photosFromBackup(data.photos),
      stored = 0;
    delete data.photos;
    if (incoming.length && (await photosWork()))
      try {
        await putPhotos(incoming);
        stored = incoming.length;
      } catch {}
    let next = fromBackup(data);
    if (!commit(() => (db = next))) return;
    newRewards = []; // rewards in a backup were unlocked elsewhere
    renderRewardNotice();
    go("dashboard");
    toast(
      stored < incoming.length
        ? `Backup imported, but its ${incoming.length - stored} photo(s) couldn't be stored in this browser`
        : "Backup imported",
      stored < incoming.length ? 6000 : 1800,
    );
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
