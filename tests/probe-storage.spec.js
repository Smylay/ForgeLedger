// TEMPORARY probe (removed before the PR): can each browser keep images in
// IndexedDB from a file:// page, and resize them?
const { test, expect, APP } = require("./helpers");

test("probe: IndexedDB, resizing and folder access from file://", async ({
  page,
}) => {
  await page.goto(APP);
  const run = (fn) =>
    page.evaluate(fn).catch((e) => "ERR " + e.message.split("\n")[0]);
  const out = {};
  out.secure = await run(() => window.isSecureContext);
  out.dirPicker = await run(() => typeof window.showDirectoryPicker);
  const open = () =>
    new Promise((res, rej) => {
      const q = indexedDB.open("probe", 1);
      q.onupgradeneeded = () => q.result.createObjectStore("s");
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
  await page.evaluate(`window.openProbe = ${open.toString()}`);
  out.put = await run(async () => {
    const db = await window.openProbe();
    const blob = new Blob([new Uint8Array(300000)], { type: "image/jpeg" });
    await new Promise((res, rej) => {
      const t = db.transaction("s", "readwrite");
      t.objectStore("s").put(blob, "k");
      t.oncomplete = res;
      t.onerror = () => rej(t.error);
    });
    return "stored";
  });
  await page.reload();
  await page.evaluate(`window.openProbe = ${open.toString()}`);
  out.readBack = await run(async () => {
    const db = await window.openProbe();
    const b = await new Promise((res, rej) => {
      const q = db.transaction("s").objectStore("s").get("k");
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    });
    return b ? b.size : null;
  });
  out.resize = await run(async () => {
    const c = document.createElement("canvas");
    c.width = 800;
    c.height = 600;
    c.getContext("2d").fillRect(0, 0, 800, 600);
    const bmp = await createImageBitmap(c);
    const d = document.createElement("canvas");
    d.width = 400;
    d.height = 300;
    d.getContext("2d").drawImage(bmp, 0, 0, 400, 300);
    const b = await new Promise((r) => d.toBlob(r, "image/jpeg", 0.8));
    return b ? b.size : null;
  });
  out.quotaMB = await run(async () =>
    Math.round((await navigator.storage.estimate()).quota / 1e6),
  );
  console.log("PROBE " + JSON.stringify(out));
  expect(out.readBack).toBe(300000);
});
