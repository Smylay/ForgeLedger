// The painting board: a column per phase, units with their model cards,
// moving them with ◀ ▶ or by dragging, the List view, Edit board, the queue
// item form, and 1.x queues becoming model cards.
const {
  test,
  reload,
  expect,
  openApp,
  seed,
  stored,
  nav,
  fillForm,
  submitForm,
} = require("./helpers");

const col = (page, phase) =>
  page.locator(`#queueContent .phase[data-phase="${phase}"]`);
const head = (page, phase, name) =>
  col(page, phase).locator(".unithead", { hasText: name });
const phases = async (page, qid) =>
  (await stored(page)).queue
    .find((q) => q.id === qid)
    .cards.map((c) => c.phase);
const order = async (page) => (await stored(page)).queue.map((q) => q.name);

const data = {
  miniatures: [
    { id: "m", name: "Squad", quantity: "3", painted: "0", status: "Built" },
  ],
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
    { id: "b", name: "Hero", cards: [{ id: "b1", phase: "To do" }] },
    { id: "c", name: "Finished", cards: [{ id: "c1", phase: "Done" }] },
  ],
};

test.beforeEach(async ({ page }) => {
  await openApp(page);
  await seed(page, data);
  await nav(page, "queue");
});

test("a column per phase, with units in priority order and their counts", async ({
  page,
}) => {
  await expect(page.locator("#queueContent .phase h3")).toHaveText([
    "To do 1",
    "Building 0",
    "Priming 2",
    "Painting 1",
    "Detailing 0",
    "Done 1",
  ]);
  await expect(col(page, "Priming").locator(".unitname")).toHaveText([
    "Squad 2",
  ]);
  await expect(col(page, "Building")).toContainText("No models");
  // A unit of one has no list to open; To do has no ◀ and Done no ▶.
  await expect(head(page, "To do", "Hero").locator("button")).toHaveCount(1);
  await expect(
    head(page, "To do", "Hero").getByRole("button", {
      name: "Move Hero on to Building",
    }),
  ).toBeVisible();
  await expect(
    head(page, "Done", "Finished").getByRole("button", {
      name: "Move Finished back to Detailing",
    }),
  ).toBeVisible();
});

test("▶ moves a unit's models in a phase on, with Undo; focus follows", async ({
  page,
}) => {
  await head(page, "Priming", "Squad")
    .getByRole("button", { name: "Move all 2 of Squad on to Painting" })
    .click();
  expect(await phases(page, "a")).toEqual(["Painting", "Painting", "Painting"]);
  // Every model is past priming now, so the miniature follows.
  await expect(page.locator("#toastText")).toHaveText(
    'Moved 2 models of "Squad" to Painting; miniature "Squad" is now Primed',
  );
  await expect(
    head(page, "Painting", "Squad").getByRole("button", {
      name: "Move all 3 of Squad on to Detailing",
    }),
  ).toBeFocused();
  await page.click("#toastAction");
  expect(await phases(page, "a")).toEqual(["Priming", "Priming", "Painting"]);
  expect((await stored(page)).miniatures[0].status).toBe("Built");
});

test("◀ moves back just as freely", async ({ page }) => {
  await head(page, "Done", "Finished")
    .getByRole("button", { name: "Move Finished back to Detailing" })
    .click();
  expect(await phases(page, "c")).toEqual(["Detailing"]);
});

test("opening a unit shows its models, each with its own arrows", async ({
  page,
}) => {
  const name = head(page, "Priming", "Squad").locator("button.unitname");
  await expect(name).toHaveAttribute("aria-expanded", "false");
  await name.click();
  await expect(name).toHaveAttribute("aria-expanded", "true");
  const cards = col(page, "Priming").locator(".mcard");
  await expect(cards.locator(".mname")).toHaveText(["#1", "#2"]);
  await cards
    .nth(1)
    .getByRole("button", { name: "Move Squad #2 on to Painting" })
    .click();
  expect(await phases(page, "a")).toEqual(["Priming", "Painting", "Painting"]);
  await expect(page.locator("#toastText")).toHaveText(
    'Moved 1 model of "Squad" to Painting',
  );
  // It stays in view, open in its new phase, and keeps focus.
  await expect(
    col(page, "Painting").getByRole("button", {
      name: "Move Squad #2 on to Detailing",
    }),
  ).toBeFocused();
  await expect(col(page, "Painting").locator(".mcard .mname")).toHaveText([
    "#2",
    "#3",
  ]);
});

