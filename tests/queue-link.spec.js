// The board and the miniatures page: Add 1 and Add all, the miniature
// keeping in step as its models move, and the prompt when a unit is done.
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
const col = (page, phase) =>
  page.locator(`#queueContent .phase[data-phase="${phase}"]`);
const head = (page, phase, name) =>
  col(page, phase).locator(".unithead", { hasText: name });
const step = (page, phase, name, label) =>
  head(page, phase, name).getByRole("button", { name: label });
const mini = async (page, id) =>
  (await stored(page)).miniatures.find((m) => m.id === id);
const cardsOf = async (page, mid) =>
  (await stored(page)).queue
    .filter((q) => q.miniature === mid)
    .flatMap((q) => q.cards.map((c) => c.phase));

test.beforeEach(async ({ page }) => openApp(page));

test.describe("Add 1 and Add all", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, {
      projects: [{ id: "p", name: "Army" }],
      miniatures: [
        { id: "u", name: "Loose", quantity: "2", status: "Unbuilt" },
        { id: "b", name: "Hero", quantity: "1", status: "Built" },
        {
          id: "s",
          name: "Squad",
          quantity: "3",
          status: "Primed",
          project: "p",
        },
        { id: "w", name: "Busy", quantity: "2", status: "In progress" },
        {
          id: "h",
          name: "Half",
          quantity: "5",
          painted: "2",
          status: "Primed",
        },
        {
          id: "c",
          name: "Done",
          quantity: "2",
          painted: "2",
          status: "Complete",
        },
        { id: "x", name: "Odd", quantity: "1", status: "constructor" },
      ],
    });
    await nav(page, "miniatures");
  });
  const add = (page, mid, which) =>
    page.locator(`tr[data-row="${mid}"] button[data-add${which}]`);

  test("Add all puts every model on the board where its status says", async ({
    page,
  }) => {
    await add(page, "s", "all").click();
    expect(await cardsOf(page, "s")).toEqual([
      "Painting",
      "Painting",
      "Painting",
    ]);
    await expect(page.locator("#toastText")).toHaveText(
      'Added 3 models of "Squad" to the board: Painting 3',
    );
    // The new queue item is linked, with its project.
    expect((await stored(page)).queue[0]).toMatchObject({
      name: "Squad",
      miniature: "s",
      project: "p",
      models: "3",
    });
    for (const id of ["u", "b", "w", "c", "x"])
      await add(page, id, "all").click();
    expect(await cardsOf(page, "u")).toEqual(["To do", "To do"]);
    expect(await cardsOf(page, "b")).toEqual(["Priming"]);
    expect(await cardsOf(page, "w")).toEqual(["Painting", "Painting"]);
    expect(await cardsOf(page, "c")).toEqual(["Done", "Done"]);
    // A status it doesn't know starts at the beginning.
    expect(await cardsOf(page, "x")).toEqual(["To do"]);
    // Adding doesn't change the miniatures: the cards agree with them.
    expect((await mini(page, "s")).status).toBe("Primed");
    await expect(dialog(page)).toBeHidden();
  });

  test("painted models go to Done; Add 1 adds the unpainted first", async ({
    page,
  }) => {
    await add(page, "h", "one").click();
    await expect(page.locator("#toastText")).toHaveText(
      'Added 1 model of "Half" to the board: Painting 1',
    );
    for (let i = 0; i < 3; i++) await add(page, "h", "one").click();
    // 3 unpainted models, then a painted one.
    expect(await cardsOf(page, "h")).toEqual([
      "Painting",
      "Painting",
      "Painting",
      "Done",
    ]);
    await add(page, "h", "all").click();
    expect(await cardsOf(page, "h")).toEqual([
      "Painting",
      "Painting",
      "Painting",
      "Done",
      "Done",
    ]);
    // One queue item holds them all, and the buttons are done with.
    expect((await stored(page)).queue).toHaveLength(1);
    await expect(add(page, "h", "one")).toBeDisabled();
    await expect(add(page, "h", "all")).toBeDisabled();
  });

  test("Undo takes them off again", async ({ page }) => {
    await add(page, "s", "all").click();
    await page.click("#toastAction");
    expect((await stored(page)).queue).toEqual([]);
    await expect(add(page, "s", "all")).toBeEnabled();
  });

  test("renamed phases are found by name", async ({ page }) => {
    await seed(page, {
      queueStages: ["Assembly", "Undercoat", "Paint", "Varnish"],
      miniatures: [
        { id: "b", name: "Hero", quantity: "1", status: "Built" },
        { id: "s", name: "Squad", quantity: "1", status: "Primed" },
      ],
    });
    await nav(page, "miniatures");
    await add(page, "b", "all").click();
    await add(page, "s", "all").click();
    // Built: after Assembly. Primed: no priming phase, so after Assembly too.
    expect(await cardsOf(page, "b")).toEqual(["Undercoat"]);
    expect(await cardsOf(page, "s")).toEqual(["Undercoat"]);
  });
});

