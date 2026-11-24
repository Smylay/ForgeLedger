// The skills page: skill cards with sliders, the skill profile,
// practice suggestions and the technique picker. The levels and the
// technique library are in skillguide.js.
"use strict";

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
// Quick add: a new record in the current section with just a name, with
// Undo. Search and filter are cleared so the new record is visible, and
// the box is emptied (keeping focus) for the next one.
// The skill picker: a technique from the library, or "Other" with a name.
function addSkill(form) {
  let { pick, name: input } = form.elements,
    name = (pick.value === "other" ? input.value : pick.value).trim();
  if (!name) return;
  if (db.skills.some((s) => sameName(s.name, name)))
    return toast(`"${name}" is already in your skills`);
  let added = commitWithUndo(
    () =>
      db.skills.push({
        id: id(),
        name,
        level: 0,
        notes: "",
        goal: "",
        changed: today(),
      }),
    () => `Added "${name}"`,
  );
  if (!added) return;
  input.value = "";
  input.hidden = true;
  input.required = false;
  pick.value = "";
  pick.focus();
}
