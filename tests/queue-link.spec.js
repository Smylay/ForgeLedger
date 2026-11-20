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
  expect(data.queue[0].stage).toBe("Complete"); // the stage edit itself stays
  expect(data.miniatures[0]).toMatchObject({
    status: "In progress",
    painted: "3",
  });
});

test("Skip changes nothing beyond the stage", async ({ page }) => {
  await complete(page, 0);
  await page.click('#completeDialog button[value="skip"]');
  const data = await stored(page);
  expect(data.miniatures[0].status).toBe("In progress");
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
