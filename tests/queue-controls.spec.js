// Queue controls: next stage, stage progress, +1 painted, move to top and
// drag to reorder.
const { test, expect, openApp, seed, stored, nav } = require("./helpers");

const item = (page, i) => page.locator("#queueContent .qitem").nth(i);
const order = async (page) => (await stored(page)).queue.map((q) => q.name);
const shown = (page) =>
  page
    .locator("#queueContent .qitem b")
    .evaluateAll((els) => els.map((e) => e.textContent));

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await seed(page, {
    schemaVersion: 2,
    miniatures: [
      { id: "m1", name: "Squad", quantity: "3", painted: "1" },
      { id: "m2", name: "Loose", quantity: "", painted: "4" },
    ],
    queue: [
      { id: "a", name: "Squad", miniature: "m1", stage: "Basing" },
      { id: "b", name: "Hero", stage: "" },
      { id: "c", name: "Loose", miniature: "m2", stage: "Priming" },
      { id: "d", name: "Done", stage: "Complete" },
    ],
  });
  await nav(page, "queue");
});

test.describe("next stage", () => {
  test("names the next stage and moves to it, with Undo", async ({ page }) => {
    const next = item(page, 1).locator("button[data-next]");
    await expect(next).toHaveText("Next: Building");
    await next.click();
    expect((await stored(page)).queue[1].stage).toBe("Building");
    await expect(page.locator("#toastText")).toHaveText(
      'Moved "Hero" to Building',
    );
    await expect(item(page, 1).locator("button[data-next]")).toHaveText(
      "Next: Priming",
    );
    await page.click("#toastAction");
    expect((await stored(page)).queue[1].stage).toBe("");
  });

  test("keeps keyboard focus on the button", async ({ page }) => {
    await item(page, 1).locator("button[data-next]").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    expect((await stored(page)).queue[1].stage).toBe("Priming");
    await expect(item(page, 1).locator("button[data-next]")).toBeFocused();
  });

  test("reaching Complete asks about the linked miniature", async ({
    page,
  }) => {
    await item(page, 0).locator("button[data-next]").click();
    await expect(page.locator("#completeDialog")).toBeVisible();
    await page.click('#completeDialog button[value="apply"]');
    expect((await stored(page)).miniatures[0]).toMatchObject({
      status: "Complete",
      painted: "3",
    });
  });

  test("a complete item has no next stage", async ({ page }) => {
    await expect(item(page, 3).locator("button[data-next]")).toHaveCount(0);
  });
});

test("the progress bar shows how far through the stages an item is", async ({
  page,
}) => {
  const bars = page.locator("#queueContent [role=progressbar]");
  await expect(bars).toHaveCount(4);
  const values = await bars.evaluateAll((els) =>
    els.map((e) => [
      e.getAttribute("aria-valuenow"),
      e.getAttribute("aria-valuetext"),
      e.querySelectorAll(".on").length,
    ]),
  );
  expect(values).toEqual([
    ["5", "Basing, step 5 of 6", 5],
    ["0", "Not started, step 0 of 6", 0],
    ["2", "Priming, step 2 of 6", 2],
    ["6", "Complete, step 6 of 6", 6],
  ]);
  await expect(bars.first()).toHaveAttribute("aria-label", "Progress of Squad");
});

test.describe("+1 painted", () => {
  test("counts up on the linked miniature, with Undo", async ({ page }) => {
    const plus = item(page, 0).locator("button[data-plus]");
    await expect(item(page, 0)).toContainText("Painted: 1 of 3");
    await plus.click();
    expect((await stored(page)).miniatures[0].painted).toBe("2");
    await expect(item(page, 0)).toContainText("Painted: 2 of 3");
    await expect(page.locator("#toastText")).toHaveText(
      "Squad: 2 of 3 painted",
    );
    await page.click("#toastAction");
    expect((await stored(page)).miniatures[0].painted).toBe("1");
  });

  test("stops at the model count", async ({ page }) => {
    const plus = item(page, 0).locator("button[data-plus]");
    await plus.click();
    await item(page, 0).locator("button[data-plus]").click();
    expect((await stored(page)).miniatures[0].painted).toBe("3");
    await expect(item(page, 0).locator("button[data-plus]")).toBeDisabled();
    // Focus moves on to the next stage button once +1 is used up.
    await expect(item(page, 0).locator("button[data-next]")).toBeFocused();
  });

  test("has no limit when the miniature has no model count", async ({
    page,
  }) => {
    await item(page, 2).locator("button[data-plus]").click();
    expect((await stored(page)).miniatures[1].painted).toBe("5");
    await expect(item(page, 2)).toContainText("Painted: 5");
  });

  test("only appears on items linked to a miniature", async ({ page }) => {
    await expect(item(page, 1).locator("button[data-plus]")).toHaveCount(0);
  });
});

test.describe("reordering", () => {
  test("Top moves an item to the front and keeps focus", async ({ page }) => {
    await item(page, 2).locator("button[data-top]").focus();
    await page.keyboard.press("Enter");
    expect(await order(page)).toEqual(["Loose", "Squad", "Hero", "Done"]);
    await expect(item(page, 0).locator("button[data-top]")).toBeFocused();
  });

  test("the arrows keep focus on the item that moved", async ({ page }) => {
    await item(page, 1).locator("button[data-down]").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    expect(await order(page)).toEqual(["Squad", "Loose", "Done", "Hero"]);
    await expect(item(page, 3).locator("button[data-down]")).toBeFocused();
  });

  async function drag(page, from, to, where) {
    const handle = await item(page, from).locator(".handle").boundingBox();
    const target = await item(page, to).boundingBox();
    const y = where === "above" ? target.y + 4 : target.y + target.height - 4;
    await page.mouse.move(
      handle.x + handle.width / 2,
      handle.y + handle.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(handle.x + handle.width / 2, y, { steps: 8 });
    await page.mouse.up();
  }

  test("dragging an item up moves it there", async ({ page }) => {
    await drag(page, 3, 0, "above");
    expect(await order(page)).toEqual(["Done", "Squad", "Hero", "Loose"]);
    expect(await shown(page)).toEqual(["Done", "Squad", "Hero", "Loose"]);
  });

  test("dragging an item down moves it there", async ({ page }) => {
    await drag(page, 0, 2, "below");
    expect(await order(page)).toEqual(["Hero", "Loose", "Squad", "Done"]);
  });

  test("dragging to the end works", async ({ page }) => {
    await drag(page, 1, 3, "below");
    expect(await order(page)).toEqual(["Squad", "Loose", "Done", "Hero"]);
  });

  test("dropping where it started changes nothing", async ({ page }) => {
    await drag(page, 1, 1, "above");
    expect(await order(page)).toEqual(["Squad", "Hero", "Loose", "Done"]);
  });

  test("a drag shows where the item will land", async ({ page }) => {
    const handle = await item(page, 3).locator(".handle").boundingBox();
    const target = await item(page, 1).boundingBox();
    await page.mouse.move(handle.x + 5, handle.y + 5);
    await page.mouse.down();
    await page.mouse.move(handle.x + 5, target.y + 4, { steps: 6 });
    await expect(item(page, 3)).toHaveClass(/dragging/);
    await expect(item(page, 1)).toHaveClass(/drop-before/);
    await page.mouse.up();
    await expect(
      page.locator(".drop-before, .drop-after, .dragging"),
    ).toHaveCount(0);
  });
});
