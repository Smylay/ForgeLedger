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

const dialog = (page) => page.locator("#completeDialog");

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await seed(page, {
    miniatures: [
      {
        id: "m1",
        name: "Squad",
        quantity: "10",
        painted: "3",
        status: "In progress",
      },
      {
        id: "m2",
        name: "Done",
        quantity: "5",
        painted: "5",
        status: "Complete",
      },
    ],
    queue: [
      { id: "q1", name: "Squad", miniature: "m1", stage: "Basing" },
      { id: "q2", name: "Loose", miniature: "", stage: "Basing" },
      { id: "q3", name: "Done", miniature: "m2", stage: "Basing" },
    ],
  });
  await nav(page, "queue");
});

async function complete(page, queueIndex) {
  await page.locator("#queueContent button[data-edit]").nth(queueIndex).click();
  await fillForm(page, { stage: "Complete" });
  await submitForm(page);
}

test("queueing a miniature links the queue item to it", async ({ page }) => {
  await nav(page, "miniatures");
  await page.locator("button[data-queue]").first().click();
  expect((await stored(page)).queue.at(-1)).toMatchObject({
    name: "Squad",
    miniature: "m1",
  });
});

test("the queue form can link a miniature", async ({ page }) => {
  await page.locator("#queueContent button[data-edit]").nth(1).click();
  await fillForm(page, { miniature: "m1" });
  await submitForm(page);
  expect((await stored(page)).queue[1].miniature).toBe("m1");
});

test("completing a linked item asks; Apply updates the miniature only", async ({
  page,
}) => {
  await complete(page, 0);
  await expect(dialog(page)).toBeVisible();
  await expect(page.locator("#completeMiniLabel")).toHaveText(
    'Mark "Squad" complete, with 10 of 10 painted',
  );
  await expect(page.locator("#completeMini")).toBeChecked();
  await expect(page.locator("#completeRemove")).not.toBeChecked();
  await page.click('#completeDialog button[value="apply"]');

  const data = await stored(page);
  expect(data.miniatures[0]).toMatchObject({
    status: "Complete",
    painted: "10",
  });
  expect(data.queue.map((q) => q.id)).toEqual(["q1", "q2", "q3"]);
  expect(data.queue[0].stage).toBe("Complete");
  await expect(page.locator("#toastText")).toHaveText(
    'Marked "Squad" complete',
  );
});

test("Apply can also remove the item, and Undo reverts both", async ({
  page,
}) => {
  await complete(page, 0);
  await page.check("#completeRemove");
  await page.click('#completeDialog button[value="apply"]');
  let data = await stored(page);
  expect(data.queue.map((q) => q.id)).toEqual(["q2", "q3"]);
  expect(data.miniatures[0].status).toBe("Complete");
  await expect(page.locator("#toastText")).toHaveText(
    'Marked "Squad" complete and removed "Squad" from the queue',
  );

  await page.click("#toastAction");
  data = await stored(page);
  expect(data.queue.map((q) => q.id)).toEqual(["q1", "q2", "q3"]);
  // The stage edit itself stays, with the painted count it brought.
  expect(data.queue[0].stage).toBe("Complete");
  expect(data.miniatures[0]).toMatchObject({
    status: "In progress",
    painted: "10",
  });
});

test("Skip leaves the status; the painted count follows the queue", async ({
  page,
}) => {
  await complete(page, 0);
  await page.click('#completeDialog button[value="skip"]');
  const data = await stored(page);
  expect(data.miniatures[0]).toMatchObject({
    status: "In progress",
    painted: "10",
  });
  expect(data.queue).toHaveLength(3);
  expect(data.queue[0].stage).toBe("Complete");
});

test("an already-complete miniature can only be removed from the queue", async ({
  page,
}) => {
  await complete(page, 2);
  await expect(page.locator("#completeMiniLabel")).toHaveText(
    '"Done" is already marked complete',
  );
  await expect(page.locator("#completeMini")).toBeDisabled();
  await page.check("#completeRemove");
  await page.click('#completeDialog button[value="apply"]');
  expect((await stored(page)).queue.map((q) => q.id)).toEqual(["q1", "q2"]);
});

