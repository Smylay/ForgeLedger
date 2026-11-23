// Miniature photos: added from files, shrunk, kept in IndexedDB, shown as
// a cover thumbnail and in a viewer, and carried in backups.
const {
  test,
  expect,
  openApp,
  seed,
  stored,
  nav,
  tableRows,
  downloadText,
  importBackup,
  imageFile,
} = require("./helpers");

// What's in the photo store, without the image bytes.
const storedPhotos = (page) =>
  page.evaluate(async () =>
    (await allPhotos()).map((p) => ({
      id: p.id,
      type: p.type,
      width: p.width,
      height: p.height,
      thumb: p.thumb.byteLength > 0,
    })),
  );
const dialog = (page) => page.locator("#photosDialog");
const photosButton = (page, name) =>
  page.getByRole("button", { name: new RegExp(`^Photos.*: ${name}$`) });
async function addPhotos(page, files) {
  await page.locator("#photoFile").setInputFiles(files);
  await expect(page.locator("#photoStatus")).toHaveText("");
}

test.beforeEach(async ({ page, browserName }) => {
  await openApp(page);
  await seed(page, {
    schemaVersion: 5,
    miniatures: [
      { id: "m1", name: "Squad", quantity: "5" },
      { id: "m2", name: "Hero", quantity: "1" },
    ],
  });
  // WebKit can't use IndexedDB from a file:// page (tests/hosted.spec.js
  // checks photos over HTTP there). Everywhere else it must work.
  const works = await page.evaluate(() => photosWork());
  test.skip(
    browserName === "webkit" && !works,
    "WebKit can't store photos from file://",
  );
  expect(works).toBe(true);
  await nav(page, "miniatures");
});

test("each miniature has a Photos button that opens an empty viewer", async ({
  page,
}) => {
  await photosButton(page, "Squad").click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.locator("#photosTitle")).toHaveText('Photos of "Squad"');
  await expect(page.locator("#photoView")).toContainText("No photos yet");
  await expect(page.locator("#addPhotos")).toBeEnabled();
  await expect(page.locator("#removePhoto")).toBeDisabled();
  await expect(page.locator("#photosUnavailable")).toBeHidden();
});

test("an added photo is shrunk, stored and shown, with Undo", async ({
  page,
}) => {
  await photosButton(page, "Squad").click();
  await addPhotos(page, [await imageFile(page, "big.png", 2000, 1500)]);
  const [photo] = await storedPhotos(page);
  expect(photo).toMatchObject({
    type: "image/jpeg",
    width: 1600,
    height: 1200,
    thumb: true,
  });
  expect((await stored(page)).miniatures[0].photos).toEqual([photo.id]);
  await expect(page.locator("#photoView img")).toHaveAttribute(
    "alt",
    "Photo 1 of 1 of Squad",
  );
  await expect(page.locator("#photoView img")).toHaveAttribute("src", /^blob:/);
  await expect(page.locator("#photoView figcaption")).toHaveText(
    "Photo 1 of 1 · cover",
  );
  await expect(page.locator("#toastText")).toHaveText(
    'Added 1 photo(s) to "Squad"',
  );
  // The table shows the cover, and the button counts the photos.
  await page.click("#closePhotos");
  await expect(tableRows(page).first().locator("img.thumb")).toHaveAttribute(
    "src",
    /^blob:/,
  );
  await expect(photosButton(page, "Squad")).toHaveText("Photos (1)");
  await expect(photosButton(page, "Squad")).toBeFocused();
  await page.click("#toastAction");
  expect((await stored(page)).miniatures[0].photos ?? []).toEqual([]);
});

test("a small photo isn't enlarged", async ({ page }) => {
  await photosButton(page, "Hero").click();
  await addPhotos(page, [await imageFile(page, "small.png", 300, 200)]);
  expect((await storedPhotos(page))[0]).toMatchObject({
    width: 300,
    height: 200,
  });
});

test("photos can be picked, made the cover and removed", async ({ page }) => {
  await photosButton(page, "Squad").click();
  await addPhotos(page, [
    await imageFile(page, "red.png", 400, 300, "#c33"),
    await imageFile(page, "blue.png", 400, 300, "#33c"),
  ]);
  const ids = (await stored(page)).miniatures[0].photos;
  expect(ids).toHaveLength(2);
  // The first new photo is shown.
  await expect(page.locator("#photoView img")).toHaveAttribute(
    "data-photo",
    ids[0],
  );
  await page.getByRole("button", { name: "Show photo 2" }).click();
  await expect(
    page.getByRole("button", { name: "Show photo 2" }),
  ).toBeFocused();
  await expect(
    page.getByRole("button", { name: "Show photo 2" }),
  ).toHaveAttribute("aria-current", "true");
  await page.click("#coverPhoto");
  expect((await stored(page)).miniatures[0].photos).toEqual([ids[1], ids[0]]);
  await expect(page.locator("#photoView figcaption")).toHaveText(
    "Photo 1 of 2 · cover",
  );
  await expect(page.locator("#coverPhoto")).toBeDisabled();
  await page.click("#removePhoto");
  expect((await stored(page)).miniatures[0].photos).toEqual([ids[0]]);
  await expect(page.locator("#toastText")).toHaveText(
    'Removed a photo from "Squad"',
  );
  await page.click("#toastAction");
  expect((await stored(page)).miniatures[0].photos).toEqual([ids[1], ids[0]]);
});

