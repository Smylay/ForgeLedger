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
    undo = null, // copy of db from just before the last undoable change
    completing = null, // id of the queue item the completion prompt is about
    toastTimer;
  let db = load(),
    section = "dashboard",
    editId = null;
  // Every collection, in nav order. This drives the nav, page titles, forms,
  // table columns, the filter dropdown and search.
  //   view:     section element to show; list collections use #listView.
  //   columns:  field keys (or `computed` keys) shown in the table.
  //   filter:   key of the field the filter dropdown filters on.
  //   computed: read-only columns calculated from other data.
  // Field types: text (default), textarea, select (needs `options`), link
  // (stores the id of a record in collection `to`), links (an array of ids),
  // date, url, color, count, money, percent, level.
  const defs = {
    paints: {
      title: "Paints",
      noun: "paint",
      sub: "Brands, ranges, stock and replacement warnings",
      fields: [
        { key: "name", label: "Paint name", required: true },
        { key: "brand", label: "Brand" },
        { key: "range", label: "Range" },
        { key: "colour", label: "Colour / hex", type: "color" },
        {
          key: "type",
          label: "Type",
          type: "select",
          options: [
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
        },
        { key: "quantity", label: "Quantity", type: "count" },
        { key: "remaining", label: "Remaining %", type: "percent" },
        { key: "price", label: "Cost (£)", type: "money" },
        { key: "notes", label: "Notes", type: "textarea" },
      ],
      columns: ["name", "brand", "range", "type", "quantity", "remaining"],
      filter: "type",
    },
    tools: {
      title: "Tools",
      noun: "tool",
      sub: "Brushes, airbrush equipment and hobby supplies",
      fields: [
        { key: "name", label: "Tool", required: true },
        {
          key: "category",
          label: "Category",
          type: "select",
          options: [
            "Brush",
            "Airbrush",
            "Cutting",
            "Assembly",
            "Basing",
            "Lighting",
            "Storage",
            "Other",
          ],
        },
        {
          key: "condition",
          label: "Condition",
          type: "select",
          options: ["New", "Good", "Worn", "Replace soon"],
        },
        { key: "quantity", label: "Quantity", type: "count" },
        { key: "price", label: "Cost (£)", type: "money" },
        { key: "notes", label: "Notes", type: "textarea" },
      ],
      columns: ["name", "category", "condition", "quantity", "price"],
      filter: "category",
    },
    miniatures: {
      title: "Miniatures",
      noun: "miniature",
      sub: "Models, units and their painting state",
      fields: [
        { key: "name", label: "Miniature / unit", required: true },
        { key: "faction", label: "Faction" },
        { key: "project", label: "Army project", type: "link", to: "projects" },
        { key: "quantity", label: "Model count", type: "count" },
        {
          key: "painted",
          label: "Painted count",
          type: "count",
          atMost: "quantity",
        },
        {
          key: "status",
          label: "Status",
          type: "select",
          options: ["Unbuilt", "Built", "Primed", "In progress", "Complete"],
        },
        { key: "price", label: "Cost (£)", type: "money" },
        { key: "paints", label: "Recipe paints", type: "links", to: "paints" },
        { key: "recipe", label: "Recipe steps", type: "textarea" },
        { key: "notes", label: "Notes", type: "textarea" },
      ],
      columns: [
        "name",
        "faction",
        "project",
        "quantity",
        "painted",
        "status",
        "paints",
      ],
      filter: "status",
    },
    projects: {
      title: "Army projects",
      noun: "army project",
      sub: "Track complete forces, goals, budgets and progress",
      fields: [
        { key: "name", label: "Project name", required: true },
        { key: "faction", label: "Faction" },
        { key: "system", label: "Game system" },
        { key: "target", label: "Target model count", type: "count" },
        { key: "budget", label: "Budget (£)", type: "money" },
        { key: "deadline", label: "Target date", type: "date" },
        { key: "notes", label: "Notes", type: "textarea" },
      ],
      computed: {
        painted: {
          label: "Painted",
          type: "count",
          value: (p) => projectStats(p).painted,
        },
        models: {
          label: "Models owned",
          type: "count",
          value: (p) => projectStats(p).models,
        },
        spent: {
          label: "Spent",
          type: "money",
          value: (p) => projectStats(p).spent,
        },
      },
      columns: [
        "name",
        "faction",
        "system",
        "painted",
        "models",
        "target",
        "spent",
        "deadline",
      ],
      filter: "system",
    },
    queue: {
      title: "Painting queue",
      noun: "queue item",
      sub: "Prioritised models awaiting paint",
      view: "queueView",
      fields: [
        { key: "name", label: "Queue item", required: true },
        {
          key: "miniature",
          label: "Miniature",
          type: "link",
          to: "miniatures",
        },
        { key: "project", label: "Army project", type: "link", to: "projects" },
        {
          key: "stage",
          label: "Stage",
          type: "select",
          options: [
            "Not started",
            "Building",
            "Priming",
            "Basecoating",
            "Detailing",
            "Basing",
            "Complete",
          ],
        },
        { key: "models", label: "Model count", type: "count" },
        { key: "due", label: "Target date", type: "date" },
        { key: "notes", label: "Notes", type: "textarea" },
      ],
    },
    skills: {
      title: "Skill proficiency",
      nav: "Skills",
      noun: "skill",
      sub: "Track development from 0 to 9",
      view: "skillsView",
      fields: [
        { key: "name", label: "Skill", required: true },
        { key: "level", label: "Proficiency 0-9", type: "level" },
        { key: "goal", label: "Next practice goal" },
        { key: "notes", label: "Notes", type: "textarea" },
      ],
    },
    wishlist: {
      title: "Wishlist",
      noun: "wishlist item",
      sub: "Future paints, tools and miniatures",
      fields: [
        { key: "name", label: "Wanted item", required: true },
        {
          key: "category",
          label: "Category",
          type: "select",
          options: ["Paint", "Tool", "Miniature", "Terrain", "Book", "Other"],
        },
        {
          key: "priority",
          label: "Priority",
          type: "select",
          options: ["Low", "Medium", "High"],
        },
        { key: "paint", label: "Restocks paint", type: "link", to: "paints" },
        { key: "price", label: "Expected cost (£)", type: "money" },
        { key: "url", label: "Product URL", type: "url" },
        { key: "notes", label: "Notes", type: "textarea" },
      ],
      columns: ["name", "category", "priority", "price", "url"],
      filter: "priority",
    },
  };
  // A field or computed column of collection `d`, by key.
  function column(d, key) {
    return d.computed?.[key] || d.fields.find((f) => f.key === key);
  }
  // HTML attributes for each input type that uses a plain <input>.
  const inputAttrs = {
    text: 'type="text"',
    date: 'type="date"',
    url: 'type="url" pattern="https?://.+" title="Starts with http:// or https://"',
    count: 'type="number" min="0" step="1"',
    money: 'type="number" min="0" step="0.01"',
    percent: 'type="number" min="0" max="100" step="1"',
    level: 'type="number" min="0" max="9" step="1"',
  };
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
  // what's on screen always matches what's stored. Any change ends the
  // chance to undo the last delete, so Undo can never revert later work.
  function commit(change) {
    let before = structuredClone(db);
    undo = null;
    change();
    if (save()) return true;
    db = before;
    return false;
  }

  // Make a change that the message it shows can undo. `message` is a
  // function so it can describe what the change did.
  function commitWithUndo(change, message) {
    let before = structuredClone(db);
    if (!commit(change)) return false;
    undo = before;
    renderNav();
    render();
    toast(message(), 8000, "Undo");
    return true;
  }

  // The record that link field `f` points at, or undefined if it's gone.
  function linked(f, value) {
    return value ? db[f.to].find((r) => r.id === value) : undefined;
  }
  // The ids in a `links` field. Tolerates missing or malformed values.
  function asList(value) {
    return Array.isArray(value)
      ? value.filter((x) => typeof x === "string")
      : [];
  }
  // Every record a `links` field points at that still exists.
  function linkedAll(f, value) {
    return asList(value)
      .map((v) => linked(f, v))
      .filter(Boolean);
  }
  // A paint is low when its Remaining % is set and under 20.
  function isLow(p) {
    return (
      p.remaining !== "" && p.remaining != null && Number(p.remaining) < 20
    );
  }
  // The low paints a miniature's recipe uses.
  function lowRecipePaints(m) {
    return m
      ? linkedAll(column(defs.miniatures, "paints"), m.paints).filter(isLow)
      : [];
  }
  // How a record is named in a picker; paints include their brand.
  function optionLabel(r) {
    return r.brand ? `${r.name} (${r.brand})` : String(r.name ?? "");
  }

  // Delete a record and offer Undo. Links to it from other records, such as
  // miniatures in a deleted project, are cleared.
  function remove(sec, recordId) {
    let item = db[sec].find((x) => x.id === recordId),
      unlinked = 0;
    if (!item) return;
    commitWithUndo(
      () => {
        db[sec] = db[sec].filter((x) => x.id !== recordId);
        for (let [k, d] of Object.entries(defs))
          for (let f of d.fields)
            if (f.to === sec)
              for (let r of db[k])
                if (r[f.key] === recordId) {
                  r[f.key] = "";
                  unlinked++;
                } else if (asList(r[f.key]).includes(recordId)) {
                  r[f.key] = asList(r[f.key]).filter((x) => x !== recordId);
                  unlinked++;
                }
      },
      () =>
        `Deleted "${item.name}"` +
        (unlinked ? ` and unlinked ${unlinked} item(s) from it` : ""),
    );
  }

  // Add restock entries for paints to the wishlist, linked to each paint.
  function addToWishlist(paints) {
    if (!paints.length) return;
    commitWithUndo(
      () => {
        for (let p of paints)
          db.wishlist.push({
            id: id(),
            name: optionLabel(p),
            category: "Paint",
            priority: "High",
            paint: p.id,
            price: p.price || "",
            url: "",
            notes: "Restock",
          });
      },
      () =>
        paints.length === 1
          ? `Added "${optionLabel(paints[0])}" to the wishlist`
          : `Added ${paints.length} paints to the wishlist`,
    );
  }

  // A linked queue item was just marked Complete: ask whether to update its
  // miniature and whether to take it off the queue.
  function askComplete(q) {
    let m = linked(column(defs.queue, "miniature"), q.miniature);
    if (!m) return;
    let done =
        m.status === "Complete" && Number(m.painted) >= Number(m.quantity || 1),
      mini = document.querySelector("#completeMini"),
      dialog = document.querySelector("#completeDialog");
    completing = q.id;
    document.querySelector("#completeText").textContent =
      `"${q.name}" is complete. What else should change?`;
    document.querySelector("#completeMiniLabel").textContent = done
      ? `"${m.name}" is already marked complete`
      : `Mark "${m.name}" complete, with ${m.quantity || 1} of ${m.quantity || 1} painted`;
    mini.checked = !done;
    mini.disabled = done;
    document.querySelector("#completeRemove").checked = false;
    dialog.showModal();
  }
  function applyComplete() {
    let q = db.queue.find((x) => x.id === completing),
      m = q && db.miniatures.find((x) => x.id === q.miniature),
      mini = document.querySelector("#completeMini"),
      updateMini = m && mini.checked && !mini.disabled,
      drop = q && document.querySelector("#completeRemove").checked;
    if (!updateMini && !drop) return;
    commitWithUndo(
      () => {
        if (updateMini) {
          m.status = "Complete";
          m.painted = m.quantity || "1";
        }
        if (drop) db.queue = db.queue.filter((x) => x.id !== q.id);
      },
      () => {
        let parts = [];
        if (updateMini) parts.push(`marked "${m.name}" complete`);
        if (drop) parts.push(`removed "${q.name}" from the queue`);
        let text = parts.join(" and ");
        return text[0].toUpperCase() + text.slice(1);
      },
    );
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
  // Values from imported backups are untrusted. Only a hex colour may reach a
  // style attribute, and only an http(s) address may become a link.
  function safeColour(c) {
    return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(c ?? "") ? c : "";
  }
  function safeUrl(u) {
    let s = String(u ?? "").trim();
    return /^https?:\/\//i.test(s) ? s : "";
  }
  function money(n) {
    return "£" + (Number(n) || 0).toFixed(2);
  }
  function projectStats(p) {
    let minis = db.miniatures.filter((m) => m.project === p.id);
    return {
      models: minis.reduce((a, m) => a + Number(m.quantity || 1), 0),
      painted: minis.reduce((a, m) => a + Number(m.painted || 0), 0),
      spent: minis.reduce((a, m) => a + Number(m.price || 0), 0),
    };
  }
  // Show a short message, optionally with an action button (e.g. "Undo").
  function toast(s, ms = 1800, action = "") {
    let e = document.querySelector("#toast"),
      btn = document.querySelector("#toastAction");
    document.querySelector("#toastText").textContent = s;
    btn.textContent = action;
    btn.hidden = !action;
    e.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (e.style.display = "none"), ms);
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
    document.querySelector("#addBtn").style.display = d
      ? "inline-block"
      : "none";
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
    let head = cols.map((c) => `<th>${esc(c.label)}</th>`).join("");
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
  function fieldHtml(f, obj) {
    let v = obj[f.key] ?? "",
      name = `name="${f.key}"`,
      req = f.required ? "required" : "";
    if (f.type === "select")
      return `<label>${f.label}<select ${name} ${req}><option value="">Select...</option>${f.options.map((o) => `<option ${v === o ? "selected" : ""}>${o}</option>`).join("")}</select></label>`;
    if (f.type === "link")
      return `<label>${f.label}<select ${name}><option value="">None</option>${db[f.to].map((r) => `<option value="${esc(r.id)}" ${v === r.id ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></label>`;
    if (f.type === "links") {
      let chosen = asList(v),
        all = db[f.to];
      return `<label class="full">${f.label}<select ${name} multiple size="${Math.min(6, Math.max(3, all.length))}">${all.map((r) => `<option value="${esc(r.id)}" ${chosen.includes(r.id) ? "selected" : ""}>${esc(optionLabel(r))}</option>`).join("")}</select><small class="muted">${all.length ? "Ctrl-click (⌘-click on a Mac) to pick several." : `No ${defs[f.to].title.toLowerCase()} yet.`}</small></label>`;
    }
    if (f.type === "textarea")
      return `<label class="full">${f.label}<textarea ${name}>${esc(v)}</textarea></label>`;
    if (f.type === "color") {
      // A colour picker can't be empty, so "No colour" is a separate choice.
      let c = safeColour(v);
      if (c.length === 4) c = "#" + [...c.slice(1)].map((h) => h + h).join("");
      return `<div class="colourfield"><label>${f.label}<input ${name} type="color" value="${c || "#808080"}"></label><label class="check"><input type="checkbox" data-nocolour="${f.key}" ${c ? "" : "checked"}> No colour</label></div>`;
    }
    return `<label>${f.label}<input ${name} ${inputAttrs[f.type || "text"]} value="${esc(v)}" ${req}></label>`;
  }
  function openForm(sec = section, obj = {}) {
    let d = defs[sec];
    section = sec;
    editId = obj.id || null;
    document.querySelector("#modalTitle").textContent =
      (editId ? "Edit " : "Add ") + d.noun;
    document.querySelector("#formFields").innerHTML = d.fields
      .map((f) => fieldHtml(f, obj))
      .join("");
    document.querySelector("#modal").showModal();
  }
  function submit(e) {
    e.preventDefault();
    let form = e.target,
      d = defs[section],
      fd = new FormData(form),
      o = Object.fromEntries(fd);
    // Rules the browser can't check on its own, e.g. painted <= model count.
    for (let f of d.fields)
      if (f.atMost) {
        let over =
          o[f.key] !== "" &&
          o[f.atMost] !== "" &&
          Number(o[f.key]) > Number(o[f.atMost]);
        form.elements[f.key].setCustomValidity(
          over
            ? `Can't be more than the ${column(d, f.atMost).label.toLowerCase()}.`
            : "",
        );
      }
    if (!form.reportValidity()) return;
    for (let f of d.fields) {
      if (f.type === "level")
        o[f.key] = Math.max(0, Math.min(9, Math.round(Number(o[f.key]) || 0)));
      if (
        f.type === "color" &&
        form.querySelector(`[data-nocolour="${f.key}"]`).checked
      )
        o[f.key] = "";
      if (f.type === "links") o[f.key] = fd.getAll(f.key);
    }
    o.id = editId || id();
    let prev = db[section].find((x) => x.id === o.id);
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
    if (
      section === "queue" &&
      o.stage === "Complete" &&
      prev?.stage !== "Complete"
    )
      askComplete(o);
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
            return `<div class="qitem"><div class="qnum">${i + 1}</div><div><b>${esc(q.name)}</b><div class="muted">${esc(q.stage || "Not started")} · ${esc(q.models || 1)} model(s)${q.due ? " · due " + esc(q.due) : ""}</div>${low.length ? `<div class="warnline">Low paint: ${low.map((p) => `${esc(p.name)} (${Number(p.remaining)}%)`).join(", ")}</div>` : ""}</div><div class="rowacts"><button data-up="${i}">↑</button><button data-down="${i}">↓</button><button data-edit="${esc(q.id)}">Edit</button><button class="del" data-del="${esc(q.id)}">Delete</button></div></div>`;
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
      cell = (v) => {
        let s = String(v ?? "");
        // Stop spreadsheets running a cell as a formula; plain numbers are kept.
        if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = "'" + s;
        return '"' + s.replaceAll('"', '""') + '"';
      },
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
    if (b.dataset.del) remove(section, b.dataset.del);
    if (b.dataset.wish)
      addToWishlist(db.paints.filter((p) => p.id === b.dataset.wish));
    if (b.dataset.wishall !== undefined) {
      let wanted = new Set(db.wishlist.map((w) => w.paint));
      addToWishlist(db.paints.filter((p) => isLow(p) && !wanted.has(p.id)));
    }
    if (b.dataset.queue) {
      let m = db.miniatures.find((x) => x.id === b.dataset.queue);
      let queued = commit(() =>
        db.queue.push({
          id: id(),
          name: m.name,
          miniature: m.id,
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
  document.querySelector("#itemForm").oninput = (e) => {
    let form = e.currentTarget;
    for (let el of form.elements) el.setCustomValidity?.(""); // re-check on save
    if (e.target.type === "color")
      form.querySelector(`[data-nocolour="${e.target.name}"]`).checked = false;
  };
  // Runs as the button is clicked; the dialog closes itself afterwards.
  document.querySelector("#completeForm").onsubmit = (e) => {
    if (e.submitter?.value === "apply") applyComplete();
  };
  document.querySelector("#toastAction").onclick = () => {
    let snapshot = undo;
    if (!snapshot || !commit(() => (db = snapshot))) return;
    renderNav();
    render();
    toast("Restored");
  };
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
    undo = null; // undoing now would revert the other tab's change
    renderNav();
    render();
    renderAlerts();
    toast("Updated with changes from another tab");
  });
  go("dashboard");
  renderBackupState();
  renderAlerts();
})();