test("no prompt for an item with no linked miniature", async ({ page }) => {
  await complete(page, 1);
  await expect(dialog(page)).toBeHidden();
});

test("no prompt when an already-complete item is edited again", async ({
  page,
}) => {
  await complete(page, 0);
  await page.click('#completeDialog button[value="skip"]');
  await page.locator("#queueContent button[data-edit]").first().click();
  await fillForm(page, { notes: "touched up" });
  await submitForm(page);
  await expect(dialog(page)).toBeHidden();
});

test("deleting a miniature unlinks its queue items", async ({ page }) => {
  await nav(page, "miniatures");
  await page.locator("button[data-del]").first().click();
  await expect(page.locator("#toastText")).toHaveText(
    'Deleted "Squad" and unlinked 1 item(s) from it',
  );
  expect((await stored(page)).queue[0].miniature).toBe("");
});

test.describe("queueing starts from the miniature's progress", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, {
      miniatures: [
        { id: "u", name: "Loose", quantity: "5", status: "Unbuilt" },
        { id: "b", name: "Hero", quantity: "1", status: "Built" },
        { id: "p", name: "Squad", quantity: "11", status: "Primed" },
        { id: "w", name: "Busy", quantity: "3", status: "In progress" },
        {
          id: "h",
          name: "Half",
          quantity: "10",
          painted: "4",
          status: "Primed",
        },
        {
          id: "c",
          name: "Done",
          quantity: "2",
          painted: "2",
          status: "Complete",
        },
        { id: "x", name: "Odd", quantity: "3", status: "constructor" },
      ],
    });
    await nav(page, "miniatures");
  });
  const queue = async (page, mid) => {
    await page.locator(`tr[data-row="${mid}"] button[data-queue]`).click();
    return (await stored(page)).queue.at(-1);
  };

  test("its status sets the starting stage", async ({ page }) => {
    expect(await queue(page, "u")).toMatchObject({ stage: "Not started" });
    expect(await queue(page, "b")).toMatchObject({ stage: "Priming" });
    expect(await queue(page, "p")).toMatchObject({ stage: "Basecoating" });
    await expect(page.locator("#toastText")).toHaveText(
      'Added "Squad" to the queue: Basecoating',
    );
    expect(await queue(page, "w")).toMatchObject({ stage: "Basecoating" });
    // Already complete: no prompt, since nothing was just finished.
    expect(await queue(page, "c")).toMatchObject({ stage: "Complete" });
    await expect(dialog(page)).toBeHidden();
    // A status it doesn't know starts at the beginning.
    const odd = await queue(page, "x");
    expect(odd.stage).toBe("Not started");
    expect(odd.split).toBeUndefined();
  });

  test("painted models start at Complete, splitting the item", async ({
    page,
  }) => {
    expect(await queue(page, "h")).toMatchObject({
      split: { Basecoating: 6, Complete: 4 },
      stage: "Basecoating",
      stageDone: 4,
    });
    await expect(page.locator("#toastText")).toHaveText(
      'Added "Half" to the queue: Basecoating 6 · Complete 4',
    );
    await nav(page, "queue");
    await expect(
      page.locator("#queueContent .qitem").last().locator(".splitrow"),
    ).toContainText("Basecoating 6");
  });

  test("Undo takes it off the queue", async ({ page }) => {
    const before = (await stored(page)).queue.length;
    await queue(page, "p");
    await page.click("#toastAction");
    expect((await stored(page)).queue).toHaveLength(before);
  });

  test("renamed stages are found by name", async ({ page }) => {
    await seed(page, {
      queueStages: ["Assembly", "Undercoat", "Paint", "Varnish"],
      miniatures: [
        { id: "b", name: "Hero", quantity: "1", status: "Built" },
        { id: "p", name: "Squad", quantity: "5", status: "Primed" },
      ],
    });
    await nav(page, "miniatures");
    // Built: after Assembly. Primed: no priming stage, so after Assembly too.
    expect(await queue(page, "b")).toMatchObject({ stage: "Undercoat" });
    expect(await queue(page, "p")).toMatchObject({ stage: "Undercoat" });
  });
});

