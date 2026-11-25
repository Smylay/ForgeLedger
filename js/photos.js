// Photos of miniatures and their models. The data (localStorage) holds each miniature's photo
// ids in `photos`; the images themselves live in IndexedDB, which has room
// for them. Images are stored as bytes (ArrayBuffer) with their type, not
// as Blobs, which WebKit (Safari) can't store from a file:// page. They're
// shrunk before saving: PHOTO_SIZE pixels on the long edge, plus a
// THUMB_SIZE thumbnail. Model cards on the board can have a photo too
// (`photo`), which is also one of its miniature's photos. The photo viewer
// is at the end of the file.
"use strict";

const PHOTO_DB = "forgeledger_photos";
const PHOTO_SIZE = 1600;
const THUMB_SIZE = 320;
// Unreferenced photos are deleted at start-up once they're this old, so
// Undo can still bring a removed photo back during the session.
const PHOTO_KEEP_MS = 864e5;
// Image types a backup may bring in; anything else is ignored.
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Open (once) the photo database. Rejects where IndexedDB is unavailable,
// e.g. a private window or blocked site data.
function photoDb() {
  photoDbOpen ??= new Promise((res, rej) => {
    let q;
    try {
      q = indexedDB.open(PHOTO_DB, 1);
    } catch (e) {
      return rej(e);
    }
    q.onupgradeneeded = () =>
      q.result.createObjectStore("photos", { keyPath: "id" });
    q.onsuccess = () => res(q.result);
    q.onerror = () => rej(q.error);
    q.onblocked = () => rej(new Error("blocked"));
  });
  return photoDbOpen;
}
// Run `fn(store)` in a transaction and resolve with its request's result
// once the transaction commits.
async function photoTx(mode, fn) {
  let idb = await photoDb();
  return new Promise((res, rej) => {
    let t = idb.transaction("photos", mode),
      req = fn(t.objectStore("photos"));
    t.oncomplete = () => res(req?.result);
    t.onerror = t.onabort = () => rej(t.error || new Error("aborted"));
  });
}
const putPhotos = (recs) =>
  photoTx("readwrite", (s) => recs.forEach((r) => s.put(r)));
const getPhoto = (pid) => photoTx("readonly", (s) => s.get(pid));
const allPhotos = () => photoTx("readonly", (s) => s.getAll());
const deletePhotos = (ids) =>
  photoTx("readwrite", (s) => ids.forEach((pid) => s.delete(pid)));

// Can photos be saved here? Checked once, by writing and reading back a
// tiny photo, since some browsers open the database but can't write.
function photosWork() {
  photoCheck ??= (async () => {
    try {
      let probe = {
        id: "probe",
        type: "image/png",
        full: new ArrayBuffer(8),
        thumb: new ArrayBuffer(8),
        added: 0,
      };
      await putPhotos([probe]);
      let back = await getPhoto("probe");
      await deletePhotos(["probe"]);
      return back?.full?.byteLength === 8;
    } catch {
      return false;
    }
  })();
  return photoCheck;
}

// A miniature's photo ids. Imported values may not be a list of strings.
function photoIds(m) {
  return asList(m?.photos).filter((p) => typeof p === "string" && p);
}
// Every photo id the data uses: the miniatures' photos and the model
// cards' (a card's photo stays its own if its unit has no miniature).
function usedPhotoIds(data) {
  return new Set([
    ...data.miniatures.flatMap(photoIds),
    ...data.queue.flatMap((q) => cardsOf(q).map(cardPhoto)).filter(Boolean),
  ]);
}

