// Everything that draws a view: nav, dashboard, tables, queue, skills.
"use strict";

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
        `<button data-sec="${k}" class="${section === k ? "active" : ""}">${n}${k === "dashboard" ? "" : `<span class="count">${db[k].length}</span>`}</button>`,
    )
    .join("");
}
// Show a section: "dashboard" or a key of `defs`.
function go(k) {
  let d = defs[k];
  section = k;
  editId = null;
  document.querySelector("#search").value = "";
  document.querySelector("#filter").innerHTML = ""; // resets the filter
  sort = { key: "", dir: 1 };
  renderNav();
  document
    .querySelectorAll(".view")
    .forEach((x) => x.classList.remove("active"));
  document.querySelector("#title").textContent = d ? d.title : "Dashboard";
  document.querySelector("#subtitle").textContent = d
    ? d.sub
    : "Your hobby at a glance";
  document
    .querySelector("#" + (d ? d.view || "listView" : "dashboard"))
    .classList.add("active");
  document.querySelector("#addBtn").style.display = d ? "inline-block" : "none";
  render();
}
function render() {
  if (section === "dashboard") renderDashboard();
  else if (section === "queue") renderQueue();
  else if (section === "skills") renderSkills();
  else renderList();
}
function renderDashboard() {
  let modelCount = db.miniatures.reduce(
      (a, x) => a + Number(x.quantity || 1),
      0,
    ),
    painted = db.miniatures.reduce((a, x) => a + Number(x.painted || 0), 0),
    spend = ["paints", "tools", "miniatures"]
      .flatMap((k) => db[k])
      .reduce((a, x) => a + Number(x.price || 0), 0);
  let cards = [
    ["Paints", db.paints.length],
    ["Models", modelCount],
    ["Painted", painted],
    ["Recorded spend", money(spend)],
  ];
  document.querySelector("#metrics").innerHTML = cards
    .map(
      (x) =>
        `<div class="card metric"><div class="muted">${x[0]}</div><div class="v">${x[1]}</div></div>`,
    )
    .join("");
  document.querySelector("#projectSummary").innerHTML = db.projects.length
    ? db.projects
        .map((p) => {
          let st = projectStats(p),
            due = dueBadge(p.deadline, projectDone(p)),
            goal = Number(p.target) || st.models,
            pc = goal
              ? Math.min(100, Math.round((100 * st.painted) / goal))
              : 0;
          return `<div class="project"><div class="projectfoot"><b>${esc(p.name)}${due ? " " + due : ""}</b><span>${pc}%</span></div><div class="chart"><div class="bar" style="width:${pc}%"></div></div><small class="muted">${st.painted} of ${goal} models painted · ${st.models} owned · ${money(st.spent)} / ${money(p.budget)}</small></div><br>`;
        })
        .join("")
    : '<div class="empty">No army projects yet.</div>';
  document.querySelector("#queueSummary").innerHTML = db.queue.length
    ? db.queue
        .slice(0, 5)
        .map(
          (q, i) =>
            `<div>${i + 1}. <b>${esc(q.name)}</b> <span class="muted">${esc(q.stage || "Not started")}</span></div>`,
        )
        .join("")
    : '<div class="empty">Queue is empty.</div>';
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
          return `<div class="stockrow"><span><span class="colour" style="background:${safeColour(p.colour) || "#777"}"></span>${esc(p.brand)} ${esc(p.name)} · <b>${Number(p.remaining || 0)}%</b>${needed ? ` <span class="muted">· needed for ${needed} queued</span>` : ""}</span>${wanted.has(p.id) ? '<span class="muted">On wishlist</span>' : `<span class="rowacts"><button data-wish="${esc(p.id)}">Add to wishlist</button></span>`}</div>`;
        })
        .join("") +
      (toBuy.length > 1
        ? `<div class="rowacts stockall"><button data-wishall>Add all ${toBuy.length} to wishlist</button></div>`
        : "")
    : '<div class="empty">No paints below 20%.</div>';
  let age = backupAgeDays();
  document.querySelector("#backupNotice").innerHTML =
    hasUserData() && (age === null || age >= BACKUP_REMINDER_DAYS)
      ? `<div class="notice warn">Your data is only stored in this browser. Last backup: ${backupText(age)}. Use <b>Export backup</b> to save a copy.</div>`
      : "";
  let wish = db.wishlist.reduce((a, x) => a + Number(x.price || 0), 0);
  document.querySelector("#spendSummary").innerHTML =
    `<div class="metric"><div class="v">${money(spend)}</div><div class="muted">Owned collection spend</div><br><div class="v">${money(wish)}</div><div class="muted">Wishlist exposure</div></div>`;
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
          `<span class="chip">${safeColour(r.colour) ? `<span class="colour" style="background:${safeColour(r.colour)}"></span>` : ""}${esc(r.name)}${isLow(r) ? ` <span class="pill warn">${Number(r.remaining)}%</span>` : ""}</span>`,
      )
      .join(" ");
  return esc(cellText(f, x));
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
  let body = rows
    .map(
      (x) =>
        `<tr>${cols.map((c) => `<td>${cellHtml(c, x)}</td>`).join("")}<td class="rowacts"><button data-edit="${esc(x.id)}">Edit</button><button class="del" data-del="${esc(x.id)}">Delete</button>${section === "miniatures" ? `<button data-queue="${esc(x.id)}">Queue</button>` : ""}</td></tr>`,
    )
    .join("");
  document.querySelector("#content").innerHTML = rows.length
    ? `<div class="tablewrap"><table><thead><tr>${head}<th>Actions</th></tr></thead><tbody>${body}</tbody></table></div>`
    : '<div class="card empty">No matching items.</div>';
}
function renderQueue() {
  document.querySelector("#queueContent").innerHTML = db.queue.length
    ? db.queue
        .map((q, i) => {
          let low =
            q.stage === "Complete"
              ? []
              : lowRecipePaints(
                  linked(column(defs.queue, "miniature"), q.miniature),
                );
          return `<div class="qitem"><div class="qnum">${i + 1}</div><div><b>${esc(q.name)}</b><div class="muted">${esc(q.stage || "Not started")} · ${esc(q.models || 1)} model(s)${q.due ? " · due " + esc(q.due) + " " + dueBadge(q.due, q.stage === "Complete") : ""}</div>${low.length ? `<div class="warnline">Low paint: ${low.map((p) => `${esc(p.name)} (${Number(p.remaining)}%)`).join(", ")}</div>` : ""}</div><div class="rowacts"><button data-up="${i}">↑</button><button data-down="${i}">↓</button><button data-edit="${esc(q.id)}">Edit</button><button class="del" data-del="${esc(q.id)}">Delete</button></div></div>`;
        })
        .join("")
    : '<div class="card empty">Painting queue is empty.</div>';
}
function renderSkills() {
  document.querySelector("#skillsContent").innerHTML = db.skills
    .map((s) => {
      let level = Math.max(0, Math.min(9, Number(s.level) || 0)),
        sid = esc(s.id);
      return `<div class="skill"><div class="skilltop"><b>${esc(s.name)}</b><strong>${level}/9</strong></div><input type="range" min="0" max="9" value="${level}" data-skill="${sid}" aria-label="${esc(s.name)} proficiency"><div class="muted">${esc(s.goal || "No practice goal")}</div><div class="rowacts"><button data-edit="${sid}">Edit notes</button><button class="del" data-del="${sid}">Delete</button></div></div>`;
    })
    .join("");
}