test.describe("the queue keeps the miniature in step", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, {
      miniatures: [
        { id: "k", name: "Knights", quantity: "3", status: "Unbuilt" },
        { id: "x", name: "Odd", quantity: "2", status: "constructor" },
      ],
      queue: [
        { id: "a", name: "Knights", miniature: "k", stage: "Building" },
        { id: "b", name: "Loose", stage: "Building" },
        { id: "c", name: "Odd", miniature: "x", stage: "Priming" },
      ],
    });
    await nav(page, "queue");
  });
  const item = (page, i) => page.locator("#queueContent .qitem").nth(i);
  const knights = async (page) =>
    (await stored(page)).miniatures.find((m) => m.id === "k");

  test("Built, Primed, then In progress, as the item moves on", async ({
    page,
  }) => {
    await item(page, 0).locator("button[data-next]").click();
    expect(await knights(page)).toMatchObject({ status: "Built" });
    await expect(page.locator("#toastText")).toHaveText(
      'Moved "Knights" to Priming; miniature "Knights" is now Built',
    );
    await item(page, 0).locator("button[data-next]").click();
    expect(await knights(page)).toMatchObject({ status: "Primed" });
    // One model basecoated: painting has started.
    await item(page, 0).locator("button[data-plus]").click();
    expect(await knights(page)).toMatchObject({ status: "In progress" });
    // Undo puts both back.
    await page.click("#toastAction");
    expect(await knights(page)).toMatchObject({ status: "Primed" });
    expect((await stored(page)).queue[0].stageDone).toBe(0);
  });

  test("going back never lowers it", async ({ page }) => {
    await item(page, 0).locator("button[data-next]").click(); // Built
    await item(page, 0).locator("button[data-back]").click();
    expect(await knights(page)).toMatchObject({ status: "Built" });
    expect((await stored(page)).queue[0].stage).toBe("Building");
  });

  test("models at Complete raise the painted count, never Complete itself", async ({
    page,
  }) => {
    await item(page, 0).locator("button[data-edit]").click();
    await fillForm(page, { stage: "Basing" });
    await submitForm(page);
    await expect(page.locator("#toastText")).toHaveText(
      'Saved; miniature "Knights" is now In progress',
    );
    await item(page, 0).locator("button[data-split]").click();
    await item(page, 0)
      .getByRole("button", { name: "Move 1 to Complete from Basing" })
      .click();
    expect(await knights(page)).toMatchObject({
      status: "In progress",
      painted: "1",
    });
    await expect(page.locator("#toastText")).toContainText(
      'miniature "Knights" now has 1 painted',
    );
  });

  test("an item without a miniature, or a status it doesn't know, is safe", async ({
    page,
  }) => {
    await item(page, 1).locator("button[data-next]").click();
    await expect(page.locator("#toastText")).toHaveText(
      'Moved "Loose" to Priming',
    );
    // A junk status counts as below Unbuilt, so the queue replaces it.
    await item(page, 2).locator("button[data-next]").click();
    expect(
      (await stored(page)).miniatures.find((m) => m.id === "x").status,
    ).toBe("Primed");
  });

  test("stages that don't say build or prime leave the status alone", async ({
    page,
  }) => {
    await seed(page, {
      queueStages: ["Clean", "Paint"],
      miniatures: [{ id: "k", name: "Knights", quantity: "1", status: "" }],
      queue: [{ id: "a", name: "Knights", miniature: "k", stage: "Clean" }],
    });
    await nav(page, "queue");
    await item(page, 0).locator("button[data-next]").click();
    expect((await knights(page)).status).toBe("");
    // The painted count still follows.
    await item(page, 0).locator("button[data-next]").click();
    await page.click('#completeDialog button[value="skip"]');
    expect(await knights(page)).toMatchObject({ status: "", painted: "1" });
  });
});
