(() => {
        "use strict";
        const KEY = "forgeledger_v2_data";
        const defaults = {
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
                ["Base", "Layer", "Shade", "Contrast/Speedpaint", "Metallic", "Technical", "Ink", "Medium", "Other"],
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
                ["Brush", "Airbrush", "Cutting", "Assembly", "Basing", "Lighting", "Storage", "Other"],
              ],
              ["condition", "Condition", "select", ["New", "Good", "Worn", "Replace soon"]],
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
              ["status", "Status", "select", ["Unbuilt", "Built", "Primed", "In progress", "Complete"]],
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
              ["category", "Category", "select", ["Paint", "Tool", "Miniature", "Terrain", "Book", "Other"]],
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
        function load() {
          try {
            let x = JSON.parse(localStorage.getItem(KEY));
            return x ? Object.assign(structuredClone(defaults), x) : structuredClone(defaults);
          } catch {
            return structuredClone(defaults);
          }
        }
        function save() {
          localStorage.setItem(KEY, JSON.stringify(db));
          document.querySelector("#saveState").textContent =
            "Saved " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
        }
        function esc(s) {
          return String(s ?? "").replace(
            /[&<>"']/g,
            (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
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
        function toast(s) {
          let e = document.querySelector("#toast");
          e.textContent = s;
          e.style.display = "block";
          setTimeout(() => (e.style.display = "none"), 1800);
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
          document.querySelectorAll(".view").forEach((x) => x.classList.remove("active"));
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
          document.querySelector("#addBtn").style.display = k === "dashboard" ? "none" : "inline-block";
          render();
        }
        function render() {
          if (section === "dashboard") renderDashboard();
          else if (section === "queue") renderQueue();
          else if (section === "skills") renderSkills();
          else renderList();
        }
        function renderDashboard() {
          let modelCount = db.miniatures.reduce((a, x) => a + Number(x.quantity || 1), 0),
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
            .map((x) => `<div class="card metric"><div class="muted">${x[0]}</div><div class="v">${x[1]}</div></div>`)
            .join("");
          document.querySelector("#projectSummary").innerHTML = db.projects.length
            ? db.projects
                .map((p) => {
                  let st = projectStats(p),
                    goal = Number(p.target) || st.models,
                    pc = goal ? Math.min(100, Math.round((100 * st.painted) / goal)) : 0;
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
          let low = db.paints.filter((p) => p.remaining !== "" && p.remaining != null && Number(p.remaining) < 20);
          document.querySelector("#stockSummary").innerHTML = low.length
            ? low
                .map(
                  (p) =>
                    `<div><span class="colour" style="background:${p.colour || "#777"}"></span>${esc(p.brand)} ${esc(p.name)} · <b>${Number(p.remaining || 0)}%</b></div>`,
                )
                .join("")
            : '<div class="empty">No paints below 20%.</div>';
          let wish = db.wishlist.reduce((a, x) => a + Number(x.price || 0), 0);
          document.querySelector("#spendSummary").innerHTML =
            `<div class="metric"><div class="v">${money(spend)}</div><div class="muted">Owned collection spend</div><br><div class="v">${money(wish)}</div><div class="muted">Wishlist exposure</div></div>`;
        }
        function visible() {
          let q = document.querySelector("#search").value.toLowerCase(),
            f = document.querySelector("#filter").value;
          return db[section].filter(
            (x) => (!q || JSON.stringify(x).toLowerCase().includes(q)) && (!f || Object.values(x).includes(f)),
          );
        }
        function renderList() {
          let d = defs[section],
            filter = document.querySelector("#filter");
          let options = [];
          if (section === "paints") options = d.fields.find((x) => x[0] === "type")[3];
          if (section === "wishlist") options = ["Low", "Medium", "High"];
          if (section === "miniatures") options = ["Unbuilt", "Built", "Primed", "In progress", "Complete"];
          filter.innerHTML = '<option value="">All</option>' + options.map((x) => `<option>${x}</option>`).join("");
          renderTable();
        }
        function renderTable() {
          let rows = visible(),
            columns = {
              paints: ["name", "brand", "range", "type", "quantity", "remaining"],
              tools: ["name", "category", "condition", "quantity", "price"],
              miniatures: ["name", "faction", "project", "quantity", "painted", "status"],
              projects: ["name", "faction", "system", "painted", "models", "target", "spent", "deadline"],
              wishlist: ["name", "category", "priority", "price", "url"],
            }[section],
            stats = section === "projects" ? Object.fromEntries(rows.map((x) => [x.id, projectStats(x)])) : {};
          let head = columns.map((c) => `<th>${c}</th>`).join("");
          let body = rows
            .map(
              (x) =>
                `<tr>${columns
                  .map((c) => {
                    let v = stats[x.id]?.[c] ?? x[c] ?? "";
                    if (c === "colour") v = `<span class="colour" style="background:${v}"></span>${esc(v)}`;
                    else if (c === "price" || c === "budget" || c === "spent") v = money(v);
                    else if (c === "remaining") v = esc(v) + "%";
                    else if (c === "project") v = esc(db.projects.find((p) => p.id === v)?.name || v);
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
          if (t === "textarea") return `<label class="full">${l}<textarea name="${k}">${esc(v)}</textarea></label>`;
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
                    ["Not started", "Building", "Priming", "Basecoating", "Detailing", "Basing", "Complete"],
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
            (sec === "queue" ? "queue item" : sec === "skills" ? "skill" : defs[sec].title.toLowerCase());
          document.querySelector("#formFields").innerHTML = fields.map((f) => fieldHtml(f, obj)).join("");
          document.querySelector("#modal").showModal();
        }
        function submit(e) {
          e.preventDefault();
          let o = Object.fromEntries(new FormData(e.target));
          if (section === "skills") o.level = Math.max(0, Math.min(9, Number(o.level || 0)));
          o.id = editId || id();
          let arr = db[section],
            i = arr.findIndex((x) => x.id === o.id);
          if (i >= 0) arr[i] = o;
          else arr.push(o);
          save();
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
        function exportJSON() {
          let a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([JSON.stringify(db, null, 2)], { type: "application/json" }));
          a.download = "forgeledger-backup-" + new Date().toISOString().slice(0, 10) + ".json";
          a.click();
          URL.revokeObjectURL(a.href);
        }
        function csv() {
          let arr = db[section];
          if (!arr.length) return toast("Nothing to export");
          let keys = [...new Set(arr.flatMap(Object.keys))],
            cell = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"',
            text = [keys.map(cell).join(","), ...arr.map((o) => keys.map((k) => cell(o[k])).join(","))].join("\n");
          let a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
          a.download = section + ".csv";
          a.click();
        }
        function importJSON(file) {
          let r = new FileReader();
          r.onload = () => {
            try {
              let x = JSON.parse(r.result);
              if (!x || typeof x !== "object") throw Error();
              db = Object.assign(structuredClone(defaults), x);
              save();
              go("dashboard");
              toast("Backup imported");
            } catch {
              toast("Invalid backup file");
            }
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
          if (b.dataset.del && confirm("Delete this item?")) {
            db[section] = db[section].filter((x) => x.id !== b.dataset.del);
            save();
            renderNav();
            renderTable();
          }
          if (b.dataset.queue) {
            let m = db.miniatures.find((x) => x.id === b.dataset.queue);
            db.queue.push({
              id: id(),
              name: m.name,
              project: m.project || "",
              stage: "Not started",
              models: m.quantity || 1,
              due: "",
              notes: "",
            });
            save();
            renderNav();
            toast("Added to queue");
          }
          if (b.dataset.editq)
            openForm(
              "queue",
              db.queue.find((x) => x.id === b.dataset.editq),
            );
          if (b.dataset.delq) {
            db.queue = db.queue.filter((x) => x.id !== b.dataset.delq);
            save();
            renderNav();
            renderQueue();
          }
          if (b.dataset.edits)
            openForm(
              "skills",
              db.skills.find((x) => x.id === b.dataset.edits),
            );
          if (b.dataset.dels) {
            db.skills = db.skills.filter((x) => x.id !== b.dataset.dels);
            save();
            renderNav();
            renderSkills();
          }
          if (b.dataset.up !== undefined) {
            let i = +b.dataset.up;
            if (i > 0) [db.queue[i - 1], db.queue[i]] = [db.queue[i], db.queue[i - 1]];
            save();
            renderQueue();
          }
          if (b.dataset.down !== undefined) {
            let i = +b.dataset.down;
            if (i < db.queue.length - 1) [db.queue[i + 1], db.queue[i]] = [db.queue[i], db.queue[i + 1]];
            save();
            renderQueue();
          }
        });
        document.querySelector("#addBtn").onclick = () => openForm(section);
        document.querySelector("#itemForm").onsubmit = submit;
        document.querySelector("#closeModal").onclick = document.querySelector("#cancelModal").onclick = () =>
          document.querySelector("#modal").close();
        document.querySelector("#backupBtn").onclick = exportJSON;
        document.querySelector("#importBtn").onclick = () => document.querySelector("#importFile").click();
        document.querySelector("#importFile").onchange = (e) => e.target.files[0] && importJSON(e.target.files[0]);
        document.querySelector("#csvBtn").onclick = csv;
        document.querySelector("#search").oninput = renderTable;
        document.querySelector("#filter").onchange = renderTable;
        document.querySelector("#skillsContent").oninput = (e) => {
          if (e.target.dataset.skill) {
            let s = db.skills.find((x) => x.id === e.target.dataset.skill);
            s.level = +e.target.value;
            e.target.closest(".skill").querySelector(".skilltop strong").textContent = s.level + "/9";
            save();
          }
        };
        go("dashboard");
      })();