// An object URL for a stored photo's thumbnail or full image, cached for
// thumbnails; "" if it's missing.
async function photoUrl(pid, which = "thumb") {
  let key = which + ":" + pid;
  if (photoUrls.has(key)) return photoUrls.get(key);
  let rec = await getPhoto(pid).catch(() => null);
  if (!rec?.[which] || !PHOTO_TYPES.includes(rec.type)) return "";
  let url = URL.createObjectURL(new Blob([rec[which]], { type: rec.type }));
  if (which === "thumb") photoUrls.set(key, url);
  return url;
}
// Fill in every <img data-photo> under `root` that has no picture yet.
async function fillPhotos(root = document) {
  for (let img of root.querySelectorAll("img[data-photo]:not([src])")) {
    let url = await photoUrl(img.dataset.photo, img.dataset.size || "thumb");
    if (url) img.src = url;
    else img.classList.add("missing");
  }
}

// Shrink an image file to fit `size` pixels on its long edge, as JPEG.
// Decoding through <img> applies the photo's own rotation (EXIF), as
// browsers do when showing it. Rejects if the browser can't read it.
async function shrinkImage(file, size) {
  let url = URL.createObjectURL(file),
    img = new Image();
  try {
    img.src = url;
    await img.decode();
    let scale = Math.min(
        1,
        size / Math.max(img.naturalWidth, img.naturalHeight),
      ),
      c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.round(img.naturalHeight * scale));
    let g = c.getContext("2d");
    g.fillStyle = "#fff"; // transparent PNGs get a white background
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    // toDataURL, not toBlob, whose callback can stall in some headless
    // browsers; encoding one photo this way takes a few tens of ms.
    let jpeg = c.toDataURL("image/jpeg", 0.85);
    if (!jpeg.startsWith("data:image/jpeg")) throw new Error("couldn't encode");
    return {
      bytes: fromBase64(jpeg.split(",")[1]),
      width: c.width,
      height: c.height,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
// A stored photo record from a picked file.
async function photoFromFile(file) {
  let full = await shrinkImage(file, PHOTO_SIZE),
    thumb = await shrinkImage(file, THUMB_SIZE);
  return {
    id: id(),
    type: "image/jpeg",
    full: full.bytes,
    thumb: thumb.bytes,
    width: full.width,
    height: full.height,
    added: Date.now(),
  };
}

// Delete stored photos no miniature uses any more, once they're old enough
// that no Undo could want them back.
async function tidyPhotos() {
  if (!(await photosWork())) return;
  let used = usedPhotoIds(db),
    old = Date.now() - PHOTO_KEEP_MS,
    spare = (await allPhotos())
      .filter((p) => !used.has(p.id) && !(p.added > old))
      .map((p) => p.id);
  if (spare.length) await deletePhotos(spare);
}

// Backups carry the photos the data uses, base64-encoded, in a top-level
// `photos` object: { id: { type, full, thumb } }. It's taken out before the
// data is loaded, so it never reaches localStorage.
function toBase64(buf) {
  let bytes = new Uint8Array(buf),
    s = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function fromBase64(text) {
  let s = atob(text),
    bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes.buffer;
}
async function backupPhotos(data) {
  let ids = [...usedPhotoIds(data)],
    out = {};
  if (!ids.length || !(await photosWork())) return out;
  for (let pid of ids) {
    let p = await getPhoto(pid).catch(() => null);
    if (p?.full && PHOTO_TYPES.includes(p.type))
      out[pid] = {
        type: p.type,
        full: toBase64(p.full),
        thumb: toBase64(p.thumb || p.full),
      };
  }
  return out;
}
// The usable photos from an imported backup's `photos`, as records to store.
function photosFromBackup(photos) {
  let recs = [];
  if (!isRecord(photos)) return recs;
  for (let [pid, p] of Object.entries(photos)) {
    if (!pid || !isRecord(p) || !PHOTO_TYPES.includes(p.type)) continue;
    try {
      recs.push({
        id: pid,
        type: p.type,
        full: fromBase64(String(p.full)),
        thumb: fromBase64(String(p.thumb ?? p.full)),
        added: Date.now(),
      });
    } catch {} // not valid base64
  }
  return recs;
}

// The photo viewer, for a miniature's photos or one model card's photo
// (`viewing.card`, from the board). It shows the chosen photo large, a
// strip of thumbnails to pick from, and buttons to add, make cover and
// remove.
function openPhotos(mid) {
  if (db.miniatures.some((x) => x.id === mid))
    openViewer({ id: mid, index: 0, url: "" });
}
function openCardPhoto(qid, cid) {
  let q = db.queue.find((x) => x.id === qid);
  if (cardsOf(q).some((c) => c.id === cid))
    openViewer({ q: qid, card: cid, index: 0, url: "" });
}
function openViewer(v) {
  viewing = v;
  document.querySelector("#photoStatus").textContent = "";
  document.querySelector("#photosDialog").showModal();
  renderPhotos();
}
// What the viewer shows, looked up afresh, since Undo or another tab may
// have changed the data: the miniature `m`, its `name` and photo `ids`; for
// a model card, also its unit `q` and card `c`, and `m` is the unit's
// miniature, if it has one. Null once it's gone.
function viewed() {
  if (viewing?.card) {
    let q = db.queue.find((x) => x.id === viewing.q),
      c = cardsOf(q).find((x) => x.id === viewing.card);
    return c
      ? {
          q,
          c,
          m: db.miniatures.find((x) => x.id === q.miniature),
          name: modelName(q, c),
          ids: cardPhoto(c) ? [cardPhoto(c)] : [],
        }
      : null;
  }
  let m = viewing && db.miniatures.find((x) => x.id === viewing.id);
  return m ? { m, name: String(m.name ?? ""), ids: photoIds(m) } : null;
}
// Which model a miniature's photo is of, if one of its cards has it.
function photoModel(m, pid) {
  for (let q of db.queue)
    if (q.miniature === m.id) {
      let c = cardsOf(q).find((x) => cardPhoto(x) === pid);
      if (c) return modelName(q, c);
    }
  return "";
}
async function renderPhotos() {
  let v = viewed();
  if (!v) return;
  let { ids, c } = v,
    i = (viewing.index = Math.max(0, Math.min(viewing.index, ids.length - 1))),
    name = esc(v.name),
    model = c ? "" : photoModel(v.m, ids[i]),
    dlg = document.querySelector("#photosDialog");
  document.querySelector("#photosTitle").textContent =
    `${c ? "Photo" : "Photos"} of "${v.name}"`;
  let caption = c
    ? v.m
      ? `Also in the photos of "${esc(v.m.name)}"`
      : ""
    : `Photo ${i + 1} of ${ids.length}${i === 0 ? " · cover" : ""}${model ? ` · ${esc(model)}` : ""}`;
  document.querySelector("#photoView").innerHTML = ids.length
    ? `<img data-photo="${esc(ids[i])}" data-size="full" alt="${c ? `Photo of ${name}` : `Photo ${i + 1} of ${ids.length} of ${name}`}">${caption ? `<figcaption>${caption}</figcaption>` : ""}`
    : `<p class="muted">${c ? "No photo of this model yet. Add one" : "No photos yet. Add them"} from your computer, or your phone's camera.</p>`;
  document.querySelector("#photoStrip").innerHTML = c
    ? ""
    : ids
        .map(
          (p, k) =>
            `<button type="button" data-pick="${k}" aria-label="Show photo ${k + 1}"${k === i ? ' aria-current="true"' : ""}><img data-photo="${esc(p)}" alt=""></button>`,
        )
        .join("");
  // A model has one photo: adding another replaces it, and there's no cover.
  document.querySelector("#addPhotos").textContent = !c
    ? "Add photos"
    : ids.length
      ? "Replace photo"
      : "Add photo";
  document.querySelector("#photoFile").multiple = !c;
  document.querySelector("#coverPhoto").hidden = !!c;
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
// Shrink and store picked images, then add them with Undo: to the
// miniature, or as the model's photo (only the first file). Files the
// browser can't read (e.g. HEIC on some computers) are named.
async function addPhotoFiles(files) {
  if (!viewing || !files.length) return;
  let was = viewing, // what the photos are for, should the viewer change
    status = document.querySelector("#photoStatus"),
    recs = [],
    failed = [];
  if (was.card) files = files.slice(0, 1);
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
  // Look the record up again: another tab may have changed the data.
  let m = !was.card && db.miniatures.find((x) => x.id === was.id);
  if (recs.length && was.card) setCardPhoto(was.q, was.card, recs[0].id);
  else if (recs.length && m) {
    let before = photoIds(m).length;
    let added = commitWithUndo(
      () => (m.photos = [...photoIds(m), ...recs.map((r) => r.id)]),
      () => `Added ${recs.length} photo(s) to "${m.name}"`,
    );
    if (added && viewing === was) viewing.index = before;
  }
  status.textContent = failed.length
    ? `Couldn't add ${failed.join(", ")}. Use JPEG, PNG or WebP images; if they are, the browser's storage may be full.`
    : "";
  await renderPhotos();
  document.querySelector("#addPhotos").focus();
}
// Set a model card's photo, or with "" remove it, with Undo. It's also one
// of the unit's miniature's photos, if the unit has one: a new photo takes
// the old one's place there, or goes at the end, and removing it removes
// it there too.
function setCardPhoto(qid, cid, pid) {
  let q = db.queue.find((x) => x.id === qid),
    c = cardsOf(q).find((x) => x.id === cid);
  if (!c) return false;
  let old = cardPhoto(c),
    m = db.miniatures.find((x) => x.id === q.miniature),
    name = modelName(q, c),
    verb = !pid ? "Removed" : old ? "Replaced" : "Added",
    prep = !pid ? "from" : old ? "in" : "to";
  return commitWithUndo(
    () => {
      if (pid) c.photo = pid;
      else delete c.photo;
      if (!m) return;
      let ids = photoIds(m);
      m.photos = !pid
        ? ids.filter((p) => p !== old)
        : old && ids.includes(old)
          ? ids.map((p) => (p === old ? pid : p))
          : [...ids, pid];
    },
    () =>
      `${verb} the photo of "${name}"` +
      (m ? `, ${prep} the photos of "${m.name}" too` : ""),
  );
}
// The photo shown becomes the first, which is the cover.
function makeCover() {
  let v = viewed();
  if (!v || v.c) return;
  let pid = v.ids[viewing.index];
  if (!pid || viewing.index === 0) return;
  if (!commit(() => (v.m.photos = [pid, ...v.ids.filter((p) => p !== pid)])))
    return;
  viewing.index = 0;
  render();
  renderPhotos().then(() => refocus("#removePhoto"));
}
// Take the shown photo off, with Undo. The image stays stored until
// start-up tidies it (tidyPhotos), so Undo can bring it back. A model
// card's photo is the same photo as its miniature's, so removing it from
// either removes it from both.
function removePhoto() {
  let v = viewed(),
    pid = v?.ids[viewing.index];
  if (!pid) return;
  if (v.c) setCardPhoto(v.q.id, v.c.id, "");
  else
    commitWithUndo(
      () => {
        v.m.photos = v.ids.filter((p) => p !== pid);
        for (let q of db.queue)
          if (q.miniature === v.m.id)
            for (let c of cardsOf(q)) if (cardPhoto(c) === pid) delete c.photo;
      },
      () => `Removed a photo from "${v.m.name}"`,
    );
  renderPhotos().then(() =>
    refocus("#removePhoto", "#addPhotos", "#closePhotos"),
  );
}

// A miniature's cover photo (its first) as a small thumbnail; the picture
// itself is filled in afterwards by fillPhotos(), from IndexedDB.
function coverHtml(x) {
  let ids = photoIds(x);
  return ids.length
    ? `<img class="thumb" data-photo="${esc(ids[0])}" alt="" width="32" height="32">`
    : "";
}
function photosButtonHtml(x) {
  let n = photoIds(x).length,
    label = n ? `Photos (${n})` : "Photos";
  return `<button data-photos="${esc(x.id)}" aria-label="${label}: ${esc(x.name)}">${label}</button>`;
}