test.describe("the miniature keeps in step", () => {
  const board = (miniature, cards, extra = {}) => ({
    miniatures: [{ id: "k", name: "Knights", ...miniature }],
    queue: [
      {
        id: "a",
        name: "Knights",
        miniature: "k",
        cards: cards.map((phase, i) => ({ id: `a${i}`, phase })),
      },
      { id: "l", name: "Loose", cards: [{ id: "l1", phase: "To do" }] },
    ],
    ...extra,
  });

  test("with every model on the board, it follows both ways, with Undo", async ({
    page,
  }) => {
    await seed(
      page,
      board({ quantity: "3", status: "Unbuilt" }, [
        "Building",
        "Building",
        "Building",
      ]),
    );
    await nav(page, "queue");
    await step(page, "Building", "Knights", /on to Priming/).click();
    expect((await mini(page, "k")).status).toBe("Built");
    await expect(page.locator("#toastText")).toHaveText(
      'Moved 3 models of "Knights" to Priming; miniature "Knights" is now Built',
    );
    await step(page, "Priming", "Knights", /on to Painting/).click();
    expect((await mini(page, "k")).status).toBe("Primed");
    // One model past painting: In progress.
    await head(page, "Painting", "Knights").locator("button.unitname").click();
    await col(page, "Painting")
      .getByRole("button", { name: "Move Knights #1 on to Detailing" })
      .click();
    expect((await mini(page, "k")).status).toBe("In progress");
    await page.click("#toastAction");
    expect((await mini(page, "k")).status).toBe("Primed");
    // Back is free, and the miniature goes back with it.
    await step(page, "Painting", "Knights", /back to Priming/).click();
    expect((await mini(page, "k")).status).toBe("Built");
  });

  test("its painted count is its models in Done", async ({ page }) => {
    await seed(
      page,
      board({ quantity: "3", painted: "0", status: "In progress" }, [
        "Detailing",
        "Detailing",
        "Done",
      ]),
    );
    await nav(page, "queue");
    await step(page, "Detailing", "Knights", /on to Done/).click();
    expect((await mini(page, "k")).painted).toBe("3");
    await page.click('#completeDialog button[value="skip"]');
    await head(page, "Done", "Knights").locator("button.unitname").click();
    await col(page, "Done")
      .getByRole("button", { name: "Move Knights #3 back to Detailing" })
      .click();
    expect(await mini(page, "k")).toMatchObject({
      painted: "2",
      status: "In progress",
    });
  });

  test("with some models off the board, it only moves forward", async ({
    page,
  }) => {
    await seed(
      page,
      board({ quantity: "5", painted: "1", status: "Built" }, [
        "Painting",
        "Detailing",
      ]),
    );
    await nav(page, "queue");
    await step(page, "Detailing", "Knights", /on to Done/).click();
    expect(await mini(page, "k")).toMatchObject({
      status: "In progress",
      painted: "1",
    });
    await step(page, "Done", "Knights", /back to Detailing/).click();
    await step(page, "Detailing", "Knights", /back to Painting/).click();
    // Never lowered.
    expect(await mini(page, "k")).toMatchObject({
      status: "In progress",
      painted: "1",
    });
  });

  test("an item without a miniature, or a status it doesn't know, is safe", async ({
    page,
  }) => {
    await seed(
      page,
      board({ quantity: "1", status: "constructor" }, ["Priming"]),
    );
    await nav(page, "queue");
    await step(page, "To do", "Loose", /on to Building/).click();
    await expect(page.locator("#toastText")).toHaveText(
      'Moved 1 model of "Loose" to Building',
    );
    await step(page, "Priming", "Knights", /on to Painting/).click();
    expect((await mini(page, "k")).status).toBe("Primed");
  });

  test("phases that don't say build or prime leave the status alone", async ({
    page,
  }) => {
    await seed(
      page,
      board({ quantity: "1", status: "" }, ["Clean"], {
        queueStages: ["Clean", "Paint"],
      }),
    );
    await nav(page, "queue");
    await step(page, "Clean", "Knights", /on to Paint/).click();
    expect((await mini(page, "k")).status).toBe("");
    await step(page, "Paint", "Knights", /on to Done/).click();
    await page.click('#completeDialog button[value="skip"]');
    expect(await mini(page, "k")).toMatchObject({ status: "", painted: "1" });
  });
});

