// The skill guide: what each level means, and a library of painting
// techniques with the next thing to practise at each level. Static data;
// nothing here is stored.

// Level 0 to 9: a name, and what it looks like in practice.
const LEVELS = [
  ["Not tried", "You haven't tried it yet."],
  ["Tried once", "You've had a go."],
  ["Learning", "You're practising, and results vary."],
  ["Basic", "It works on simple areas."],
  ["Competent", "Reliable results, ready for the tabletop."],
  ["Confident", "Clean results on most areas without much thought."],
  ["Skilled", "Neat, smooth results, even on difficult areas."],
  ["Advanced", "Display quality on parts of a model."],
  ["Expert", "Display quality across whole models."],
  ["Mastery", "Competition level. You could teach it."],
];

// Skills store `level` as a number, but imported data can hold anything.
function skillLevel(s) {
  return Math.max(0, Math.min(9, Math.round(Number(s?.level)) || 0));
}
function levelName(level) {
  return LEVELS[level][0];
}

// Each technique's `next` has one step per level band: 0-2, 3-4, 5-6, 7-9.
// The first ten names match the skills a new install starts with.
const TECHNIQUES = [
  {
    name: "Drybrushing",
    about: "Catching raised texture with an almost dry brush.",
    next: [
      "Wipe nearly all the paint off an old, soft brush, then brush lightly across fur, chainmail or rocks.",
      "Build up in two or three steps, each lighter colour on a smaller area.",
      "Drybrush only the texture, and keep it off smooth areas, where it looks chalky.",
      "Use drybrushing as a fast underpainting for an army, then refine the key areas with layers.",
    ],
  },
  {
    name: "Washing & shading",
    about: "Thin, dark paint that runs into recesses to add shadow.",
    next: [
      "Wash a basecoated model all over and watch where it gathers. That's where the shadows go.",
      "Stop pooling: take excess off the brush and draw it out of flat areas before it dries.",
      "Put the wash only into the recesses, so flat panels stay clean.",
      "Mix your own shades from ink and medium to suit each colour, such as purple in the shadows of red.",
    ],
  },
  {
    name: "Layering",
    about: "Lighter colours in smaller and smaller areas, to build highlights.",
    next: [
      "Add one highlight colour to the raised areas of a basecoated model.",
      "Use three steps from shadow to highlight, each covering less than the last.",
      "Thin each layer further and add in-between steps, so the transitions look smooth.",
      "Place every highlight for one light source across the whole model.",
    ],
  },
  {
    name: "Edge highlighting",
    about: "A fine line of light colour along sharp edges.",
    next: [
      "Run the side of the brush, not the tip, along the edges of flat armour panels.",
      "Keep the line thin, and break it where an edge would catch less light.",
      "Add a second, brighter highlight on the sharpest corners and points.",
      "Vary the brightness by where the light falls, so upward edges are brightest.",
    ],
  },
  {
    name: "Glazing",
    about: "Very thin, see-through coats that tint and smooth what's below.",
    next: [
      "Thin paint with medium until it's barely tinted, and glaze a shadow to deepen it.",
      "Smooth a rough two-colour blend with several glazes of the colour in between.",
      "Shift colours with glazes, such as a warm glaze on skin or a blue glaze in shadows.",
      "Use glazes to pull a whole model's colours together.",
    ],
  },
  {
    name: "Wet blending",
    about: "Mixing two colours on the model while both are still wet.",
    next: [
      "Try it on a large, flat area like a cloak, with a drop of medium to slow the drying.",
      "Work in small sections, so the paint doesn't dry before the blend is done.",
      "Blend three colours across a curved surface with no visible steps.",
      "Combine wet blending with glazing to finish smooth gradients quickly.",
    ],
  },
  {
    name: "Airbrushing",
    about: "Spraying paint through a fine nozzle for smooth coats and fades.",
    next: [
      "Thin paint to the consistency of milk, and practise even coats on spare plastic.",
      "Spray a zenithal highlight: dark from below, light from above.",
      "Use low pressure and a short distance for controlled fades on vehicles and cloaks.",
      "Use masks and freehand spraying for camouflage, glows or weathering.",
    ],
  },
  {
    name: "Weathering",
    about: "Mud, rust, chips and dust that make models look used.",
    next: [
      "Dab a little dark brown onto the lower edges of armour with a piece of sponge, for chips.",
      "Keep wear where it would really happen: lower legs, tracks, and edges that get handled.",
      "Layer effects: rust under chips, streaks below rivets, then dust over everything.",
      "Weather to match the bases and setting of the whole army.",
    ],
  },
  {
    name: "Object-source lighting",
    about: "The glow a light source casts on the surfaces around it.",
    next: [
      "Paint the light source itself bright, then glaze its colour onto the nearest surfaces.",
      "Keep the area around the light darker than usual, so the glow stands out.",
      "Make the light fade with distance, and touch only surfaces that face the source.",
      "Combine it with the main light, deciding which one lights each surface.",
    ],
  },
  {
    name: "Non-metallic metal",
    about:
      "Painting metal with flat colours, using contrast to fake reflections.",
    next: [
      "Paint a flat blade from dark to light, with a white dot at the brightest point.",
      "Push the contrast: put the darkest dark right next to the brightest highlight.",
      "Reflect the surroundings: sky colours on upper surfaces, ground colours below.",
      "Paint curved shapes like helmets and shoulder pads with consistent reflections.",
    ],
  },
  {
    name: "Assembly & conversions",
    about: "Clean builds, from mould lines to combining parts from other kits.",
    next: [
      "Scrape mould lines with the back of a hobby knife, and fill gaps before priming.",
      "Try a simple swap, such as a head or weapon from another kit.",
      "Repose a model by cutting and pinning a limb, and fill the joins with putty.",
      "Plan sub-assemblies, so hard-to-reach areas can be painted before gluing.",
    ],
  },
  {
    name: "Priming",
    about: "A thin, even undercoat that paint grips and that sets the tone.",
    next: [
      "Spray in short passes from about 20 to 30 cm away, in dry, mild weather.",
      "Cover the model in several light passes from different angles, not one heavy coat.",
      "Choose the primer colour for the scheme: black for dark or metallic models, white or grey for bright ones.",
      "Use a coloured or zenithal prime as the first stage of the shading.",
    ],
  },
  {
    name: "Zenithal highlighting",
    about: "A dark undercoat sprayed lighter from above, to map the light.",
    next: [
      "Spray black all over, then grey or white from above at about 45 degrees.",
      "Use the zenithal to see where highlights go, then paint thin colours over it.",
      "Add a third, brighter spray straight down to mark the brightest points.",
      "Plan the light direction first, and match every later stage to it.",
    ],
  },
  {
    name: "Basecoating",
    about: "Solid, smooth coats of each area's main colour.",
    next: [
      "Thin paint with a little water until it flows, and apply two thin coats rather than one thick one.",
      "Keep each colour inside its area, and tidy mistakes with the neighbouring colour.",
      "Paint from the inside out: deep areas and skin first, cloaks and outer armour last.",
      "Basecoat a whole squad as a production line, and find the slowest step.",
    ],
  },
  {
    name: "Contrast & speed paints",
    about:
      "One-coat paints that colour and shade at once over a light undercoat.",
    next: [
      "Apply one generous coat over a white or light grey primer, and draw pools out of flat areas.",
      "Paint each area once and leave it. Going back over drying paint leaves marks.",
      "Thin them with medium for lighter tints, and add a highlight on top.",
      "Use them as glazes and washes over ordinary paint, not only as a base.",
    ],
  },
  {
    name: "Metallics",
    about: "Metallic paints, shaded and highlighted so the shine reads.",
    next: [
      "Basecoat over a dark undercoat, then shade with a dark wash.",
      "Highlight edges with a brighter metallic, and keep it out of the recesses.",
      "Glaze coloured inks over metal for gold, brass or heat-stained effects.",
      "Combine metallic paint with non-metallic shading for extra contrast.",
    ],
  },
  {
    name: "Faces & eyes",
    about: "Skin, features and eyes that give a model character.",
    next: [
      "Wash the skin, then highlight the nose, cheekbones and brow.",
      "Paint each eye as a dark line in the socket first. It often looks better than a white eye.",
      "Add the iris as a dot touching the upper lid, and check both eyes look the same way.",
      "Vary the skin tones: warmer cheeks and nose, cooler shadows and stubble.",
    ],
  },
  {
    name: "Freehand",
    about: "Painting designs, symbols and patterns by hand.",
    next: [
      "Paint simple stripes or a checkerboard on a flat banner or shoulder pad.",
      "Sketch the design in a thin, pale colour first, then fill it in.",
      "Shade and highlight the design so it follows the folds and curves under it.",
      "Paint small lettering, heraldry or scenes, lit to match the model.",
    ],
  },
  {
    name: "Basing",
    about: "Texture, colour and details that set a model in a scene.",
    next: [
      "Glue sand to the base, paint it brown, drybrush it lighter and paint the rim.",
      "Add a few details: tufts of grass, small stones or leaves.",
      "Plan one base theme for the whole army, so units belong together.",
      "Build scenic bases with height and features that frame the model.",
    ],
  },
  {
    name: "Varnishing",
    about: "A clear coat that protects the paint from handling.",
    next: [
      "Spray a matt varnish over a finished model, in dry, mild weather.",
      "Use thin coats and keep the can moving, so the finish doesn't frost.",
      "Use gloss on gems and wet effects, and matt everywhere else.",
      "Varnish before adding weathering powders, then fix them, so the effects stay sharp.",
    ],
  },
];

