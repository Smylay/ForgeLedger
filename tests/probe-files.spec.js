// TEMPORARY probe (removed before the pull request): do two pages opened
// from files in the same folder share localStorage and IndexedDB?
const path = require("path");
const { test, APP } = require("./helpers");

test("probe: storage shared between files in one folder", async ({
  page,
  context,
}) => {
  await page.goto(APP);
  await page.evaluate(async () => {
    localStorage.setItem("probe-key", "hello");
    await new Promise((res, rej) => {
      const q = indexedDB.open("probe-db", 1);
      q.onupgradeneeded = () => q.result.createObjectStore("s");
      q.onsuccess = () => {
        const t = q.result.transaction("s", "readwrite");
        t.objectStore("s").put("hello", "k");
        t.oncomplete = res;
        t.onerror = () => rej(t.error);
      };
      q.onerror = () => rej(q.error);
    });
  });
  const other = await context.newPage();
  await other.goto("file://" + path.join(__dirname, "..", "probe-b.html"));
  const seen = await other.evaluate(async () => {
    const out = { local: localStorage.getItem("probe-key") };
    out.idb = await new Promise((res) => {
      const q = indexedDB.open("probe-db", 1);
      q.onupgradeneeded = () => q.result.createObjectStore("s");
      q.onsuccess = () => {
        const g = q.result.transaction("s").objectStore("s").get("k");
        g.onsuccess = () => res(g.result ?? null);
        g.onerror = () => res("ERR");
      };
      q.onerror = () => res("ERR open");
    });
    return out;
  });
  console.log("PROBE-FILES " + JSON.stringify(seen));
});
