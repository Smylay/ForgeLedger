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
            `<div>${i + 1}. <b>${esc(q.name)}</b> <span class="muted">${esc(isSplit(q) ? splitText(q) : q.stage || "Not started")}</span></div>`,
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
          return `<div class="stockrow"><span><span class="colour" style="background:${safeColour(p.colour) || "#777"}"></span>${esc(p.brand)} ${esc(p.name)} · <b>${esc(p.stock)}</b>${needed ? ` <span class="muted">· needed for ${needed} queued</span>` : ""}</span>${wanted.has(p.id) ? '<span class="muted">On wishlist</span>' : `<span class="rowacts"><button data-wish="${esc(p.id)}">Add to wishlist</button></span>`}</div>`;
        })
        .join("") +
      (toBuy.length > 1
        ? `<div class="rowacts stockall"><button data-wishall>Add all ${toBuy.length} to wishlist</button></div>`
        : "")
    : '<div class="empty">No paints running low.</div>';
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
        `<td>${c.key === "name" && d.swatch ? swatchHtml(x[d.swatch]) : ""}${cellHtml(c, x)}</td>`,
    )
    .join("");
  return `<tr data-row="${esc(x.id)}">${cells}<td class="rowacts"><button data-edit="${esc(x.id)}">Edit</button><button class="del" data-del="${esc(x.id)}">Delete</button>${section === "miniatures" ? `<button data-queue="${esc(x.id)}">Queue</button>` : ""}</td></tr>`;
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
}
// One queue item: drag handle, position, details with a stage progress
// bar, then its actions. Buttons carry the item id (next, plus) or its
// position (top, up, down), which the click listener in app.js reads.
function queueItemHtml(q, i) {
  let stages = queueStages(),
    last = stages.length - 1,
    split = isSplit(q),
    counts = split ? splitCounts(q) : null,
    // A split item is as far on as its least advanced model.
    n = split
      ? Math.max(
          0,
          counts.findIndex((c) => c > 0),
        )
      : stageIndex(q),
    done = n === last,
    m = linked(column(defs.queue, "miniature"), q.miniature),
    low = done ? [] : lowRecipePaints(m),
    total = queueTotal(q),
    count = stageDoneCount(q),
    working = n > 0 && !done, // in a stage that +1 counts towards
    qid = esc(q.id),
    name = esc(q.name);
  let details = `${split && !done ? "Split by stage" : esc(stages[n])} · ${total} model(s)${q.due ? " · due " + esc(q.due) + " " + dueBadge(q.due, done) : ""}`;
  // Steps after "Not started": earlier stages full, the current one filled
  // as far as its count, later ones empty. Split, each step fills with the
  // share of models past it (or, for Complete, at it).
  let past = (j) =>
    j === last ? counts[last] : counts.slice(j + 1).reduce((a, b) => a + b, 0);
  let fill = (k) =>
    split
      ? Math.round((100 * past(k + 1)) / total)
      : done || k < n - 1
        ? 100
        : k === n - 1
          ? Math.round((100 * count) / total)
          : 0;
  let status = split
    ? splitText(q)
    : working
      ? `${stages[n]}: ${count} of ${total} done`
      : stages[n];
  // Split, the bar's value is the models' average step.
  let now = split
    ? Math.round((10 * counts.reduce((a, c, j) => a + c * j, 0)) / total) / 10
    : n;
  let progress = `<div class="stages" role="progressbar" aria-label="Progress of ${name}" aria-valuemin="0" aria-valuemax="${last}" aria-valuenow="${now}" aria-valuetext="${esc(status)}${split ? "" : `, step ${n} of ${last}`}">${stages
    .slice(1)
    .map(
      (s, k) =>
        `<span title="${esc(s)}"><i style="width:${fill(k)}%"></i></span>`,
    )
    .join("")}</div>`;
  let countLine =
    working && !split
      ? `<div class="muted stagecount">${esc(status)}</div>`
      : "";
  // Split: each stage that has models, with a button to move one on.
  let splitRow =
    split && !done
      ? `<div class="splitrow" role="group" aria-label="Models by stage, ${name}">${stages
          .map((s, j) =>
            counts[j]
              ? `<span class="splitstage">${esc(s)} <b>${counts[j]}</b>${j < last ? `<button class="btn" data-adv="${qid}" data-from="${j}" aria-label="Move 1 to ${esc(stages[j + 1])} from ${esc(s)}, ${name}">Move 1 to ${esc(stages[j + 1])}</button>` : ""}</span>`
              : "",
          )
          .join("")}</div>`
      : "";
  // The toggle: off, every model is at one stage, as before.
  let splitBtn =
    done || total < 2
      ? ""
      : `<button class="btn" data-split="${qid}" aria-pressed="${split}" aria-label="Split by stage: ${name}">Split by stage</button>`;
  let lowLine = low.length
    ? `<div class="warnline">Low paint: ${low.map((p) => `${esc(p.name)} (${esc(p.stock)})`).join(", ")}</div>`
    : "";
  let next =
    done || split
      ? ""
      : `<button class="btn" data-next="${qid}" aria-label="Next: ${esc(stages[n + 1])} for ${name}">Next: ${esc(stages[n + 1])}</button>`;
  // +1 counts in the current stage; from "Not started" it starts the first.
  let plus =
    done || split
      ? ""
      : `<button class="btn" data-plus="${qid}" aria-label="+1 done in ${esc(stages[Math.max(n, 1)])} for ${name}">+1 done</button>`;
  return `<div class="qitem" data-index="${i}"><span class="handle" aria-hidden="true" title="Drag to reorder">⠿</span><div class="qnum">${i + 1}</div><div class="qbody"><b>${name}</b><div class="muted">${details}</div>${progress}${countLine}${splitRow}${lowLine}</div><div class="qactions">${next}${plus}${splitBtn}<span class="rowacts"><button data-top="${i}" aria-label="Move ${name} to top">Top</button><button data-up="${i}" aria-label="Move ${name} up">↑</button><button data-down="${i}" aria-label="Move ${name} down">↓</button><button data-edit="${qid}">Edit</button><button class="del" data-del="${qid}">Delete</button></span></div></div>`;
}
function renderQueue() {
  document.querySelector("#queueContent").innerHTML = db.queue.length
    ? db.queue.map(queueItemHtml).join("")
    : '<div class="card empty">Painting queue is empty.</div>';
}
// After a redraw, put keyboard focus back on the control the user was on
// (or the first fallback that's still there and enabled).
function refocus(...selectors) {
  for (let s of selectors) {
    let el = document.querySelector(s);
    if (el && !el.disabled) return el.focus();
  }
}
function renderSkills() {
  renderSkillPicker();
  renderSkillOverview();
  let guide = document.querySelector("#levelGuide");
  if (!guide.children.length)
    guide.innerHTML = LEVELS.map(
      ([name, meaning]) => `<li><b>${name}:</b> ${meaning}</li>`,
    ).join("");
  document.querySelector("#skillsContent").innerHTML = db.skills
    .map((s) => {
      let level = skillLevel(s),
        sid = esc(s.id),
        next = nextStep(s);
      // A skill from the library gets its next step; one of your own shows
      // your goal, or says there isn't one.
      let goal = s.goal
        ? `<div class="muted">Your goal: ${esc(s.goal)}</div>`
        : next
          ? ""
          : '<div class="muted">No practice goal</div>';
      return `<div class="skill" data-card="${sid}"><div class="skilltop"><b>${esc(s.name)}</b><strong class="lvl">${level}/9 · ${levelName(level)}</strong></div><input type="range" min="0" max="9" value="${level}" data-skill="${sid}" aria-label="${esc(s.name)} proficiency" aria-valuetext="${levelText(level)}"><p class="nextstep"${next ? "" : " hidden"}><span class="muted">Next step:</span> <span class="steptext">${esc(next)}</span></p>${goal}<div class="muted changed">${changedText(s)}</div><div class="rowacts"><button data-edit="${sid}">Edit notes</button><button class="del" data-del="${sid}">Delete</button></div></div>`;
    })
    .join("");
}
// Redraw one card's level, next step and date in place, so a slider being
// dragged isn't replaced.
function updateSkillCard(s) {
  let card = document.querySelector(`[data-card="${CSS.escape(s.id)}"]`),
    level = skillLevel(s);
  if (!card) return;
  card.querySelector(".lvl").textContent = `${level}/9 · ${levelName(level)}`;
  card.querySelector("input").setAttribute("aria-valuetext", levelText(level));
  card.querySelector(".steptext").textContent = nextStep(s);
  card.querySelector(".changed").textContent = changedText(s);
}
// The library techniques you haven't added, then "Other" to name your own.
function renderSkillPicker() {
  let pick = document.querySelector("#skillAdd select"),
    chosen = pick.value,
    left = TECHNIQUES.filter(
      (t) => !db.skills.some((s) => sameName(s.name, t.name)),
    );
  pick.innerHTML = `<option value="">Add a technique…</option>${left
    .map((t) => `<option>${esc(t.name)}</option>`)
    .join("")}<option value="other">Other: name your own…</option>`;
  pick.value = [...pick.options].some((o) => o.value === chosen) ? chosen : "";
}
// The profile (every skill's level, highest first) and practice suggestions.
function renderSkillOverview() {
  let byLevel = [...db.skills].sort((a, b) => skillLevel(b) - skillLevel(a));
  document.querySelector("#skillProfile").innerHTML = byLevel.length
    ? byLevel
        .map((s) => {
          let level = skillLevel(s);
          return `<li><span class="mname">${esc(s.name)}</span><span class="meter" aria-hidden="true"><i style="width:${Math.round((level / 9) * 1000) / 10}%"></i></span><span class="mval">${level} · ${levelName(level)}</span></li>`;
        })
        .join("")
    : '<li class="muted">No skills yet. Add one above.</li>';
  let picks = practiceNext(db.skills);
  document.querySelector("#practice").innerHTML = picks.length
    ? `<ol class="practice">${picks
        .map(({ skill, reason }) => {
          let advice = nextStep(skill) || skill.goal || "";
          return `<li><b>${esc(skill.name)}</b> <span class="muted">· ${reason}</span>${advice ? `<div>${esc(advice)}</div>` : ""}</li>`;
        })
        .join("")}</ol>`
    : `<p class="muted">${db.skills.length ? "Every skill is at Mastery." : "Add a skill to get suggestions."}</p>`;
}