// The library entry for a skill, matched by name ignoring case and spaces.
function technique(name) {
  let n = String(name ?? "")
    .trim()
    .toLowerCase();
  return TECHNIQUES.find((t) => t.name.toLowerCase() === n);
}
// The next step for a skill at its level, or "" for a skill of your own.
function nextStep(s) {
  let t = technique(s?.name),
    level = skillLevel(s);
  return t ? t.next[level <= 2 ? 0 : level <= 4 ? 1 : level <= 6 ? 2 : 3] : "";
}

function sameName(a, b) {
  return (
    String(a ?? "")
      .trim()
      .toLowerCase() ===
    String(b ?? "")
      .trim()
      .toLowerCase()
  );
}
function levelText(level) {
  return `${level} of 9, ${levelName(level)}`;
}

// Skills record the date their level last changed in `changed`
// (YYYY-MM-DD). Older skills have none, and imported values may be junk:
// both count as unknown.
function daysSinceChanged(s) {
  let days = -daysUntil(s?.changed);
  return days >= 0 ? days : NaN;
}
function changedText(s) {
  let d = daysSinceChanged(s);
  if (Number.isNaN(d)) return "";
  if (d === 0) return "Changed today";
  if (d === 1) return "Changed yesterday";
  if (d < 14) return `Changed ${d} days ago`;
  if (d < 60) return `Changed ${Math.floor(d / 7)} weeks ago`;
  return `Changed ${Math.floor(d / 30)} months ago`;
}

const STALE_DAYS = 30;
// Up to three skills to practise, each with the reason it was picked.
// Skills not changed for STALE_DAYS come first, oldest first; then the
// lowest levels, in list order. Skills at Mastery are left out.
function practiceNext(skills) {
  return skills
    .filter((s) => skillLevel(s) < 9)
    .map((s) => ({ s, days: daysSinceChanged(s) }))
    .map((x) => ({ ...x, stale: x.days >= STALE_DAYS }))
    .sort(
      (a, b) =>
        b.stale - a.stale ||
        (a.stale ? b.days - a.days : skillLevel(a.s) - skillLevel(b.s)),
    )
    .slice(0, 3)
    .map(({ s, days, stale }) => ({
      skill: s,
      reason: stale
        ? `Not changed in ${Math.floor(days / 7)} weeks`
        : skillLevel(s) === 0
          ? "Not tried yet"
          : "One of your lowest",
    }));
}
