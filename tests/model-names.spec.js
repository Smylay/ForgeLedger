// Naming models on the board: a model's number (#3) is a button that turns
// into a box to rename it, and its name is used wherever the model is.
const { test, expect, openApp, seed, stored, nav } = require("./helpers");

const col = (page, phase) =>
  page.locator(`#queueContent .phase[data-phase="${phase}"]`);
const card = async (page, cid) =>
  (await stored(page)).queue[0].cards.find((c) => c.id === cid);

const data = {
  miniatures: [{ id: "m", name: "Squad", quantity: "3", status: "Built" }],
  queue: [
    {
      id: "a",
      name: "Squad",
      miniature: "m",
      cards: [
        { id: "a1", phase: "Priming" },
        { id: "a2", phase: "Priming" },
        { id: "a3", phase: "Painting" },
      ],
    },
  ],
};

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await seed(page, data);
  await nav(page, "queue");
  await page.locator('[data-unit="a"][data-from="Priming"]').click();
});

test("a model's number renames it, with Undo", async ({ page }) => {
  const label = page.getByRole("button", { name: "Rename Squad #2" });
  await expect(label).toHaveText("#2");
  await label.click();
  const box = page.getByRole("textbox", { name: "Name of Squad #2" });
  await expect(box).toBeFocused();
  await expect(box).toHaveAttribute("placeholder", "#2");
  await box.fill("  Sergeant Kael  ");
  await box.press("Enter");
  expect((await card(page, "a2")).name).toBe("Sergeant Kael");
  await expect(page.locator("#toastText")).toHaveText(
    'Renamed Squad #2 to "Sergeant Kael"',
  );
  const named = page.getByRole("button", {
    name: "Rename Sergeant Kael (Squad)",
  });
  await expect(named).toHaveText("Sergeant Kael");
  await expect(named).toBeFocused();
  // Its other buttons use the name too.
  await expect(
    page.getByRole("button", {
      name: "Move Sergeant Kael (Squad) on to Painting",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add a photo of Sergeant Kael (Squad)" }),
  ).toBeVisible();
  await page.click("#toastAction");
  expect(await card(page, "a2")).not.toHaveProperty("name");
  await expect(
    page.getByRole("button", { name: "Rename Squad #2" }),
  ).toBeVisible();
});

test("Esc keeps the old name; a blank name brings the number back", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Rename Squad #1" }).click();
  await page.getByRole("textbox", { name: "Name of Squad #1" }).fill("Kael");
  await page.keyboard.press("Escape");
  expect(await card(page, "a1")).not.toHaveProperty("name");
  await expect(
    page.getByRole("button", { name: "Rename Squad #1" }),
  ).toBeFocused();

  // Leaving the box saves too.
  await page.getByRole("button", { name: "Rename Squad #1" }).click();
  await page.getByRole("textbox", { name: "Name of Squad #1" }).fill("Kael");
  await page.locator("#queueHint").click();
  expect((await card(page, "a1")).name).toBe("Kael");

  await page.getByRole("button", { name: "Rename Kael (Squad)" }).click();
  await page.getByRole("textbox", { name: "Name of Kael (Squad)" }).fill("");
  await page.keyboard.press("Enter");
  expect(await card(page, "a1")).not.toHaveProperty("name");
  await expect(page.locator("#toastText")).toHaveText(
    "Kael (Squad) has its number again",
  );
  // Nothing changed: no save, no toast.
  await page.getByRole("button", { name: "Rename Squad #1" }).click();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("button", { name: "Rename Squad #1" }),
  ).toBeFocused();
});

test("one model of several in a column is named on the unit's heading", async ({
  page,
}) => {
  const head = col(page, "Painting").locator(".unithead");
  await expect(head.locator(".unitname")).toHaveText("Squad #3");
  await head.getByRole("button", { name: "Rename Squad #3" }).click();
  await page.keyboard.type("Banner");
  await page.keyboard.press("Enter");
  await expect(head.locator(".unitname")).toHaveText("Squad Banner");
  // Moving it names it.
  await head
    .getByRole("button", { name: "Move Banner (Squad) back to Priming" })
    .click();
  await expect(page.locator("#toastText")).toHaveText(
    'Moved "Banner" of "Squad" to Priming',
  );
});

test("a model's name is used in its photo viewer", async ({ page }) => {
  await page.getByRole("button", { name: "Rename Squad #1" }).click();
  await page.keyboard.type("Kael");
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Add a photo of Kael (Squad)" })
    .click();
  await expect(page.locator("#photosTitle")).toHaveText(
    'Photo of "Kael (Squad)"',
  );
});

test("dragging a model by its name still moves it", async ({ page }) => {
  const label = page.getByRole("button", { name: "Rename Squad #1" });
  const target = col(page, "Detailing");
  const from = await label.boundingBox();
  const to = await target.boundingBox();
  await page.mouse.move(from.x + 10, from.y + 10);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + 20, { steps: 4 });
  await page.mouse.move(to.x + 40, to.y + 60, { steps: 8 });
  await page.mouse.up();
  expect((await card(page, "a1")).phase).toBe("Detailing");
  // The drag didn't start a rename.
  await expect(page.locator("#queueContent input.mrename")).toHaveCount(0);
});

test("stored names that aren't text, or are too long, are made safe", async ({
  page,
}) => {
  await seed(page, {
    ...data,
    queue: [
      {
        ...data.queue[0],
        cards: [
          { id: "a1", phase: "Priming", name: { not: "text" } },
          { id: "a2", phase: "Priming", name: "x".repeat(100) },
          { id: "a3", phase: "Painting" },
        ],
      },
    ],
  });
  await nav(page, "queue");
  await page.locator('[data-unit="a"][data-from="Priming"]').click();
  await expect(
    page.getByRole("button", { name: "Rename Squad #1" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: `Rename ${"x".repeat(40)} (Squad)` }),
  ).toBeVisible();
});