test.describe("when every model of a unit is done", () => {
  test.beforeEach(async ({ page }) => {
    await seed(page, {
      miniatures: [
        {
          id: "m1",
          name: "Squad",
          quantity: "2",
          painted: "1",
          status: "In progress",
        },
        {
          id: "m2",
          name: "Done",
          quantity: "1",
          painted: "1",
          status: "Complete",
        },
      ],
      queue: [
        {
          id: "q1",
          name: "Squad",
          miniature: "m1",
          cards: [
            { id: "c1", phase: "Detailing" },
            { id: "c2", phase: "Done" },
          ],
        },
        { id: "q2", name: "Loose", cards: [{ id: "c3", phase: "Detailing" }] },
        {
          id: "q3",
          name: "Done",
          miniature: "m2",
          cards: [{ id: "c4", phase: "Detailing" }],
        },
      ],
    });
    await nav(page, "queue");
  });
  const finish = (page, name) =>
    step(page, "Detailing", name, /on to Done/).click();

  test("it asks; Apply marks the miniature complete", async ({ page }) => {
    await finish(page, "Squad");
    await expect(dialog(page)).toBeVisible();
    await expect(page.locator("#completeMiniLabel")).toHaveText(
      'Mark "Squad" complete, with 2 of 2 painted',
    );
    await expect(page.locator("#completeMini")).toBeChecked();
    await expect(page.locator("#completeRemove")).not.toBeChecked();
    await page.click('#completeDialog button[value="apply"]');
    expect(await mini(page, "m1")).toMatchObject({
      status: "Complete",
      painted: "2",
    });
    expect((await stored(page)).queue).toHaveLength(3);
    await expect(page.locator("#toastText")).toHaveText(
      'Marked "Squad" complete',
    );
  });

  test("Apply can take it off the board too, and Undo reverts both", async ({
    page,
  }) => {
    await finish(page, "Squad");
    await page.check("#completeRemove");
    await page.click('#completeDialog button[value="apply"]');
    expect((await stored(page)).queue.map((q) => q.id)).toEqual(["q2", "q3"]);
    await expect(page.locator("#toastText")).toHaveText(
      'Marked "Squad" complete and took "Squad" off the board',
    );
    await page.click("#toastAction");
    expect((await stored(page)).queue.map((q) => q.id)).toEqual([
      "q1",
      "q2",
      "q3",
    ]);
    // The move itself stays, with the painted count it brought.
    expect(await mini(page, "m1")).toMatchObject({
      status: "In progress",
      painted: "2",
    });
  });

  test("an already-complete miniature can only be taken off the board", async ({
    page,
  }) => {
    await finish(page, "Done");
    await expect(page.locator("#completeMiniLabel")).toHaveText(
      '"Done" is already marked complete',
    );
    await expect(page.locator("#completeMini")).toBeDisabled();
    await page.check("#completeRemove");
    await page.click('#completeDialog button[value="apply"]');
    expect((await stored(page)).queue.map((q) => q.id)).toEqual(["q1", "q2"]);
  });

  test("no prompt for a unit with no miniature", async ({ page }) => {
    await finish(page, "Loose");
    await expect(dialog(page)).toBeHidden();
  });
});

test("the queue form can link a miniature, and deleting it unlinks", async ({
  page,
}) => {
  await seed(page, {
    miniatures: [{ id: "m1", name: "Squad", quantity: "2" }],
    queue: [{ id: "q1", name: "Loose", cards: [{ id: "c1", phase: "To do" }] }],
  });
  await nav(page, "queue");
  await page.click('[data-qview="list"]');
  await page.locator("#queueContent button[data-edit]").click();
  await fillForm(page, { miniature: "m1" });
  await submitForm(page);
  expect((await stored(page)).queue[0].miniature).toBe("m1");
  await nav(page, "miniatures");
  await page.locator("#listView button[data-del]").click();
  await expect(page.locator("#toastText")).toHaveText(
    'Deleted "Squad" and unlinked 1 item(s) from it',
  );
  expect((await stored(page)).queue[0].miniature).toBe("");
});
