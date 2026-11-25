// A photo of each model on the board. A card's photo is also one of its
// miniature's photos, so the two stay in step; a unit with no miniature
// keeps the photo on its card.
const {
  test,
  expect,
  openApp,
  seed,
  stored,
  nav,
  imageFile,
} = require("./helpers");

const dialog = (page) => page.locator("#photosDialog");
const card = async (page, qid, cid) =>
  (await stored(page)).queue
    .find((q) => q.id === qid)
    .cards.find((c) => c.id === cid);
const miniPhotos = async (page) =>
  (await stored(page)).miniatures[0].photos ?? [];
async function addPhoto(page, file) {
  await page.locator("#photoFile").setInputFiles([file]);
  await expect(page.locator("#photoStatus")).toHaveText("");
}

// Squad's three models, the third with photo `p3` if given, and the
// miniature's photos.
const data = ({ photos, p1, p3 } = {}) => ({
  miniatures: [
    { id: "m", name: "Squad", quantity: "3", status: "Built", photos },
  ],
  queue: [
    {
      id: "a",
      name: "Squad",
      miniature: "m",
      cards: [
        { id: "a1", phase: "Priming", photo: p1 },
        { id: "a2", phase: "Priming" },
        { id: "a3", phase: "Painting", photo: p3 },
      ],
    },
    { id: "b", name: "Hero", cards: [{ id: "b1", phase: "To do" }] },
  ],
});

test.beforeEach(async ({ page }) => {
  await openApp(page);
  expect(await page.evaluate(() => photosWork())).toBe(true);
});

