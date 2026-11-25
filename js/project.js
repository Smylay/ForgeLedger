// A project's own page (#/projects/<id>): like the dashboard, but for one
// project. Its progress, its miniatures and where their models are on the
// board, every photo of them, and its wishlist items and rewards. show()
// sets `openProject`; render() draws this instead of the projects list.
"use strict";

// The miniatures in a project, and the queue units working on it: linked to
// the project, or to one of its miniatures.
function projectMinis(p) {
  return db.miniatures.filter((m) => m.project === p.id);
}
function projectUnits(p) {
  let minis = new Set(projectMinis(p).map((m) => m.id));
  return db.queue.filter((q) => q.project === p.id || minis.has(q.miniature));
}
// Wishlist items for a project: its own, and its rewards.
function projectWishes(p) {
  return db.wishlist.filter((w) => w.project === p.id || w.rewardFor === p.id);
}

function renderProject() {
  let p = db.projects.find((x) => x.id === openProject);
  if (!p) return go("projects"); // deleted, e.g. in another tab
  let line = [p.faction, p.system].filter(Boolean).map(String).join(" · ");
  document.querySelector("#title").textContent = String(p.name ?? "");
  document.title = `${p.name} · ForgeLedger`;
  document.querySelector("#subtitle").textContent = line || "Army project";
  let box = document.querySelector("#projectContent");
  box.innerHTML =
    `<div class="projecttools"><a class="btn" href="#/projects" data-sec="projects">← All projects</a><span class="rowacts"><button class="btn" data-edit="${esc(p.id)}">Edit project</button></span></div>` +
    projectMetricsHtml(p) +
    `<div class="grid projectgrid">${[
      ["Progress", projectProgressHtml(p)],
      ["Miniatures", projectMinisHtml(p)],
      ["Photos", projectPhotosHtml(p)],
      ["Wishlist and rewards", projectWishesHtml(p)],
      ...(p.notes ? [["Notes", `<p class="pnotes">${esc(p.notes)}</p>`]] : []),
    ]
      .map(
        ([h, body]) =>
          `<section class="card wide"><h3>${h}</h3>${body}</section>`,
      )
      .join("")}</div>`;
  fillPhotos(box);
}
function projectMetricsHtml(p) {
  let st = projectStats(p),
    due = dueBadge(p.deadline, projectDone(p)),
    cards = [
      ["Progress", `${st.percent}%`],
      ["Painted", `${st.painted} of ${st.models}`],
      [
        "Spent",
        money(st.spent) + (amount(p.budget) ? ` of ${money(p.budget)}` : ""),
      ],
      [
        "Target date",
        p.deadline ? esc(p.deadline) + (due ? " " + due : "") : "None",
      ],
    ];
  return `<div class="grid">${cards
    .map(
      ([k, v]) =>
        `<div class="card metric"><div class="muted">${k}</div><div class="v">${v}</div></div>`,
    )
    .join("")}</div>`;
}
// The bar, what it counts, and where the project's models are on the board.
function projectProgressHtml(p) {
  let st = projectStats(p),
    cards = projectUnits(p).flatMap(cardsOf),
    board = cardsText(cards);
  return `<div class="chart"><div class="bar" style="width:${st.percent}%"></div></div><p class="muted">${st.painted} of ${st.goal} models painted${p.target ? " (your target)" : ""}; work in progress counts toward the ${st.percent}%.</p><p>${cards.length ? `On the board: ${esc(board)}. <a class="plink" href="#/queue" data-sec="queue">Open the board</a>` : '<span class="muted">None of its models are on the board.</span>'}</p>`;
}
// Each miniature: its cover, status, painted count, where its models are on
// the board, low paints, and its Add and Photos buttons. Then units on the
// board for the project that have no miniature.
function projectMinisHtml(p) {
  let minis = projectMinis(p),
    loose = db.queue.filter(
      (q) =>
        q.project === p.id && !db.miniatures.some((m) => m.id === q.miniature),
    );
  let rows = minis.map((m) => {
    let board = cardsText(miniCards(m)),
      low = lowRecipePaints(m),
      painted = `${Number(m.painted) || 0} of ${Number(m.quantity) || 1} painted`;
    return `<div class="pmini"><span class="withthumb">${coverHtml(m)}<span><b>${esc(m.name)}</b>${m.status ? ` <span class="pill">${esc(m.status)}</span>` : ""}<br><span class="muted">${painted}${board ? ` · on the board: ${esc(board)}` : ""}</span>${low.length ? `<br><span class="warnline">Low paint: ${low.map((x) => `${esc(x.name)} (${esc(x.stock)})`).join(", ")}</span>` : ""}</span></span><span class="rowacts">${addButtonsHtml(m)}${photosButtonHtml(m)}</span></div>`;
  });
  rows.push(
    ...loose.map(
      (q) =>
        `<div class="pmini"><span><b>${esc(q.name)}</b> <span class="pill">On the board</span><br><span class="muted">${esc(countsText(q))}</span></span></div>`,
    ),
  );
  return rows.length
    ? rows.join("")
    : '<div class="empty">No miniatures in this project yet. Choose it as the army project in a miniature\'s form.</div>';
}
// Every photo of the project's miniatures, and of models on the board in
// units of the project with no miniature. Each opens its viewer.
function projectPhotosHtml(p) {
  let thumbs = projectMinis(p).flatMap((m) =>
    photoIds(m).map(
      (pid, k) =>
        `<button type="button" data-photos="${esc(m.id)}" data-at="${k}" aria-label="Photo ${k + 1} of ${esc(m.name)}${photoModel(m, pid) ? `: ${esc(photoModel(m, pid))}` : ""}"><img class="thumb" data-photo="${esc(pid)}" alt=""></button>`,
    ),
  );
  for (let q of projectUnits(p))
    if (!db.miniatures.some((m) => m.id === q.miniature))
      for (let c of cardsOf(q))
        if (cardPhoto(c))
          thumbs.push(
            `<button type="button" data-mphoto="${esc(c.id)}" data-q="${esc(q.id)}" aria-label="Photo of ${esc(modelName(q, c))}"><img class="thumb" data-photo="${esc(cardPhoto(c))}" alt=""></button>`,
          );
  return thumbs.length
    ? `<div class="gallery">${thumbs.join("")}</div>`
    : "<div class=\"empty\">No photos yet. Add them with a miniature's Photos button, or a model's on the board.</div>";
}
// The project's wishlist items and rewards, with Bought (for rewards, once
// they're unlocked), what they'd cost, and buttons to add more.
function projectWishesHtml(p) {
  let items = projectWishes(p),
    cost = items.reduce((a, w) => a + amount(w.price), 0);
  let rows = items.map((w) => {
    let r = reward(w),
      about = [
        w.category,
        w.priority && `${w.priority} priority`,
        amount(w.price) && money(w.price),
      ]
        .filter(Boolean)
        .map(String)
        .join(" · ");
    return `<div class="rewardline"><span><b>${esc(w.name)}</b>${r ? " " + rewardHtml(w) : ""}${about ? `<br><span class="muted">${esc(about)}</span>` : ""}</span>${!r || r.unlocked ? `<button class="btn" data-bought="${esc(w.id)}" aria-label="Bought: ${esc(w.name)}">Bought</button>` : ""}</div>`;
  });
  return (
    (rows.length
      ? rows.join("") +
        (cost ? `<p class="muted">Expected cost: ${money(cost)}</p>` : "")
      : '<div class="empty">Nothing on the wishlist for this project.</div>') +
    `<div class="rowacts ptools"><button data-projectwish="${esc(p.id)}">Add wishlist item</button><button data-addreward="${esc(p.id)}" aria-label="Add reward for ${esc(p.name)}">Add reward</button></div>`
  );
}
