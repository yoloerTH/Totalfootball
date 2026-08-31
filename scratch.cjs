const fs = require('fs');
const file = 'content/systems/the-box-midfield-rest-defence.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const tokens1 = [
  { id: "u-gk", x: 5, y: 50, label: "GK", side: "us" },
  { id: "u-lb", x: 25, y: 15, label: "LB", side: "us" },
  { id: "u-lcb", x: 20, y: 35, label: "CB", side: "us" },
  { id: "u-rcb", x: 20, y: 65, label: "CB", side: "us" },
  { id: "u-rb", x: 25, y: 85, label: "RB", side: "us" },
  { id: "u-cdm", x: 35, y: 50, label: "DM", side: "us" },
  { id: "u-lcm", x: 50, y: 35, label: "CM", side: "us" },
  { id: "u-rcm", x: 50, y: 65, label: "CM", side: "us" },
  { id: "u-lw", x: 75, y: 10, label: "LW", side: "us" },
  { id: "u-st", x: 70, y: 50, label: "9", side: "us" },
  { id: "u-rw", x: 75, y: 90, label: "RW", side: "us" },
  
  { id: "o-gk", x: 95, y: 50, label: "GK", side: "them" },
  { id: "o-lb", x: 83, y: 20, label: "LB", side: "them" },
  { id: "o-lcb", x: 85, y: 40, label: "CB", side: "them" },
  { id: "o-rcb", x: 85, y: 60, label: "CB", side: "them" },
  { id: "o-rb", x: 83, y: 80, label: "RB", side: "them" },
  { id: "o-lm", x: 72, y: 20, label: "LM", side: "them" },
  { id: "o-lcm", x: 70, y: 40, label: "CM", side: "them" },
  { id: "o-rcm", x: 70, y: 60, label: "CM", side: "them" },
  { id: "o-rm", x: 72, y: 80, label: "RM", side: "them" },
  { id: "o-lst", x: 55, y: 45, label: "ST", side: "them" },
  { id: "o-rst", x: 55, y: 55, label: "ST", side: "them" }
];

const tokens2 = tokens1.map(t => {
  let nt = { ...t };
  if (t.id === 'u-rb') { nt.x = 45; nt.y = 62; }
  else if (t.id === 'u-cdm') { nt.x = 45; nt.y = 38; }
  else if (t.id === 'u-lcm') { nt.x = 65; nt.y = 38; }
  else if (t.id === 'u-rcm') { nt.x = 65; nt.y = 62; }
  else if (t.id === 'u-lb') { nt.x = 35; nt.y = 20; }
  else if (t.id === 'u-lcb') { nt.x = 30; nt.y = 45; }
  else if (t.id === 'u-rcb') { nt.x = 30; nt.y = 70; }
  else if (t.id === 'u-gk') { nt.x = 15; nt.y = 50; }
  else if (t.id === 'u-lw') { nt.x = 80; nt.y = 15; }
  else if (t.id === 'u-rw') { nt.x = 80; nt.y = 85; }
  else if (t.id === 'u-st') { nt.x = 75; nt.y = 50; }
  return nt;
});

const tokens3 = tokens2.map(t => ({...t}));

const tokens4 = tokens3.map(t => {
  let nt = { ...t };
  if (t.id === 'o-lcb') { nt.x = 80; nt.y = 45; }
  else if (t.id === 'u-st') { nt.x = 77; nt.y = 50; }
  return nt;
});

const tokens5 = tokens4.map(t => {
  let nt = { ...t };
  if (t.id === 'u-lcm') { nt.x = 75; nt.y = 42; nt.cue = 'PRESS'; }
  else if (t.id === 'u-cdm') { nt.x = 65; nt.y = 40; nt.cue = 'COVER'; }
  else if (t.id === 'u-rcm') { nt.x = 70; nt.y = 50; nt.cue = 'COVER'; }
  else if (t.id === 'u-rb') { nt.x = 60; nt.y = 55; nt.cue = 'BALANCE'; }
  return nt;
});

data.acts = [
  {
    id: "act-1",
    title: "The Setup",
    caption: "We start in a standard 4-3-3 shape against a deep 4-4-2 block.",
    ball: { x: 20, y: 65 },
    tokens: tokens1,
    arrows: [],
    bands: []
  },
  {
    id: "act-2",
    title: "Forming the Box",
    caption: "The fullback tucks in alongside the pivot. The eights push high. A box is formed.",
    ball: { x: 45, y: 38 },
    tokens: tokens2,
    arrows: [
      { id: "ar-1", kind: "run", from: { x: 25, y: 85 }, to: { x: 43, y: 64 } },
      { id: "ar-2", kind: "pass", from: { x: 20, y: 65 }, to: { x: 43, y: 39 } }
    ],
    bands: [
      { id: "bd-box", kind: "zone", rect: { x: 40, y: 33, w: 30, h: 34 } }
    ]
  },
  {
    id: "act-3",
    title: "The Vertical Pass",
    caption: "With the box controlling the center, we bypass the block and play into the striker.",
    ball: { x: 75, y: 50 },
    tokens: tokens3,
    arrows: [
      { id: "ar-3", kind: "pass", from: { x: 45, y: 38 }, to: { x: 73, y: 50 } }
    ],
    bands: [
      { id: "bd-box", kind: "zone", rect: { x: 40, y: 33, w: 30, h: 34 } }
    ]
  },
  {
    id: "act-4",
    title: "The Trap is Sprung",
    caption: "The opposition centre-back intercepts and looks to counter. Now watch the box.",
    ball: { x: 80, y: 45 },
    tokens: tokens4,
    arrows: [],
    bands: [
      { id: "bd-box", kind: "zone", rect: { x: 40, y: 33, w: 30, h: 34 } }
    ]
  },
  {
    id: "act-5",
    title: "Suffocating the Counter",
    caption: "Nobody drops. The box instantly collapses on the ball carrier, suffocating the counter-attack.",
    ball: { x: 80, y: 45 },
    tokens: tokens5,
    arrows: [
      { id: "ar-4", kind: "run", from: { x: 65, y: 38 }, to: { x: 73, y: 41 } },
      { id: "ar-5", kind: "run", from: { x: 45, y: 38 }, to: { x: 63, y: 39 } },
      { id: "ar-6", kind: "run", from: { x: 65, y: 62 }, to: { x: 68, y: 51 } },
      { id: "ar-7", kind: "run", from: { x: 45, y: 62 }, to: { x: 58, y: 56 } }
    ],
    bands: [
      { id: "bd-box", kind: "danger", rect: { x: 55, y: 35, w: 25, h: 25 } }
    ]
  }
];

fs.writeFileSync(file, JSON.stringify(data, null, 2));
