(() => {
  "use strict";
  const KEY = "forgeledger_v2_data";
  // Bump when stored data changes shape, and add a step to migrate().
  const SCHEMA_VERSION = 1;
  const BACKUP_KEY = "forgeledger_v2_last_backup";
  const RECOVERY_PREFIX = "forgeledger_v2_recovered_";
  const BACKUP_REMINDER_DAYS = 14;
  const COLLECTIONS = [
    "paints",
    "tools",
    "miniatures",
    "projects",
    "queue",
    "wishlist",
    "skills",
  ];
  const defaults = {
    schemaVersion: SCHEMA_VERSION,
    paints: [],
    tools: [],
    miniatures: [],
    projects: [],
    queue: [],
    wishlist: [],
    skills: [
      ["Drybrushing", 0],
      ["Washing & shading", 0],
      ["Layering", 0],
      ["Edge highlighting", 0],
      ["Glazing", 0],
      ["Wet blending", 0],
      ["Airbrushing", 0],
      ["Weathering", 0],
      ["Object-source lighting", 0],
      ["Non-metallic metal", 0],
    ].map((x) => ({ id: id(), name: x[0], level: x[1], notes: "", goal: "" })),
  };
  let memoryOnly = false, // storage is blocked: changes live in memory only
    recovered = null, // { raw, problem } when saved data needed repair
    toastTimer;
  let db = load(),
    section = "dashboard",
    editId = null;
  const defs = {
    paints: {
      title: "Paints",
      sub: "Brands, ranges, stock and replacement warnings",
      fields: [
        ["name", "Paint name", "text", 1],
        ["brand", "Brand", "text"],
        ["range", "Range", "text"],
        ["colour", "Colour / hex", "color"],
        [
          "type",
          "Type",
          "select",
          [
            "Base",
            "Layer",
            "Shade",
            "Contrast/Speedpaint",
            "Metallic",
            "Technical",
            "Ink",
            "Medium",
            "Other",
          ],
        ],
        ["quantity", "Quantity", "number"],
        ["remaining", "Remaining %", "number"],
        ["price", "Cost (£)", "number"],
        ["notes", "Notes", "textarea"],
      ],
    },
    tools: {
      title: "Tools",
      sub: "Brushes, airbrush equipment and hobby supplies",
      fields: [
        ["name", "Tool", "text", 1],
        [
          "category",
          "Category",
          "select",
          [
            "Brush",
            "Airbrush",
            "Cutting",
            "Assembly",
            "Basing",
            "Lighting",
            "Storage",
            "Other",
          ],
        ],
        [
          "condition",
          "Condition",
          "select",
          ["New", "Good", "Worn", "Replace soon"],
        ],
        ["quantity", "Quantity", "number"],
        ["price", "Cost (£)", "number"],
        ["notes", "Notes", "textarea"],
      ],
    },
    miniatures: {
      title: "Miniatures",
      sub: "Models, units and their painting state",
      fields: [
        ["name", "Miniature / unit", "text", 1],
        ["faction", "Faction", "text"],
        ["project", "Army project", "project"],
        ["quantity", "Model count", "number"],
        ["painted", "Painted count", "number"],
        [
          "status",
          "Status",
          "select",
          ["Unbuilt", "Built", "Primed", "In progress", "Complete"],
        ],
        ["price", "Cost (£)", "number"],
        ["recipe", "Paint recipe", "textarea"],
        ["notes", "Notes", "textarea"],
      ],
    },
    projects: {
      title: "Army projects",
      sub: "Track complete forces, goals, budgets and progress",
      fields: [
        ["name", "Project name", "text", 1],
        ["faction", "Faction", "text"],
        ["system", "Game system", "text"],
        ["target", "Target model count", "number"],
        ["budget", "Budget (£)", "number"],
        ["deadline", "Target date", "date"],
        ["notes", "Notes", "textarea"],
      ],
    },
    wishlist: {
      title: "Wishlist",
      sub: "Future paints, tools and miniatures",
      fields: [
        ["name", "Wanted item", "text", 1],
        [
          "category",
          "Category",
          "select",
          ["Paint", "Tool", "Miniature", "Terrain", "Book", "Other"],
        ],
        ["priority", "Priority", "select", ["Low", "Medium", "High"]],
        ["price", "Expected cost (£)", "number"],
        ["url", "Product URL", "url"],
        ["notes", "Notes", "textarea"],
      ],
    },
  };
  const navItems = [
    ["dashboard", "Dashboard"],
    ["paints", "Paints"],
    ["tools", "Tools"],
    ["miniatures", "Miniatures"],
    ["projects", "Army projects"],
    ["queue", "Painting queue"],
    ["skills", "Skills"],
    ["wishlist", "Wishlist"],
  ];
  function id() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  // A function declaration, not a const: load() runs before this line.
  function isRecord(x) {
    return x !== null && typeof x === "object" && !Array.isArray(x);
  }

  // Say why `data` can't be used as ForgeLedger data, or return "" if it can.
  // Imports with a problem are rejected; saved data with one is repaired.
  function problemWith(data) {
    if (!isRecord(data)) return "it isn't a ForgeLedger backup";
    if (!COLLECTIONS.some((k) => k in data))
      return "it has no ForgeLedger data in it";
    if (Number(data.schemaVersion) > SCHEMA_VERSION)
      return "it was made by a newer version of ForgeLedger";
    let bad = COLLECTIONS.find(
      (k) => k in data && !(Array.isArray(data[k]) && data[k].every(isRecord)),
    );
    return bad ? `the "${bad}" section is damaged` : "";
  }

  // Keep every usable collection and record; drop what can't be used.
  function repair(data) {
    for (let k of COLLECTIONS) {
      if (Array.isArray(data[k])) data[k] = data[k].filter(isRecord);
      else delete data[k];
    }
    return data;
  }

  // Give every record a unique string id; hand-made backups may lack one.
  function fillIds(data) {
    for (let k of COLLECTIONS) {
      let seen = new Set();
      for (let r of data[k] || []) {
        if (typeof r.id === "number") r.id = String(r.id);
        if (typeof r.id !== "string" || !r.id || seen.has(r.id)) r.id = id();
        seen.add(r.id);
      }
    }
    return data;
  }

  // Bring data from an older schema up to SCHEMA_VERSION. When stored data
  // changes shape, add a step here rather than renaming fields in place.
  function migrate(data) {
    // 0 (no schemaVersion) -> 1: the version field was added, nothing else.
    data.schemaVersion = SCHEMA_VERSION;
    return data;
  }

  function fromBackup(data) {
    return Object.assign(structuredClone(defaults), migrate(fillIds(data)));
  }

  // Read saved data. If it needs repair, the original is kept under a
  // recovery key first, so nothing is ever silently overwritten.
  function load() {
    let raw, data;
    try {
      raw = localStorage.getItem(KEY);
    } catch {
      memoryOnly = true;
      return structuredClone(defaults);
    }
    if (raw === null) return structuredClone(defaults);
    try {
      data = JSON.parse(raw);
    } catch {
      data = undefined;
    }
    let problem =
      data === undefined ? "it isn't valid JSON" : problemWith(data);
    if (problem) {
      recovered = { raw, problem };
      try {
        localStorage.setItem(RECOVERY_PREFIX + new Date().toISOString(), raw);
      } catch {}
      data = isRecord(data) ? repair(data) : {};
    }
    return fromBackup(data);
  }

  function setSaveState(text) {
    document.querySelector("#saveState").textContent = text;
  }

  function save() {
    if (memoryOnly) {
      setSaveState("Not saved: storage is blocked");
      return true;
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
    } catch {
      setSaveState("Not saved");
      toast("Couldn't save: browser storage is full or blocked.", 6000);
      return false;
    }
    setSaveState(
      "Saved " +
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
    );
    return true;
  }

  // Apply a change to db and save it. If saving fails, undo the change so
  // what's on screen always matches what's stored.
  function commit(change) {
    let before = structuredClone(db);
    change();
    if (save()) return true;
    db = before;
    return false;
  }

  // True once anything differs from a fresh install, ignoring ids.
  function hasUserData() {
    let plain = (d) =>
      JSON.stringify(
        COLLECTIONS.map((k) =>
          k === "skills" ? d.skills.map(({ id: _, ...s }) => s) : d[k],
        ),
      );
    return plain(db) !== plain(defaults);
  }

  function backupAgeDays() {
    let t = 0;
    try {
      t = Number(localStorage.getItem(BACKUP_KEY)) || 0;
    } catch {}
    return t ? Math.floor((Date.now() - t) / 864e5) : null;
  }

  function backupText(days) {
    if (days === null) return "never";
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    return `${days} days ago`;
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
  function esc(s) {
    return String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }
  function money(n) {
    return "£" + Number(n || 0).toFixed(2);
  }
  function projectStats(p) {
    let minis = db.miniatures.filter((m) => m.project === p.id);
    return {
      models: minis.reduce((a, m) => a + Number(m.quantity || 1), 0),
      painted: minis.reduce((a, m) => a + Number(m.painted || 0), 0),
      spent: minis.reduce((a, m) => a + Number(m.price || 0), 0),
    };
  }
  function toast(s, ms = 1800) {
    let e = document.querySelector("#toast");
    e.textContent = s;
    e.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (e.style.display = "none"), ms);
  }
  function renderNav() {
    document.querySelector("#nav").innerHTML = navItems
      .map(
        ([k, n]) =>
          `<button data-sec="${k}" class="${section === k ? "active" : ""}">${n}<span class="count">${k === "dashboard" ? "" : k === "queue" ? db.queue.length : k === "skills" ? db.skills.length : (db[k] || []).length}</span></button>`,
      )
      .join("");
  }
  function go(k) {
    section = k;
    editId = null;
    document.querySelector("#search").value = "";
    renderNav();
    document
      .querySelectorAll(".view")
      .forEach((x) => x.classList.remove("active"));
    let title = "Dashboard",
      sub = "Your hobby at a glance",
      view = "dashboard";
    if (k === "queue") {
      title = "Painting queue";
      sub = "Prioritised models awaiting paint";
      view = "queueView";
    } else if (k === "skills") {
      title = "Skill proficiency";
      sub = "Track development from 0 to 9";
      view = "skillsView";
    } else if (k !== "dashboard") {
      title = defs[k].title;
      sub = defs[k].sub;
      view = "listView";
    }
    document.querySelector("#title").textContent = title;
    document.querySelector("#subtitle").textContent = sub;
    document.querySelector("#" + view).classList.add("active");
    document.querySelector("#addBtn").style.display =
      k === "dashboard" ? "none" : "inline-block";
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
              goal = Number(p.target) || st.models,
              pc = goal
                ? Math.min(100, Math.round((100 * st.painted) / goal))
                : 0;
            return `<div class="project"><div class="projectfoot"><b>${esc(p.name)}</b><span>${pc}%</span></div><div class="chart"><div class="bar" style="width:${pc}%"></div></div><small class="muted">${st.painted} of ${goal} models painted · ${st.models} owned · ${money(st.spent)} / ${money(p.budget)}</small></div><br>`;
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
    let low = db.paints.filter(
      (p) =>
        p.remaining !== "" && p.remaining != null && Number(p.remaining) < 20,
    );
    document.querySelector("#stockSummary").innerHTML = low.length
      ? low
          .map(
            (p) =>
              `<div><span class="colour" style="background:${p.colour || "#777"}"></span>${esc(p.brand)} ${esc(p.name)} · <b>${Number(p.remaining || 0)}%</b></div>`,
          )
          .join("")
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
  function visible() {
    let q = document.querySelector("#search").value.toLowerCase(),
      f = document.querySelector("#filter").value;
    return db[section].filter(
      (x) =>
        (!q || JSON.stringify(x).toLowerCase().includes(q)) &&
        (!f || Object.values(x).includes(f)),
    );
  }
  function renderList() {
    let d = defs[section],
      filter = document.querySelector("#filter");
    let options = [];
    if (section === "paints")
      options = d.fields.find((x) => x[0] === "type")[3];
    if (section === "wishlist") options = ["Low", "Medium", "High"];
    if (section === "miniatures")
      options = ["Unbuilt", "Built", "Primed", "In progress", "Complete"];
    filter.innerHTML =
      '<option value="">All</option>' +
      options.map((x) => `<option>${x}</option>`).join("");
    renderTable();
  }
  function renderTable() {
    let rows = visible(),
      columns = {
        paints: ["name", "brand", "range", "type", "quantity", "remaining"],
        tools: ["name", "category", "condition", "quantity", "price"],
        miniatures: [
          "name",
          "faction",
          "project",
          "quantity",
          "painted",
          "status",
        ],
        projects: [
          "name",
          "faction",
          "system",
          "painted",
          "models",
          "target",
          "spent",
          "deadline",
        ],
        wishlist: ["name", "category", "priority", "price", "url"],
      }[section],
      stats =
        section === "projects"
          ? Object.fromEntries(rows.map((x) => [x.id, projectStats(x)]))
          : {};
    let head = columns.map((c) => `<th>${c}</th>`).join("");
    let body = rows
      .map(
        (x) =>
          `<tr>${columns
            .map((c) => {
              let v = stats[x.id]?.[c] ?? x[c] ?? "";
              if (c === "colour")
                v = `<span class="colour" style="background:${v}"></span>${esc(v)}`;
              else if (c === "price" || c === "budget" || c === "spent")
                v = money(v);
              else if (c === "remaining") v = esc(v) + "%";
              else if (c === "project")
                v = esc(db.projects.find((p) => p.id === v)?.name || v);
              else if (c === "url" && v)
                v = `<a href="${esc(v)}" target="_blank" style="color:var(--blue)">Open</a>`;
              else v = esc(v);
              return `<td>${v}</td>`;
            })
            .join(
              "",
            )}<td class="rowacts"><button data-edit="${x.id}">Edit</button><button class="del" data-del="${x.id}">Delete</button>${section === "miniatures" ? `<button data-queue="${x.id}">Queue</button>` : ""}</td></tr>`,
      )
      .join("");
    document.querySelector("#content").innerHTML = rows.length
      ? `<div class="tablewrap"><table><thead><tr>${head}<th>Actions</th></tr></thead><tbody>${body}</tbody></table></div>`
      : '<div class="card empty">No matching items.</div>';
  }
  function fieldHtml(f, obj) {
    let [k, l, t, req] = f,
      v = obj[k] ?? "",
      r = req === 1 ? "required" : "";
    if (t === "select")
      return `<label>${l}<select name="${k}" ${r}><option value="">Select...</option>${req.map ? req.map((o) => `<option ${v === o ? "selected" : ""}>${o}</option>`).join("") : ""}</select></label>`;
    if (t === "project")
      return `<label>${l}<select name="${k}"><option value="">None</option>${db.projects.map((p) => `<option value="${p.id}" ${v === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("")}</select></label>`;
    if (t === "textarea")
      return `<label class="full">${l}<textarea name="${k}">${esc(v)}</textarea></label>`;
    let min = t === "number" ? 'min="0" step="0.01"' : "";
    return `<label>${l}<input name="${k}" type="${t}" value="${esc(v)}" ${min} ${r}></label>`;
  }
  function openForm(sec = section, obj = {}) {
    section = sec;
    editId = obj.id || null;
    let fields =
      sec === "queue"
        ? [
            ["name", "Queue item", "text", 1],
            ["project", "Army project", "project"],
            [
              "stage",
              "Stage",
              "select",
              [
                "Not started",
                "Building",
                "Priming",
                "Basecoating",
                "Detailing",
                "Basing",
                "Complete",
              ],
            ],
            ["models", "Model count", "number"],
            ["due", "Target date", "date"],
            ["notes", "Notes", "textarea"],
          ]
        : sec === "skills"
          ? [
              ["name", "Skill", "text", 1],
              ["level", "Proficiency 0-9", "number"],
              ["goal", "Next practice goal", "text"],
              ["notes", "Notes", "textarea"],
            ]
          : defs[sec].fields;
    document.querySelector("#modalTitle").textContent =
      (editId ? "Edit " : "Add ") +
      (sec === "queue"
        ? "queue item"
        : sec === "skills"
          ? "skill"
          : defs[sec].title.toLowerCase());
    document.querySelector("#formFields").innerHTML = fields
      .map((f) => fieldHtml(f, obj))
      .join("");
    document.querySelector("#modal").showModal();
  }
  function submit(e) {
    e.preventDefault();
    let o = Object.fromEntries(new FormData(e.target));
    if (section === "skills")
      o.level = Math.max(0, Math.min(9, Number(o.level || 0)));
    o.id = editId || id();
    let saved = commit(() => {
      let arr = db[section],
        i = arr.findIndex((x) => x.id === o.id);
      if (i >= 0) arr[i] = o;
      else arr.push(o);
    });
    if (!saved) return; // keep the form open so nothing typed is lost
    document.querySelector("#modal").close();
    toast("Saved");
    renderNav();
    render();
  }
  function renderQueue() {
    document.querySelector("#queueContent").innerHTML = db.queue.length
      ? db.queue
          .map(
            (q, i) =>
              `<div class="qitem"><div class="qnum">${i + 1}</div><div><b>${esc(q.name)}</b><div class="muted">${esc(q.stage || "Not started")} · ${esc(q.models || 1)} model(s)${q.due ? " · due " + esc(q.due) : ""}</div></div><div class="rowacts"><button data-up="${i}">↑</button><button data-down="${i}">↓</button><button data-editq="${q.id}">Edit</button><button class="del" data-delq="${q.id}">Delete</button></div></div>`,
          )
          .join("")
      : '<div class="card empty">Painting queue is empty.</div>';
  }
  function renderSkills() {
    document.querySelector("#skillsContent").innerHTML = db.skills
      .map(
        (s) =>
          `<div class="skill"><div class="skilltop"><b>${esc(s.name)}</b><strong>${s.level}/9</strong></div><input type="range" min="0" max="9" value="${s.level}" data-skill="${s.id}"><div class="muted">${esc(s.goal || "No practice goal")}</div><div class="rowacts"><button data-edits="${s.id}">Edit notes</button><button class="del" data-dels="${s.id}">Delete</button></div></div>`,
      )
      .join("");
  }
  function download(text, name, type = "application/json") {
    let a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const today = () => new Date().toISOString().slice(0, 10);
  function exportJSON() {
    download(JSON.stringify(db, null, 2), `forgeledger-backup-${today()}.json`);
    try {
      localStorage.setItem(BACKUP_KEY, String(Date.now()));
    } catch {}
    renderBackupState();
    if (section === "dashboard") renderDashboard();
  }
  function csv() {
    let arr = db[section];
    if (!arr.length) return toast("Nothing to export");
    let keys = [...new Set(arr.flatMap(Object.keys))],
      cell = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"',
      text = [
        keys.map(cell).join(","),
        ...arr.map((o) => keys.map((k) => cell(o[k])).join(",")),
      ].join("\n");
    download(text, section + ".csv", "text/csv");
  }
  function importJSON(file) {
    let r = new FileReader();
    r.onload = () => {
      let data, problem;
      try {
        data = JSON.parse(r.result);
        problem = problemWith(data);
      } catch {
        problem = "it isn't valid JSON";
      }
      if (problem) return toast(`Can't import this file: ${problem}.`, 5000);
      if (hasUserData()) {
        if (
          !confirm(
            "Replace all current data with this backup?\n\nA copy of your current data will be downloaded first.",
          )
        )
          return;
        download(
          JSON.stringify(db, null, 2),
          `forgeledger-before-import-${today()}.json`,
        );
      }
      let next = fromBackup(data);
      if (!commit(() => (db = next))) return;
      go("dashboard");
      toast("Backup imported");
    };
    r.readAsText(file);
  }
  document.addEventListener("click", (e) => {
    let b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.sec) go(b.dataset.sec);
    if (b.dataset.edit)
      openForm(
        section,
        db[section].find((x) => x.id === b.dataset.edit),
      );
    if (b.dataset.recovery === "download")
      download(recovered.raw, `forgeledger-unreadable-data-${today()}.json`);
    if (b.dataset.recovery === "dismiss") {
      recovered = null;
      renderAlerts();
    }
    if (b.dataset.del && confirm("Delete this item?")) {
      commit(
        () => (db[section] = db[section].filter((x) => x.id !== b.dataset.del)),
      );
      renderNav();
      renderTable();
    }
    if (b.dataset.queue) {
      let m = db.miniatures.find((x) => x.id === b.dataset.queue);
      let queued = commit(() =>
        db.queue.push({
          id: id(),
          name: m.name,
          project: m.project || "",
          stage: "Not started",
          models: m.quantity || 1,
          due: "",
          notes: "",
        }),
      );
      renderNav();
      if (queued) toast("Added to queue");
    }
    if (b.dataset.editq)
      openForm(
        "queue",
        db.queue.find((x) => x.id === b.dataset.editq),
      );
    if (b.dataset.delq) {
      commit(
        () => (db.queue = db.queue.filter((x) => x.id !== b.dataset.delq)),
      );
      renderNav();
      renderQueue();
    }
    if (b.dataset.edits)
      openForm(
        "skills",
        db.skills.find((x) => x.id === b.dataset.edits),
      );
    if (b.dataset.dels) {
      commit(
        () => (db.skills = db.skills.filter((x) => x.id !== b.dataset.dels)),
      );
      renderNav();
      renderSkills();
    }
    if (b.dataset.up !== undefined || b.dataset.down !== undefined) {
      let i = +(b.dataset.up ?? b.dataset.down),
        j = b.dataset.up !== undefined ? i - 1 : i + 1;
      if (j >= 0 && j < db.queue.length)
        commit(() => ([db.queue[i], db.queue[j]] = [db.queue[j], db.queue[i]]));
      renderQueue();
    }
  });
  document.querySelector("#addBtn").onclick = () => openForm(section);
  document.querySelector("#itemForm").onsubmit = submit;
  document.querySelector("#closeModal").onclick = document.querySelector(
    "#cancelModal",
  ).onclick = () => document.querySelector("#modal").close();
  document.querySelector("#backupBtn").onclick = exportJSON;
  document.querySelector("#importBtn").onclick = () =>
    document.querySelector("#importFile").click();
  document.querySelector("#importFile").onchange = (e) => {
    let file = e.target.files[0];
    e.target.value = ""; // so choosing the same file again still triggers
    if (file) importJSON(file);
  };
  document.querySelector("#csvBtn").onclick = csv;
  document.querySelector("#search").oninput = renderTable;
  document.querySelector("#filter").onchange = renderTable;
  document.querySelector("#skillsContent").oninput = (e) => {
    if (e.target.dataset.skill) {
      let level = +e.target.value;
      let saved = commit(
        () =>
          (db.skills.find((x) => x.id === e.target.dataset.skill).level =
            level),
      );
      if (!saved) return renderSkills();
      e.target.closest(".skill").querySelector(".skilltop strong").textContent =
        level + "/9";
    }
  };
  // Another tab saved: adopt its data so this tab doesn't overwrite it later.
  window.addEventListener("storage", (e) => {
    if (e.key === BACKUP_KEY) renderBackupState();
    if (e.key !== KEY || e.newValue === null) return;
    db = load();
    renderNav();
    render();
    renderAlerts();
    toast("Updated with changes from another tab");
  });
  go("dashboard");
  renderBackupState();
  renderAlerts();
})();
