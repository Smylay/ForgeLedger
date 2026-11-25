// Queue controls: next stage, stage progress, +1 done (counted per stage),
// going back (-1 and Back), move to top and drag to reorder.
const {
  test,
  expect,
  openApp,
  seed,
  stored,
  nav,
  fillForm,
  submitForm,
} = require("./helpers");

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
      // Statuses that match the queue, so only the tests about keeping
      // the miniature in step (queue-link.spec.js) see it change.
      {
        id: "m1",
        name: "Squad",
        quantity: "3",
        painted: "1",
        status: "In progress",
      },
      {
        id: "m2",
        name: "Loose",
        quantity: "",
        painted: "4",
        status: "Primed",
      },
    ],
    queue: [
      // Squad's total comes from its miniature (3), Hero's from its own
      // model count (2), Loose's falls back to 1.
      {
        id: "a",
        name: "Squad",
        miniature: "m1",
        stage: "Basing",
        stageDone: 1,
      },
      { id: "b", name: "Hero", stage: "", models: "2" },
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

test("the progress bar fills finished stages and the current one's count", async ({
  page,
}) => {
  const bars = page.locator("#queueContent [role=progressbar]");
  await expect(bars).toHaveCount(4);
  const values = await bars.evaluateAll((els) =>
    els.map((e) => [
      e.getAttribute("aria-valuenow"),
      e.getAttribute("aria-valuetext"),
      [...e.querySelectorAll("i")].map((i) => i.style.width).join(" "),
    ]),
  );
  expect(values).toEqual([
    ["5", "Basing: 1 of 3 done, step 5 of 6", "100% 100% 100% 100% 33% 0%"],
    ["0", "Not started, step 0 of 6", "0% 0% 0% 0% 0% 0%"],
    ["2", "Priming: 0 of 1 done, step 2 of 6", "100% 0% 0% 0% 0% 0%"],
    ["6", "Complete, step 6 of 6", "100% 100% 100% 100% 100% 100%"],
  ]);
  await expect(bars.first()).toHaveAttribute("aria-label", "Progress of Squad");
});

test.describe("+1 done", () => {
  const plus = (page, i) => item(page, i).locator("button[data-plus]");

  test("counts models done in the current stage, with Undo", async ({
    page,
  }) => {
    await expect(item(page, 0)).toContainText("Basing: 1 of 3 done");
    await plus(page, 0).click();
    let q = (await stored(page)).queue[0];
    expect(q).toMatchObject({ stage: "Basing", stageDone: 2 });
    await expect(item(page, 0)).toContainText("Basing: 2 of 3 done");
    // Basing is the last stage, so models done there are painted, and the
    // miniature's painted count follows.
    await expect(page.locator("#toastText")).toHaveText(
      '"Squad": Basing 2 of 3 done; miniature "Squad" now has 2 painted',
    );
    expect((await stored(page)).miniatures[0].painted).toBe("2");
    await page.click("#toastAction");
    expect((await stored(page)).queue[0].stageDone).toBe(1);
    expect((await stored(page)).miniatures[0].painted).toBe("1");
  });

  test("the last model moves the item on and its count starts again", async ({
    page,
  }) => {
    await plus(page, 2).click();
    expect((await stored(page)).queue[2]).toMatchObject({
      stage: "Basecoating",
      stageDone: 0,
    });
    await expect(page.locator("#toastText")).toHaveText(
      '"Loose": Priming done, moved to Basecoating',
    );
    await expect(item(page, 2)).toContainText("Basecoating: 0 of 1 done");
    await page.click("#toastAction");
    expect((await stored(page)).queue[2].stage).toBe("Priming");
  });

  test("from Not started, +1 starts the first stage", async ({ page }) => {
    await expect(plus(page, 1)).toHaveAttribute(
      "aria-label",
      "+1 done in Building for Hero",
    );
    await plus(page, 1).click();
    expect((await stored(page)).queue[1]).toMatchObject({
      stage: "Building",
      stageDone: 1,
    });
    await expect(item(page, 1)).toContainText("Building: 1 of 2 done");
  });

  test("finishing the last stage asks about the miniature", async ({
    page,
  }) => {
    await plus(page, 0).click();
    await plus(page, 0).click();
    expect((await stored(page)).queue[0].stage).toBe("Complete");
    await expect(page.locator("#completeDialog")).toBeVisible();
  });

  test("Next stage starts the count again", async ({ page }) => {
    await plus(page, 1).click(); // Hero: Building 1 of 2
    await item(page, 1).locator("button[data-next]").click();
    expect((await stored(page)).queue[1]).toMatchObject({
      stage: "Priming",
      stageDone: 0,
    });
    await expect(item(page, 1)).toContainText("Priming: 0 of 2 done");
  });

  test("editing keeps the count; changing the stage resets it", async ({
    page,
  }) => {
    await item(page, 0).locator("button[data-edit]").click();
    await fillForm(page, { notes: "edge highlight next" });
    await submitForm(page);
    expect((await stored(page)).queue[0]).toMatchObject({
      stageDone: 1,
      notes: "edge highlight next",
    });
    await item(page, 0).locator("button[data-edit]").click();
    await fillForm(page, { stage: "Detailing" });
    await submitForm(page);
    expect((await stored(page)).queue[0]).toMatchObject({
      stage: "Detailing",
      stageDone: 0,
    });
  });

  test("keeps keyboard focus on the button", async ({ page }) => {
    await plus(page, 0).focus();
    await page.keyboard.press("Enter");
    await expect(plus(page, 0)).toBeFocused();
  });

  test("is on every unfinished item, linked or not", async ({ page }) => {
    await expect(plus(page, 1)).toHaveText("+1 done");
    await expect(plus(page, 3)).toHaveCount(0); // Complete
  });
});

test.describe("going back", () => {
  const minus = (page, i) => item(page, i).locator("button[data-minus]");
  const back = (page, i) => item(page, i).locator("button[data-back]");
  const plus = (page, i) => item(page, i).locator("button[data-plus]");

  test("Back returns to the previous stage, with Undo", async ({ page }) => {
    await expect(back(page, 0)).toHaveText("Back: Detailing");
    await expect(back(page, 0)).toHaveAccessibleName(
      "Back: Detailing for Squad",
    );
    await back(page, 0).click();
    expect((await stored(page)).queue[0]).toMatchObject({
      stage: "Detailing",
      stageDone: 0,
    });
    await expect(page.locator("#toastText")).toHaveText(
      'Moved "Squad" back to Detailing',
    );
    await expect(item(page, 0)).toContainText("Detailing: 0 of 3 done");
    await expect(back(page, 0)).toBeFocused();
    await page.click("#toastAction");
    expect((await stored(page)).queue[0]).toMatchObject({
      stage: "Basing",
      stageDone: 1,
    });
  });

  test("−1 takes back one done, then the +1 that moved it on", async ({
    page,
  }) => {
    await expect(minus(page, 0)).toHaveText("−1 done");
    await expect(minus(page, 0)).toHaveAccessibleName("−1 done for Squad");
    await minus(page, 0).click();
    expect((await stored(page)).queue[0]).toMatchObject({
      stage: "Basing",
      stageDone: 0,
    });
    await expect(page.locator("#toastText")).toHaveText(
      '"Squad": Basing 0 of 3 done',
    );
    await expect(minus(page, 0)).toBeFocused();
    // None done here: back to Detailing, with all but one model done.
    await page.keyboard.press("Enter");
    expect((await stored(page)).queue[0]).toMatchObject({
      stage: "Detailing",
      stageDone: 2,
    });
    await expect(item(page, 0)).toContainText("Detailing: 2 of 3 done");
  });

  test("−1 undoes +1 exactly", async ({ page }) => {
    // Loose has one model, so +1 moves it on.
    await plus(page, 2).click();
    expect((await stored(page)).queue[2].stage).toBe("Basecoating");
    await minus(page, 2).click();
    expect((await stored(page)).queue[2]).toMatchObject({
      stage: "Priming",
      stageDone: 0,
    });
  });

  test("from the first stage, −1 goes back to Not started", async ({
    page,
  }) => {
    await plus(page, 1).click(); // Hero: Building 1 of 2
    await minus(page, 1).click();
    await minus(page, 1).click();
    expect((await stored(page)).queue[1]).toMatchObject({
      stage: "Not started",
      stageDone: 0,
    });
    await expect(page.locator("#toastText")).toHaveText(
      '"Hero": back to Not started',
    );
    // Nothing to go back to now; focus moves to +1.
    await expect(minus(page, 1)).toHaveCount(0);
    await expect(back(page, 1)).toHaveCount(0);
    await expect(plus(page, 1)).toBeFocused();
  });

  test("a complete item can go back", async ({ page }) => {
    await expect(back(page, 3)).toHaveText("Back: Basing");
    await back(page, 3).click();
    expect((await stored(page)).queue[3]).toMatchObject({
      stage: "Basing",
      stageDone: 0,
    });
    await expect(item(page, 3).locator("button[data-next]")).toHaveText(
      "Next: Complete",
    );
  });

  test("from Complete, −1 leaves all but one model done", async ({ page }) => {
    await plus(page, 0).click();
    await plus(page, 0).click(); // Squad: Complete
    await page.click('#completeDialog button[value="skip"]');
    await minus(page, 0).click();
    expect((await stored(page)).queue[0]).toMatchObject({
      stage: "Basing",
      stageDone: 2,
    });
    await expect(page.locator("#completeDialog")).toBeHidden();
  });

  test("Not started has nothing to go back to", async ({ page }) => {
    await expect(minus(page, 1)).toHaveCount(0);
    await expect(back(page, 1)).toHaveCount(0);
  });
});

test.describe("reordering", () => {
  // Tall enough that every item's handle is on screen: a drag can't start
  // below the window.
  test.use({ viewport: { width: 1280, height: 1000 } });

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