test("a file that isn't an image is named, and nothing is added", async ({
  page,
}) => {
  await photosButton(page, "Squad").click();
  await page.locator("#photoFile").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a picture"),
  });
  await expect(page.locator("#photoStatus")).toContainText(
    "Couldn't add notes.txt",
  );
  expect((await stored(page)).miniatures[0].photos).toBeUndefined();
});

test("photos are still there after a reload", async ({ page }) => {
  await photosButton(page, "Squad").click();
  await addPhotos(page, [await imageFile(page, "a.png", 200, 200)]);
  await page.reload();
  await nav(page, "miniatures");
  await expect(tableRows(page).first().locator("img.thumb")).toHaveAttribute(
    "src",
    /^blob:/,
  );
});

test.describe("backups", () => {
  test("include the photos, and bring them back on import", async ({
    page,
    browser,
  }, testInfo) => {
    await photosButton(page, "Squad").click();
    await addPhotos(page, [await imageFile(page, "a.png", 640, 480)]);
    await page.click("#closePhotos");
    const backup = JSON.parse(await downloadText(page, "#backupBtn"));
    const pid = backup.miniatures[0].photos[0];
    expect(backup.photos[pid]).toMatchObject({ type: "image/jpeg" });
    expect(backup.photos[pid].full.length).toBeGreaterThan(100);
    expect(backup.schemaVersion).toBe(5);

    // A new browser profile: no data, no photos.
    const fresh = await (await browser.newContext()).newPage();
    await openApp(fresh);
    await importBackup(fresh, backup, testInfo);
    await expect(fresh.locator("#toast")).toHaveText("Backup imported");
    await nav(fresh, "miniatures");
    await expect(tableRows(fresh).first().locator("img.thumb")).toHaveAttribute(
      "src",
      /^blob:/,
    );
    // The images went to IndexedDB, not into the saved data.
    expect(await stored(fresh)).not.toHaveProperty("photos");
    expect((await storedPhotos(fresh)).map((p) => p.id)).toEqual([pid]);
    await fresh.context().close();
  });

  test("odd photo entries are skipped", async ({ page }, testInfo) => {
    await importBackup(
      page,
      {
        schemaVersion: 5,
        miniatures: [{ id: "m", name: "Odd", photos: ["a", "b", "c", 7] }],
        photos: {
          a: { type: "text/html", full: btoa("<script>") },
          b: { type: "image/png", full: "%%% not base64 %%%" },
          c: "nope",
        },
      },
      testInfo,
    );
    await expect(page.locator("#toast")).toHaveText("Backup imported");
    expect(await storedPhotos(page)).toEqual([]);
    await nav(page, "miniatures");
    // Missing images show no picture, and no error.
    await expect(tableRows(page).first().locator("img.thumb")).toHaveClass(
      /missing/,
    );
  });
});

test("start-up deletes stored photos nothing uses, once they're a day old", async ({
  page,
}) => {
  await page.evaluate(() => {
    const rec = (id, added) => ({
      id,
      type: "image/jpeg",
      full: new ArrayBuffer(4),
      thumb: new ArrayBuffer(4),
      added,
    });
    return putPhotos([
      rec("used", 0),
      rec("old", Date.now() - 2 * 864e5),
      rec("new", Date.now()),
    ]);
  });
  await seed(page, {
    schemaVersion: 5,
    miniatures: [{ id: "m", name: "Squad", photos: ["used"] }],
  }); // reloads the page, which tidies
  await expect
    .poll(async () => (await storedPhotos(page)).map((p) => p.id).sort())
    .toEqual(["new", "used"]);
});

test("without IndexedDB the viewer says so and can't add", async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(() =>
    Object.defineProperty(window, "indexedDB", {
      get() {
        throw new Error("blocked");
      },
    }),
  );
  const page = await ctx.newPage();
  await openApp(page);
  await seed(page, {
    schemaVersion: 5,
    miniatures: [{ id: "m", name: "Squad" }],
  });
  await nav(page, "miniatures");
  await photosButton(page, "Squad").click();
  await expect(page.locator("#photosUnavailable")).toBeVisible();
  await expect(page.locator("#addPhotos")).toBeDisabled();
  await ctx.close();
});