test.describe("dragging", () => {
  async function drag(page, from, phase) {
    const a = await from.boundingBox(),
      b = await col(page, phase).boundingBox();
    await page.mouse.move(a.x + 8, a.y + a.height / 2);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width / 2, b.y + 60, { steps: 8 });
    await page.mouse.up();
  }

  test("a unit's heading moves all its models in that phase", async ({
    page,
  }) => {
    await drag(page, head(page, "Priming", "Squad"), "Building");
    expect(await phases(page, "a")).toEqual([
      "Building",
      "Building",
      "Painting",
    ]);
  });

  test("a model card moves just that model", async ({ page }) => {
    await head(page, "Priming", "Squad").locator("button.unitname").click();
    await drag(page, col(page, "Priming").locator(".mcard").first(), "Done");
    expect(await phases(page, "a")).toEqual(["Done", "Priming", "Painting"]);
  });

  test("the phase under the pointer is highlighted, and a copy follows", async ({
    page,
  }) => {
    const a = await head(page, "To do", "Hero").boundingBox(),
      b = await col(page, "Priming").boundingBox();
    await page.mouse.move(a.x + 8, a.y + 10);
    await page.mouse.down();
    await page.mouse.move(b.x + 20, b.y + 60, { steps: 6 });
    await expect(col(page, "Priming")).toHaveClass(/drop/);
    await expect(page.locator("body > .ghost")).toHaveCount(1);
    await page.mouse.up();
    await expect(page.locator(".drop, .ghost, .dragging")).toHaveCount(0);
    expect(await phases(page, "b")).toEqual(["Priming"]);
  });

  test("dropping where it started, or a plain click, moves nothing", async ({
    page,
  }) => {
    await drag(page, head(page, "To do", "Hero"), "To do");
    expect(await phases(page, "b")).toEqual(["To do"]);
    // A click on a unit's name opens it; a drag from it doesn't.
    const name = head(page, "Priming", "Squad").locator("button.unitname");
    await drag(page, name, "Priming");
    await expect(name).toHaveAttribute("aria-expanded", "false");
  });
});

test("the last model reaching Done asks about its miniature", async ({
  page,
}) => {
  await seed(page, {
    miniatures: [{ id: "m", name: "Squad", quantity: "2", status: "Built" }],
    queue: [
      {
        id: "a",
        name: "Squad",
        miniature: "m",
        cards: [
          { id: "a1", phase: "Detailing" },
          { id: "a2", phase: "Done" },
        ],
      },
    ],
  });
  await nav(page, "queue");
  await head(page, "Detailing", "Squad")
    .getByRole("button", { name: "Move Squad on to Done" })
    .click();
  await expect(page.locator("#completeDialog")).toBeVisible();
  await expect(page.locator("#completeText")).toHaveText(
    'Every model of "Squad" is done. What else should change?',
  );
  await page.click('#completeDialog button[value="apply"]');
  expect((await stored(page)).miniatures[0]).toMatchObject({
    status: "Complete",
    painted: "2",
  });
});

test.describe("the list", () => {
  // Tall enough that every item's handle is on screen: a drag can't start
  // below the window.
  test.use({ viewport: { width: 1280, height: 1000 } });
  const item = (page, i) => page.locator("#queueContent .qitem").nth(i);
  test.beforeEach(async ({ page }) => page.click('[data-qview="list"]'));

  test("shows each unit's models by phase, and the choice is kept", async ({
    page,
  }) => {
    await expect(page.locator('[data-qview="list"]')).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.locator("#queueContent .qcounts")).toHaveText([
      "Priming 2 · Painting 1",
      "To do 1",
      "Done 1",
    ]);
    await expect(item(page, 0).locator("[role=progressbar]")).toHaveAttribute(
      "aria-valuetext",
      "Priming 2 · Painting 1",
    );
    // No stage buttons: only reordering, Edit and Delete.
    await expect(item(page, 0).locator("button")).toHaveText([
      "Top",
      "↑",
      "↓",
      "Edit",
      "Delete",
    ]);
    await reload(page);
    await expect(page.locator("#queueContent .qitem")).toHaveCount(3);
  });

  test("Top and the arrows reorder, and the board follows", async ({
    page,
  }) => {
    await item(page, 2).locator("button[data-top]").click();
    expect(await order(page)).toEqual(["Finished", "Squad", "Hero"]);
    await expect(item(page, 0).locator("button[data-top]")).toBeFocused();
    await item(page, 1).locator("button[data-down]").click();
    expect(await order(page)).toEqual(["Finished", "Hero", "Squad"]);
    await page.click('[data-qview="board"]');
    await expect(page.locator("#queueContent .phase")).toHaveCount(6);
  });

  test("dragging a unit by its handle reorders it", async ({ page }) => {
    const handle = await item(page, 2).locator(".handle").boundingBox(),
      target = await item(page, 0).boundingBox();
    await page.mouse.move(handle.x + 5, handle.y + 5);
    await page.mouse.down();
    await page.mouse.move(handle.x + 5, target.y + 4, { steps: 8 });
    await expect(item(page, 0)).toHaveClass(/drop-before/);
    await page.mouse.up();
    expect(await order(page)).toEqual(["Finished", "Squad", "Hero"]);
  });
});