test("every model on the board has a photo button that opens its viewer", async ({
  page,
}) => {
  await seed(page, data());
  await nav(page, "queue");
  // A single model shows on its unit's heading; an open unit lists its own.
  await expect(
    page.getByRole("button", { name: "Add a photo of Hero" }),
  ).toBeVisible();
  await page.locator('[data-unit="a"][data-from="Priming"]').click();
  await expect(
    page.getByRole("button", { name: /^Add a photo of Squad #\d$/ }),
  ).toHaveCount(3);
  await page.getByRole("button", { name: "Add a photo of Squad #3" }).click();
  await expect(dialog(page)).toBeVisible();
  await expect(page.locator("#photosTitle")).toHaveText('Photo of "Squad #3"');
  await expect(page.locator("#photoView")).toContainText(
    "No photo of this model yet",
  );
  await expect(page.locator("#addPhotos")).toHaveText("Add photo");
  await expect(page.locator("#addPhotos")).toBeEnabled();
  await expect(page.locator("#coverPhoto")).toBeHidden();
  await expect(page.locator("#removePhoto")).toBeDisabled();
  expect(await page.locator("#photoFile").evaluate((el) => el.multiple)).toBe(
    false,
  );
  // Closing goes back to the button.
  await page.click("#closePhotos");
  await expect(
    page.getByRole("button", { name: "Add a photo of Squad #3" }),
  ).toBeFocused();
});

test("a model's photo is added to its miniature's photos too", async ({
  page,
}) => {
  await seed(page, data());
  await nav(page, "queue");
  await page.getByRole("button", { name: "Add a photo of Squad #3" }).click();
  await addPhoto(page, await imageFile(page, "a.png", 400, 300));
  const pid = (await card(page, "a", "a3")).photo;
  expect(pid).toEqual(expect.any(String));
  expect(await miniPhotos(page)).toEqual([pid]);
  await expect(page.locator("#toastText")).toHaveText(
    'Added the photo of "Squad #3", to the photos of "Squad" too',
  );
  await expect(page.locator("#photoView img")).toHaveAttribute(
    "alt",
    "Photo of Squad #3",
  );
  await expect(page.locator("#photoView img")).toHaveAttribute("src", /^blob:/);
  await expect(page.locator("#photoView figcaption")).toHaveText(
    'Also in the photos of "Squad"',
  );
  await expect(page.locator("#addPhotos")).toHaveText("Replace photo");
  await expect(page.locator("#removePhoto")).toBeEnabled();
  // The board shows it as the model's thumbnail.
  await page.click("#closePhotos");
  const button = page.getByRole("button", { name: "Photo of Squad #3" });
  await expect(button).toBeFocused();
  await expect(button.locator("img.thumb")).toHaveAttribute("src", /^blob:/);
  // The miniature's viewer says which model it is.
  await nav(page, "miniatures");
  await page.locator('button[data-photos="m"]').click();
  await expect(page.locator("#photoView figcaption")).toHaveText(
    "Photo 1 of 1 · cover · Squad #3",
  );
});

test("a unit with no miniature keeps the photo on its card; Undo in the viewer redraws it", async ({
  page,
}) => {
  await seed(page, data());
  await nav(page, "queue");
  await page.getByRole("button", { name: "Add a photo of Hero" }).click();
  await addPhoto(page, await imageFile(page, "a.png", 400, 300));
  expect((await card(page, "b", "b1")).photo).toEqual(expect.any(String));
  // No miniature, so the photo is only the card's.
  await expect(page.locator("#toastText")).toHaveText(
    'Added the photo of "Hero"',
  );
  await expect(page.locator("#photoView figcaption")).toHaveCount(0);
  await page.click("#toastAction");
  expect(await card(page, "b", "b1")).not.toHaveProperty("photo");
  await expect(page.locator("#photoView")).toContainText(
    "No photo of this model yet",
  );
  await expect(page.locator("#addPhotos")).toHaveText("Add photo");
});

test("replacing a model's photo takes the old one's place in the miniature's", async ({
  page,
}) => {
  await seed(page, data({ photos: ["x", "old", "y"], p3: "old" }));
  await nav(page, "queue");
  await page.getByRole("button", { name: "Photo of Squad #3" }).click();
  await addPhoto(page, await imageFile(page, "a.png", 400, 300));
  const pid = (await card(page, "a", "a3")).photo;
  expect(pid).not.toBe("old");
  expect(await miniPhotos(page)).toEqual(["x", pid, "y"]);
  await expect(page.locator("#toastText")).toHaveText(
    'Replaced the photo of "Squad #3", in the photos of "Squad" too',
  );
});

test("removing a model's photo removes it from its miniature, and the other way round", async ({
  page,
}) => {
  await seed(page, data({ photos: ["x", "p3"], p1: "x", p3: "p3" }));
  await nav(page, "queue");
  // From the model: it comes off the miniature too.
  await page.getByRole("button", { name: "Photo of Squad #3" }).click();
  await page.click("#removePhoto");
  expect(await card(page, "a", "a3")).not.toHaveProperty("photo");
  expect(await miniPhotos(page)).toEqual(["x"]);
  await expect(page.locator("#toastText")).toHaveText(
    'Removed the photo of "Squad #3", from the photos of "Squad" too',
  );
  await expect(page.locator("#addPhotos")).toBeFocused();
  await page.click("#toastAction");
  expect((await card(page, "a", "a3")).photo).toBe("p3");
  expect(await miniPhotos(page)).toEqual(["x", "p3"]);
  await expect(page.locator("#removePhoto")).toBeEnabled();
  await page.click("#closePhotos");
  // From the miniature: the model loses it too.
  await nav(page, "miniatures");
  await page.locator('button[data-photos="m"]').click();
  await expect(page.locator("#photoView figcaption")).toHaveText(
    "Photo 1 of 2 · cover · Squad #1",
  );
  await page.click("#removePhoto");
  expect(await miniPhotos(page)).toEqual(["p3"]);
  expect(await card(page, "a", "a1")).not.toHaveProperty("photo");
  expect((await card(page, "a", "a3")).photo).toBe("p3");
});

test("backups and start-up tidying keep the models' photos", async ({
  page,
}) => {
  await page.evaluate(() => {
    const rec = (id) => ({
      id,
      type: "image/jpeg",
      full: new ArrayBuffer(4),
      thumb: new ArrayBuffer(4),
      added: 0, // long ago, so tidying would delete it if nothing used it
    });
    return putPhotos([rec("card"), rec("spare")]);
  });
  await seed(page, data({ p3: "card" })); // reloads the page, which tidies
  await expect
    .poll(() => page.evaluate(async () => (await allPhotos()).map((p) => p.id)))
    .toEqual(["card"]);
  expect(
    await page.evaluate(async () => Object.keys(await backupPhotos(db))),
  ).toEqual(["card"]);
});

test("a junk photo on a card is ignored", async ({ page }) => {
  await seed(page, data({ p3: { not: "an id" } }));
  await nav(page, "queue");
  await expect(
    page.getByRole("button", { name: "Add a photo of Squad #3" }),
  ).toBeVisible();
  expect(
    await page.evaluate(async () => Object.keys(await backupPhotos(db))),
  ).toEqual([]);
});
