// Miniature photos. The data (localStorage) holds each miniature's photo
// ids in `photos`; the images themselves live in IndexedDB, which has room
// for them. Images are stored as bytes (ArrayBuffer) with their type, not
// as Blobs, which WebKit (Safari) can't store from a file:// page. They're
// shrunk before saving: PHOTO_SIZE pixels on the long edge, plus a
// THUMB_SIZE thumbnail.

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
    let blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.85));
    if (!blob) throw new Error("couldn't encode");
    return {
      bytes: await blob.arrayBuffer(),
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
  let used = new Set(db.miniatures.flatMap(photoIds)),
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
  let ids = [...new Set(data.miniatures.flatMap(photoIds))],
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