test.describe("Edit board", () => {
  const editor = (page) => page.locator("#phasesDialog");
  const row = (page, n) => page.locator("#phaseList li[data-row]").nth(n);
  const save = (page) => page.click('#phasesDialog button[value="save"]');

  test("lists the phases between the fixed ends", async ({ page }) => {
    await page.click("#editBoard");
    await expect(editor(page)).toBeVisible();
    await expect(page.locator("#phaseList li.fixed")).toHaveText([
      "To do",
      "Done",
    ]);
    const values = await page
      .locator("#phaseList li[data-row] input")
      .evaluateAll((els) => els.map((e) => e.value));
    expect(values).toEqual(["Building", "Priming", "Painting", "Detailing"]);
  });

  test("renaming, reordering, adding and deleting phases moves models with them, with Undo", async ({
    page,
  }) => {
    await page.click("#editBoard");
    await row(page, 2).locator("input").fill("Base and layers"); // Painting
    await row(page, 1).locator("[data-pdel]").click(); // Priming
    await page.click("#addPhase");
    await row(page, 3).locator("input").fill("Varnish");
    await row(page, 0).locator("[data-pdown]").click(); // Building down
    await save(page);
    await expect(page.locator("#queueContent .phase h3")).toHaveText([
      "To do 1",
      "Base and layers 3",
      "Building 0",
      "Detailing 0",
      "Varnish 0",
      "Done 1",
    ]);
    const data = await stored(page);
    expect(data.queueStages).toEqual([
      "Base and layers",
      "Building",
      "Detailing",
      "Varnish",
    ]);
    // Priming's models moved on to the next phase kept.
    expect(await phases(page, "a")).toEqual([
      "Base and layers",
      "Base and layers",
      "Base and layers",
    ]);
    await expect(page.locator("#toastText")).toContainText(
      "Saved the board; 2 model(s) moved on from a deleted phase",
    );
    await page.click("#toastAction");
    expect(await phases(page, "a")).toEqual(["Priming", "Priming", "Painting"]);
  });

  test("names are checked before saving", async ({ page }) => {
    await page.click("#editBoard");
    const input = (n) => row(page, n).locator("input");
    const message = (n) => input(n).evaluate((e) => e.validationMessage);
    await input(0).fill("   ");
    await save(page);
    expect(await message(0)).toBe("Give this phase a name.");
    await input(0).fill("priming");
    await save(page);
    expect(await message(1)).toBe("Another phase already has this name.");
    await input(0).fill("Done");
    await save(page);
    expect(await message(0)).toBe('"Done" is always the first or last phase.');
    await expect(editor(page)).toBeVisible();
    await page.click('#phasesDialog button[value="cancel"]');
    expect((await stored(page)).queueStages).toBeUndefined();
  });

  test("the last phase can't be deleted, and Esc changes nothing", async ({
    page,
  }) => {
    await page.click("#editBoard");
    for (let i = 0; i < 3; i++)
      await row(page, 0).locator("[data-pdel]").click();
    await expect(row(page, 0).locator("[data-pdel]")).toBeDisabled();
    await expect(row(page, 0).locator("input")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(editor(page)).toBeHidden();
    await expect(page.locator("#editBoard")).toBeFocused();
    expect((await stored(page)).queueStages).toBeUndefined();
  });
});

test.describe("the queue item form", () => {
  test("a bigger model count adds cards at To do; a smaller one takes the least advanced off", async ({
    page,
  }) => {
    await page.click('[data-qview="list"]');
    const edit = (i) =>
      page.locator("#queueContent .qitem").nth(i).locator("button[data-edit]");
    await edit(1).click(); // Hero
    await expect(page.locator('#formFields [name="models"]')).toHaveValue("1");
    await fillForm(page, { models: "3" });
    await submitForm(page);
    expect(await phases(page, "b")).toEqual(["To do", "To do", "To do"]);
    await edit(0).click(); // Squad: Priming 2, Painting 1
    await fillForm(page, { models: "1" });
    await submitForm(page);
    expect(await phases(page, "a")).toEqual(["Painting"]);
    expect((await stored(page)).queue[0].models).toBe("1");
  });

  test("quick add and Add item start a unit with its models at To do", async ({
    page,
  }) => {
    await page.fill("#queueView .quickadd input", "Terrain");
    await page.click("#queueView .quickadd button");
    let added = (await stored(page)).queue.at(-1);
    expect(added).toMatchObject({ name: "Terrain", models: "1" });
    expect(added.cards.map((c) => c.phase)).toEqual(["To do"]);
    await page.click("#addBtn");
    await fillForm(page, { name: "Knights", models: "4" });
    await submitForm(page);
    added = (await stored(page)).queue.at(-1);
    expect(added.cards.map((c) => c.phase)).toEqual([
      "To do",
      "To do",
      "To do",
      "To do",
    ]);
  });
});

test.describe("queues from 1.x", () => {
  test("each model becomes a card in the matching phase", async ({ page }) => {
    await seed(page, {
      schemaVersion: 5,
      miniatures: [{ id: "m", name: "Squad", quantity: "4" }],
      queue: [
        // Basecoating, 2 of 5 done: Painting 3, and 2 at the next phase.
        { id: "a", name: "A", stage: "Basecoating", stageDone: 2, models: "5" },
        // A split item; its model count comes from its miniature.
        {
          id: "b",
          name: "B",
          miniature: "m",
          stage: "Priming",
          split: { Priming: 1, Basing: 2, Complete: 1 },
        },
        { id: "c", name: "C", stage: "Not started" },
        { id: "d", name: "D", stage: "Complete", models: "2" },
        // Its own stages: matched by name, else by position.
        {
          id: "e",
          name: "E",
          stage: "Weathering",
          stages: [
            "Building",
            "Priming",
            "Basecoating",
            "Weathering",
            "Basing",
          ],
        },
        // A junk model count can't flood the board.
        { id: "f", name: "F", stage: "Building", models: "999999" },
      ],
    });
    await nav(page, "queue");
    expect(await phases(page, "a")).toEqual([
      "Painting",
      "Painting",
      "Painting",
      "Detailing",
      "Detailing",
    ]);
    expect(await phases(page, "b")).toEqual([
      "Priming",
      "Detailing",
      "Detailing",
      "Done",
    ]);
    expect(await phases(page, "c")).toEqual(["To do"]);
    expect(await phases(page, "d")).toEqual(["Done", "Done"]);
    // Weathering is three quarters of the way through its stages.
    expect(await phases(page, "e")).toEqual(["Painting"]);
    expect((await phases(page, "f")).length).toBe(500);
    const data = await stored(page);
    expect(data.schemaVersion).toBe(6);
    // The old fields stay, unread.
    expect(data.queue[0]).toMatchObject({ stage: "Basecoating", stageDone: 2 });
    expect(data.queueStages).toBeUndefined();
  });

  test("edited default stages become the board's phases", async ({ page }) => {
    await seed(page, {
      schemaVersion: 5,
      queueStages: ["Assemble", "Undercoat", "Paint"],
      queue: [{ id: "a", name: "A", stage: "Undercoat", models: "2" }],
    });
    await nav(page, "queue");
    await expect(page.locator("#queueContent .phase h3")).toHaveText([
      "To do 0",
      "Assemble 0",
      "Undercoat 2",
      "Paint 0",
      "Done 0",
    ]);
  });
});

test("stored phases and cards are read safely", async ({ page }) => {
  await seed(page, {
    schemaVersion: 6,
    queueStages: ["Prime", "prime", "", 7, "To do", "Paint"],
    queue: [
      { id: "a", name: "A", cards: "lots" },
      {
        id: "b",
        name: "B",
        cards: [null, 3, { phase: "Nowhere" }, { id: "b2", phase: "Paint" }],
      },
    ],
  });
  await nav(page, "queue");
  await expect(page.locator("#queueContent .phase h3")).toHaveText([
    "To do 1",
    "Prime 0",
    "Paint 1",
    "Done 0",
  ]);
  await page.click('[data-qview="list"]');
  await expect(page.locator("#queueContent .qcounts")).toHaveText([
    "No models on the board",
    "To do 1 · Paint 1",
  ]);
});
