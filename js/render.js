// Drawing the pages: nav and page switching, the dashboard, list tables,
// sorting, deadline markers and alerts. The queue, skills, photos and
// Settings draw themselves in their own files.
"use strict";

// The unreadable-data alert's buttons (see renderAlerts).
function downloadRecovered() {
  download(recovered.raw, `forgeledger-unreadable-data-${today()}.json`);
}
function dismissRecovered() {
  recovered = null;
  renderAlerts();
}
function renderBackupState() {
  document.querySelector("#backupState").textContent =
    "Last backup: " + backupText(backupAgeDays());
}

function renderAlerts() {
  let notes = [];
  if (memoryOnly)
    notes.push(
      "This browser is blocking storage, so changes are lost when you close the page. Use Export backup to keep your data.",
    );
  if (recovered)
    notes.push(
      `Some saved data couldn't be read (${esc(recovered.problem)}). The original was kept, and the app is showing what it could recover. <button class="btn" data-recovery="download">Download original</button><button class="btn" data-recovery="dismiss">Dismiss</button>`,
    );
  document.querySelector("#alerts").innerHTML = notes
    .map((n) => `<div class="notice warn">${n}</div>`)
    .join("");
}
// Whole days from today to a YYYY-MM-DD date, or NaN if it isn't one.
function daysUntil(date) {
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date ?? "");
  if (!m) return NaN;
  let now = new Date(),
    today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(m[1], m[2] - 1, m[3]) - today) / 864e5);
}
// A marker for a date that hasn't been met: overdue, or due within
// DUE_SOON_DAYS. Empty when the date is blank, far off, or `done`.
function dueBadge(date, done) {
  let days = daysUntil(date);
  if (done || Number.isNaN(days) || days > DUE_SOON_DAYS) return "";
  if (days < 0) return '<span class="pill overdue">Overdue</span>';
  let text =
    days === 0 ? "Due today" : `Due in ${days} day${days === 1 ? "" : "s"}`;
  return `<span class="pill soon">${text}</span>`;
}
// What a column sorts by: a number for numeric types, otherwise the
// displayed text. Blank is null and always sorts last.
function sortValue(f, x) {
  let numeric = ["count", "money", "percent", "level"].includes(f.type),
    v = f.value ? f.value(x) : x[f.key];
  if (v == null || v === "" || (Array.isArray(v) && !v.length)) return null;
  // Levels sort in option order, or reversed when the options run from
  // most to least (paint stock: Empty sorts first).
  if (f.type === "scale") {
    let i = f.options.indexOf(v);
    if (i < 0) return null;
    return f.highFirst ? f.options.length - 1 - i : i;
  }
  if (numeric) return Number.isNaN(Number(v)) ? null : Number(v);
  return cellText(f, x).toLowerCase();
}
function sortRows(rows, f, dir) {
  return rows
    .map((x) => [sortValue(f, x), x])
    .sort(([a], [b]) => {
      if (a === null || b === null) return (a === null) - (b === null);
      let c =
        typeof a === "number" && typeof b === "number"
          ? a - b
          : String(a).localeCompare(String(b), undefined, { numeric: true });
      return c * dir;
    })
    .map(([, x]) => x);
}
function renderNav() {
  let items = [
    ["dashboard", "Dashboard"],
    ...Object.entries(defs).map(([k, d]) => [k, d.nav || d.title]),
  ];
  document.querySelector("#nav").innerHTML = items
    .map(
      ([k, n]) =>
        `<a href="#/${k}" data-sec="${k}"${section === k ? ' class="active" aria-current="page"' : ""}>${n}${k === "dashboard" ? "" : `<span class="count">${db[k].length}</span>`}</a>`,
    )
    .join("");
}
// The section named by the page address (#/paints), or "dashboard" for
// anything else. hasOwn stops names like "toString" from matching.
function sectionFromHash() {
  let k = location.hash.replace(/^#\/?/, "");
  return Object.hasOwn(defs, k) ? k : "dashboard";
}
// Go to a section: update the address (adding a history entry) and show it.
// The hashchange this causes finds the section already showing.
function go(k) {
  if (!Object.hasOwn(defs, k)) k = "dashboard";
  if (location.hash !== "#/" + k) location.hash = "#/" + k;
  show(k);
}
// Draw a section: "dashboard" or a key of `defs`.
function show(k) {
  let d = defs[k];
  for (let dialog of document.querySelectorAll("dialog[open]")) dialog.close();
  section = k;
  editId = null;
  document.querySelector("#search").value = "";
  document.querySelector("#filter").innerHTML = ""; // resets the filter
  sort = { key: "", dir: 1 };
  renderNav();
  // On phones the nav is one scrolling row; keep the current page in view.
  document
    .querySelector("#nav .active")
    .scrollIntoView({ block: "nearest", inline: "nearest" });
  document
    .querySelectorAll(".view")
    .forEach((x) => x.classList.remove("active"));
  document.querySelector("#title").textContent = d ? d.title : "Dashboard";
  document.title = `${d ? d.title : "Dashboard"} · ForgeLedger`;
  document.querySelector("#subtitle").textContent = d
    ? d.sub
    : "Your hobby at a glance";
  document
    .querySelector("#" + (d ? d.view || "listView" : "dashboard"))
    .classList.add("active");
  document.querySelector("#addBtn").style.display = d ? "inline-block" : "none";
  if (d) {
    let what = `${/^[aeiou]/i.test(d.noun) ? "an" : "a"} ${d.noun}`;
    for (let input of document.querySelectorAll(
      ".quickadd:not(#skillAdd) input",
    )) {
      input.placeholder = `Quick add ${what}…`;
      input.setAttribute("aria-label", `Quick add ${what}, by name`);
    }
  }
  render();
}
function render() {
  if (section === "dashboard") renderDashboard();
  else if (section === "queue") renderQueue();
  else if (section === "skills") renderSkills();
  else renderList();
}
function renderDashboard() {
  renderStartNotice();
  renderBackupNotice();
  renderMetrics();
  renderProjectSummary();
  renderQueueSummary();
  renderStockSummary();
  renderSpendSummary();
  renderRewardSummary();
}
// Recorded spend: every price in paints, tools and miniatures, as entered
// (not multiplied by quantity).
function recordedSpend() {
  return ["paints", "tools", "miniatures"]
    .flatMap((k) => db[k])
    .reduce((a, x) => a + Number(x.price || 0), 0);
}
function renderBackupNotice() {
  let age = backupAgeDays();
  document.querySelector("#backupNotice").innerHTML =
    hasUserData() && (age === null || age >= BACKUP_REMINDER_DAYS)
      ? `<div class="notice warn">Your data is only stored in this browser. Last backup: ${backupText(age)}. Use <b>Export backup</b> to save a copy.</div>`
      : "";
}
function renderMetrics() {
  let models = db.miniatures.reduce((a, x) => a + Number(x.quantity || 1), 0),
    painted = db.miniatures.reduce((a, x) => a + Number(x.painted || 0), 0),
    cards = [
      ["Paints", db.paints.length],
      ["Models", models],
      ["Painted", painted],
      ["Recorded spend", money(recordedSpend())],
    ];
  document.querySelector("#metrics").innerHTML = cards
    .map(
      (x) =>
        `<div class="card metric"><div class="muted">${x[0]}</div><div class="v">${x[1]}</div></div>`,
    )
    .join("");
}
function renderProjectSummary() {
  document.querySelector("#projectSummary").innerHTML = db.projects.length
    ? db.projects
        .map((p) => {
          let st = projectStats(p),
            due = dueBadge(p.deadline, projectDone(p)),
            pc = st.percent;
          return `<div class="project"><div class="projectfoot"><b>${esc(p.name)}${due ? " " + due : ""}</b><span>${pc}%</span></div><div class="chart"><div class="bar" style="width:${pc}%"></div></div><small class="muted">${st.painted} of ${st.goal} models painted · ${st.models} owned · ${money(st.spent)} / ${money(p.budget)}</small></div><br>`;
        })
        .join("")
    : '<div class="empty">No army projects yet.</div>';
}
function renderQueueSummary() {
  document.querySelector("#queueSummary").innerHTML = db.queue.length
    ? db.queue
        .slice(0, 5)
        .map(
          (q, i) =>
            `<div>${i + 1}. <b>${esc(q.name)}</b> <span class="muted">${esc(isSplit(q) ? splitText(q) : q.stage || "Not started")}</span></div>`,
        )
        .join("")
    : '<div class="empty">Queue is empty.</div>';
}
// Low paints, with how many queued miniatures need each, and a button to
// add it to the wishlist unless it's there already.
function renderStockSummary() {
  let low = db.paints.filter(isLow),
    // Miniatures waiting in the queue, for "needed for N queued".
    waiting = db.queue
      .filter((q) => q.stage !== "Complete")
      .map((q) => linked(column(defs.queue, "miniature"), q.miniature))
      .filter(Boolean);
  let wanted = new Set(db.wishlist.map((w) => w.paint).filter(Boolean)),
    toBuy = low.filter((p) => !wanted.has(p.id));
  document.querySelector("#stockSummary").innerHTML = low.length
    ? low
        .map((p) => {
          let needed = waiting.filter((m) =>
            asList(m.paints).includes(p.id),
          ).length;
          return `<div class="stockrow"><span><span class="colour" style="background:${safeColour(p.colour) || "#777"}"></span>${esc(p.brand)} ${esc(p.name)} · <b>${esc(p.stock)}</b>${needed ? ` <span class="muted">· needed for ${needed} queued</span>` : ""}</span>${wanted.has(p.id) ? '<span class="muted">On wishlist</span>' : `<span class="rowacts"><button data-wish="${esc(p.id)}">Add to wishlist</button></span>`}</div>`;
        })
        .join("") +
      (toBuy.length > 1
        ? `<div class="rowacts stockall"><button data-wishall>Add all ${toBuy.length} to wishlist</button></div>`
        : "")
    : '<div class="empty">No paints running low.</div>';
}
function renderSpendSummary() {
  let wish = db.wishlist.reduce((a, x) => a + Number(x.price || 0), 0);
  document.querySelector("#spendSummary").innerHTML =
    `<div class="metric"><div class="v">${money(recordedSpend())}</div><div class="muted">Owned collection spend</div><br><div class="v">${money(wish)}</div><div class="muted">Wishlist exposure</div></div>`;
}
// Rewards: unlocked first, then the nearest to unlocking.
function renderRewardSummary() {
  let rewards = db.wishlist
    .map((w) => ({ w, r: reward(w) }))
    .filter((x) => x.r)
    .sort(
      (a, b) =>
        b.r.unlocked - a.r.unlocked ||
        b.r.percent / b.r.at - a.r.percent / a.r.at,
    );
  document.querySelector("#rewardSummary").innerHTML = rewards.length
    ? rewards
        .map(
          ({ w, r }) =>
            `<div class="rewardline"><span><b>${esc(w.name)}</b> ${rewardHtml(w)}</span>${r.unlocked ? `<button class="btn" data-bought="${esc(w.id)}" aria-label="Bought: ${esc(w.name)}">Bought</button>` : ""}</div>`,
        )
        .join("")
    : '<div class="empty">No rewards yet. Give a wishlist item a project and a % to unlock it at.</div>';
}
// What a record can be found by: each field and computed value as shown.
// Field names and hidden ids never match, and projects match by name.
function searchText(d, x) {
  return [...d.fields, ...Object.values(d.computed || {})]
    .map((f) => cellText(f, x))
    .join(" ")
    .toLowerCase();
}
function visible() {
  let d = defs[section],
    q = document.querySelector("#search").value.trim().toLowerCase(),
    f = document.querySelector("#filter").value;
  return db[section].filter(
    (x) => (!q || searchText(d, x).includes(q)) && (!f || x[d.filter] === f),
  );
}
// Rebuild the filter dropdown, keeping the current choice if it still
// exists. A field without fixed options offers the values in use.
function renderList() {
  let d = defs[section],
    f = d.filter && column(d, d.filter),
    filter = document.querySelector("#filter"),
    current = filter.value,
    options = !f
      ? []
      : f.options ||
        [...new Set(db[section].map((x) => x[f.key]).filter(Boolean))]
          .map(String)
          .sort();
  filter.hidden = !f;
  filter.innerHTML = f
    ? `<option value="">${esc(f.label)}: all</option>` +
      options.map((o) => `<option>${esc(o)}</option>`).join("")
    : "";
  filter.value = options.includes(current) ? current : "";
  renderTable();
}
// A field's value as text, or "" if blank. `f` is a field or a computed
// column. Links to deleted records show as blank.
function cellText(f, x) {
  let v = f.value ? f.value(x) : x[f.key];
  if (v == null || v === "") return "";
  if (f.type === "money") return money(v);
  if (f.type === "percent") return v + "%";
  if (f.type === "link") return linked(f, v)?.name || "";
  if (f.type === "links")
    return linkedAll(f, v)
      .map((r) => r.name)
      .join(", ");
  return String(v);
}
function cellHtml(f, x) {
  let v = x[f.key];
  if (f.html) return f.html(x); // a computed column with its own markup
  if (f.stepper) return stepperHtml(f, x);
  // One button per level; tapping one saves it (setScale in actions.js).
  if (f.type === "scale")
    return `<span class="scale" role="group" aria-label="${esc(f.label)} of ${esc(x.name)}">${f.options
      .map(
        (o, i) =>
          `<button type="button" class="tone-${f.tones?.[i] || "none"}" data-scale="${f.key}" data-id="${esc(x.id)}" data-value="${esc(o)}" aria-pressed="${v === o}">${esc(o)}</button>`,
      )
      .join("")}</span>`;
  if (f.type === "url")
    return safeUrl(v)
      ? `<a href="${esc(safeUrl(v))}" target="_blank" rel="noopener noreferrer" style="color:var(--blue)">Open</a>`
      : esc(v);
  if (f.type === "color")
    return `<span class="colour" style="background:${safeColour(v) || "#777"}"></span>${esc(v)}`;
  if (f.type === "date" && f.doneWhen) {
    let badge = dueBadge(v, f.doneWhen(x));
    return esc(cellText(f, x)) + (badge ? " " + badge : "");
  }
  if (f.type === "links")
    return linkedAll(f, v)
      .map(
        (r) =>
          `<span class="chip">${safeColour(r.colour) ? `<span class="colour" style="background:${safeColour(r.colour)}"></span>` : ""}${esc(r.name)}${isLow(r) ? ` <span class="pill warn">${esc(r.stock)}</span>` : ""}</span>`,
      )
      .join(" ");
  return esc(cellText(f, x));
}
// A colour dot for a record (e.g. a paint), hollow when it has no colour.
function swatchHtml(colour) {
  let c = safeColour(colour);
  return `<span class="colour${c ? "" : " none"}" style="background:${c || "transparent"}" aria-hidden="true"></span>`;
}
// The range a +/- count can move in: at least 0 and at least any field
// that must not exceed it (model count >= painted), at most its `atMost`
// field (painted <= model count). Blank limits are ignored.
function stepRange(d, f, x) {
  let set = (v) => v !== "" && v != null,
    lo = 0,
    hi = null;
  for (let g of d.fields)
    if (g.atMost === f.key && set(x[g.key]))
      lo = Math.max(lo, Number(x[g.key]) || 0);
  if (f.atMost && set(x[f.atMost])) hi = Number(x[f.atMost]) || 0;
  return { lo, hi };
}
// A count with - and + buttons; blank shows "–" and + starts it at 1.
function stepperHtml(f, x) {
  let v = x[f.key],
    n = v === "" || v == null ? null : Number(v) || 0,
    { lo, hi } = stepRange(defs[section], f, x),
    label = esc(`${f.label} of ${x.name}`),
    attrs = `data-key="${f.key}" data-id="${esc(x.id)}"`;
  return `<span class="stepper" role="group" aria-label="${label}"><button type="button" data-step="-1" ${attrs} aria-label="Decrease ${label}"${n === null || n <= lo ? " disabled" : ""}>−</button><span class="stepval">${n === null ? '<span aria-hidden="true">–</span><span class="sr-only">not set</span>' : n}</span><button type="button" data-step="1" ${attrs} aria-label="Increase ${label}"${hi !== null && (n ?? 0) >= hi ? " disabled" : ""}>+</button></span>`;
}
// One table row for record `x` of collection `d`.
function rowHtml(d, x) {
  let cells = d.columns
    .map((k) => column(d, k))
    .map(
      (c) =>
        `<td>${c.key === "name" && d.swatch ? swatchHtml(x[d.swatch]) : ""}${c.key === "name" && d.photos && photoIds(x).length ? `<span class="withthumb">${coverHtml(x)}<span>${cellHtml(c, x)}</span></span>` : cellHtml(c, x)}</td>`,
    )
    .join("");
  return `<tr data-row="${esc(x.id)}">${cells}<td class="rowacts">${section === "wishlist" ? `<button data-bought="${esc(x.id)}" aria-label="Bought: ${esc(x.name)}">Bought</button>` : ""}<button data-edit="${esc(x.id)}">Edit</button><button class="del" data-del="${esc(x.id)}">Delete</button>${section === "miniatures" ? `<button data-queue="${esc(x.id)}">Queue</button>` : ""}${d.photos ? photosButtonHtml(x) : ""}</td></tr>`;
}
// Redraw one table row after a one-tap change, so the row keeps its place
// (even in a sorted table), then put focus back on the first of `focus`
// (selectors within the row) that's still there and enabled.
function redrawRow(rec, ...focus) {
  let sel = `tr[data-row="${CSS.escape(rec.id)}"]`,
    row = document.querySelector(sel);
  if (!row) return;
  row.outerHTML = rowHtml(defs[section], rec);
  refocus(...focus.map((f) => `${sel} ${f}`));
  fillPhotos(document.querySelector(sel) || document);
}
// A column header: sort by it, or reverse the order if it's already sorted
// by it. Only the display changes; db keeps its order.
function sortBy(key) {
  sort = sort.key === key ? { key, dir: -sort.dir } : { key, dir: 1 };
  renderTable();
}
function renderTable() {
  let d = defs[section],
    cols = d.columns.map((k) => column(d, k)),
    rows = visible();
  if (sort.key) rows = sortRows(rows, column(d, sort.key), sort.dir);
  let head = d.columns
    .map((k, i) => {
      let on = sort.key === k,
        aria = on ? (sort.dir > 0 ? "ascending" : "descending") : "none";
      return `<th aria-sort="${aria}"><button class="sortbtn" data-sort="${k}">${esc(cols[i].label)}${on ? (sort.dir > 0 ? " ▲" : " ▼") : ""}</button></th>`;
    })
    .join("");
  let body = rows.map((x) => rowHtml(d, x)).join("");
  document.querySelector("#content").innerHTML = rows.length
    ? `<div class="tablewrap"><table><thead><tr>${head}<th>Actions</th></tr></thead><tbody>${body}</tbody></table></div>`
    : '<div class="card empty">No matching items.</div>';
  fillPhotos(document.querySelector("#content"));
}
