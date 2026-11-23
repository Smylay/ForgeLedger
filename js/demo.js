// Example data: "Load example data" on an empty dashboard, and
// examples/forgeledger-example.json (made by scripts/make-example.js).
// Names are made up. Dates count from `base`, so markers like "Due in 5
// days" show whenever it's loaded; the file uses DEMO_FILE_DATE.

const DEMO_FILE_DATE = "2027-01-15";

function demoData(base = new Date()) {
  let day = (n) => {
    let d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + n),
      p = (x) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  let paint = (id, name, type, colour, stock, price, quantity = "1") => ({
    id,
    name,
    brand: "Demo Paint Co.",
    range: type,
    colour,
    type,
    quantity,
    stock,
    price,
    notes: "",
  });
  let skill = (name, level, changed, goal = "") => ({
    id: "s-" + name.toLowerCase().replace(/[^a-z]+/g, "-"),
    name,
    level,
    notes: "",
    goal,
    ...(changed === null ? {} : { changed: day(changed) }),
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    demo: true,
    paints: [
      paint("p-primer", "Grey Primer", "Primer", "#8a8f96", "Good", "15.00"),
      paint("p-red", "Blood Red", "Base", "#8a1c1c", "Full", "4.50", "2"),
      paint("p-bright", "Bright Red", "Layer", "#c8312e", "Low", "4.50"),
      paint("p-blue", "Deep Blue", "Base", "#1d3557", "Good", "4.50"),
      paint("p-sky", "Sky Blue", "Layer", "#5d9fd8", "Half", "4.50"),
      paint("p-bone", "Bone White", "Layer", "#e8dcc0", "Empty", "4.50"),
      paint("p-wash", "Dark Wash", "Shade/Wash", "#2b2118", "Half", "6.00"),
      paint("p-steel", "Silver Steel", "Metallic", "#b8bcc2", "Good", "5.00"),
      paint("p-gold", "Old Gold", "Metallic", "#b08d3c", "Full", "5.00"),
      paint("p-rust", "Rust Effect", "Technical", "#8b4513", "Good", "6.50"),
      paint(
        "p-ochre",
        "Ochre Speedpaint",
        "Contrast/Speedpaint",
        "#c9922e",
        "Good",
        "6.00",
      ),
    ],
    tools: [
      {
        id: "t-detail",
        name: "Detail brush (size 0)",
        category: "Brush",
        condition: "Good",
        quantity: "2",
        price: "8.00",
        notes: "",
      },
      {
        id: "t-dry",
        name: "Drybrush",
        category: "Brush",
        condition: "Worn",
        quantity: "1",
        price: "5.00",
        notes: "",
      },
      {
        id: "t-knife",
        name: "Hobby knife",
        category: "Cutting",
        condition: "Replace soon",
        quantity: "1",
        price: "6.00",
        notes: "Blade is blunt.",
      },
      {
        id: "t-cutters",
        name: "Sprue cutters",
        category: "Cutting",
        condition: "New",
        quantity: "1",
        price: "12.00",
        notes: "",
      },
      {
        id: "t-palette",
        name: "Wet palette",
        category: "Other",
        condition: "Good",
        quantity: "1",
        price: "15.00",
        notes: "",
      },
    ],
    projects: [
      {
        id: "a-iron",
        name: "Iron Guard strike force",
        faction: "Iron Guard",
        system: "Skirmish",
        target: "20",
        budget: "250.00",
        deadline: day(45),
        notes: "Painted for the spring campaign.",
      },
      {
        id: "a-gob",
        name: "Goblin raiders",
        faction: "Goblins",
        system: "Skirmish",
        target: "24",
        budget: "120.00",
        deadline: day(10),
        notes: "",
      },
    ],
    miniatures: [
      {
        id: "m-squad",
        name: "Iron Guard squad",
        faction: "Iron Guard",
        project: "a-iron",
        quantity: "10",
        painted: "2",
        status: "In progress",
        price: "35.00",
        paints: ["p-primer", "p-red", "p-bright", "p-wash", "p-steel"],
        recipe:
          "Grey primer. Blood Red armour, Dark Wash, Bright Red edges. Silver Steel weapons.",
        notes: "",
        photos: ["demo-photo-1"],
      },
      {
        id: "m-captain",
        name: "Captain Vexa",
        faction: "Iron Guard",
        project: "a-iron",
        quantity: "1",
        painted: "1",
        status: "Complete",
        price: "25.00",
        paints: ["p-blue", "p-sky", "p-gold"],
        recipe: "",
        notes: "Display piece.",
        photos: ["demo-photo-2"],
      },
      {
        id: "m-walker",
        name: "Siege walker",
        faction: "Iron Guard",
        project: "a-iron",
        quantity: "1",
        painted: "0",
        status: "Built",
        price: "60.00",
        paints: ["p-primer", "p-rust", "p-steel"],
        recipe: "",
        notes: "",
      },
      {
        id: "m-gob",
        name: "Goblin raiders",
        faction: "Goblins",
        project: "a-gob",
        quantity: "12",
        painted: "0",
        status: "Primed",
        price: "30.00",
        paints: ["p-ochre", "p-bone", "p-wash"],
        recipe: "",
        notes: "",
      },
      {
        id: "m-boss",
        name: "Goblin boss",
        faction: "Goblins",
        project: "a-gob",
        quantity: "1",
        painted: "0",
        status: "Unbuilt",
        price: "12.00",
        paints: [],
        recipe: "",
        notes: "",
      },
    ],
    queue: [
      {
        id: "q-squad",
        name: "Iron Guard squad",
        miniature: "m-squad",
        project: "a-iron",
        stage: "Basecoating",
        stageDone: 4,
        models: "10",
        due: day(5),
        notes: "",
      },
      {
        id: "q-gob",
        name: "Goblin raiders",
        miniature: "m-gob",
        project: "a-gob",
        stage: "Priming",
        stageDone: 8,
        split: { Priming: 4, Basecoating: 5, Detailing: 3 },
        models: "12",
        due: day(12),
        notes: "",
      },
      {
        id: "q-walker",
        name: "Siege walker",
        miniature: "m-walker",
        project: "a-iron",
        stage: "Weathering",
        stages: ["Building", "Priming", "Basecoating", "Weathering", "Basing"],
        models: "1",
        due: day(-2),
        notes: "Its own stages, with weathering.",
      },
      {
        id: "q-chapel",
        name: "Ruined chapel (terrain)",
        miniature: "",
        project: "",
        stage: "Not started",
        models: "1",
        due: "",
        notes: "",
      },
    ],
    skills: [
      skill("Drybrushing", 6, -10),
      skill("Washing & shading", 5, -50),
      skill("Layering", 4, -5),
      skill("Edge highlighting", 3, -35),
      skill("Glazing", 2, -20),
      skill("Wet blending", 1, null),
      skill("Airbrushing", 0, null),
      skill("Weathering", 3, -3),
      skill("Object-source lighting", 0, null),
      skill("Non-metallic metal", 1, -60),
      skill("Sculpting", 2, -12, "Sculpt a cloak for Captain Vexa"),
    ],
    wishlist: [
      {
        id: "w-bone",
        name: "Bone White",
        category: "Paint",
        priority: "High",
        paint: "p-bone",
        rewardFor: "",
        rewardAt: "",
        price: "4.50",
        url: "",
        notes: "",
      },
      {
        id: "w-tank",
        name: "Heavy tank kit",
        category: "Miniature",
        priority: "Medium",
        paint: "",
        rewardFor: "a-iron",
        rewardAt: "30",
        price: "55.00",
        url: "https://example.com/heavy-tank",
        notes: "My reward for a third of the strike force.",
      },
      {
        id: "w-airbrush",
        name: "Airbrush",
        category: "Tool",
        priority: "Low",
        paint: "",
        rewardFor: "a-iron",
        rewardAt: "75",
        price: "120.00",
        url: "",
        notes: "",
      },
      {
        id: "w-wolves",
        name: "Goblin wolf riders",
        category: "Miniature",
        priority: "Medium",
        paint: "",
        rewardFor: "a-gob",
        rewardAt: "50",
        price: "32.00",
        url: "",
        notes: "",
      },
      {
        id: "w-chapel",
        name: "Ruined chapel",
        category: "Terrain",
        priority: "Low",
        paint: "",
        rewardFor: "",
        rewardAt: "",
        price: "28.00",
        url: "",
        notes: "",
      },
    ],
  };
}

// The two example photos, drawn here so no image files are needed: a
// simple painted figure on a stand, in the squad's and the captain's
// colours. Same records as photoFromFile() makes.
function demoPhotos() {
  let draw = (w, h, body, trim) => {
    let c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    let g = c.getContext("2d"),
      s = w / 1200,
      bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#2a3340");
    bg.addColorStop(1, "#101419");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.scale(s, s);
    g.fillStyle = "#3b3226"; // base
    g.beginPath();
    g.ellipse(600, 760, 230, 60, 0, 0, 7);
    g.fill();
    g.fillStyle = body; // legs and body
    g.fillRect(520, 520, 70, 230);
    g.fillRect(610, 520, 70, 230);
    g.fillRect(480, 300, 240, 250);
    g.fillStyle = trim; // shoulders, belt and helmet
    g.fillRect(440, 290, 90, 80);
    g.fillRect(670, 290, 90, 80);
    g.fillRect(480, 500, 240, 30);
    g.beginPath();
    g.arc(600, 240, 75, 0, 7);
    g.fill();
    g.fillStyle = "#b8bcc2"; // spear
    g.fillRect(780, 110, 18, 640);
    g.beginPath();
    g.moveTo(760, 120);
    g.lineTo(789, 30);
    g.lineTo(818, 120);
    g.fill();
    g.fillStyle = "#9ba8b7";
    g.font = "32px system-ui, sans-serif";
    g.fillText("Example photo", 40, 860);
    // toDataURL, not toBlob: toBlob's callback can stall in some headless
    // browsers, and these images are small.
    return fromBase64(c.toDataURL("image/jpeg", 0.8).split(",")[1]);
  };
  let photo = (pid, body, trim) => ({
    id: pid,
    type: "image/jpeg",
    full: draw(1200, 900, body, trim),
    thumb: draw(320, 240, body, trim),
    width: 1200,
    height: 900,
    added: Date.now(),
  });
  return [
    photo("demo-photo-1", "#8a1c1c", "#c8312e"),
    photo("demo-photo-2", "#1d3557", "#b08d3c"),
  ];
}
