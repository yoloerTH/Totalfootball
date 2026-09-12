import json
import uuid

def rand_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:6]}"

# We define the coordinates for each phase to ensure players move fluidly.
phases = [
    # Phase 1: Build-up vs 4-4-2 Block (Luring the Press)
    {
        "coords": {
            "u-gk": [6, 50], "u-lcb": [20, 25], "u-ccb": [18, 50], "u-rcb": [20, 75],
            "u-lwb": [40, 10], "u-lcm": [32, 40], "u-rcm": [32, 60], "u-rwb": [40, 90],
            "u-lam": [48, 30], "u-ram": [48, 70], "u-9": [60, 50],
            "o-gk": [94, 50], "o-lb": [70, 15], "o-lcb": [70, 38], "o-rcb": [70, 62], "o-rb": [70, 85],
            "o-lm": [55, 15], "o-lcm": [55, 40], "o-rcm": [55, 60], "o-rm": [55, 85],
            "o-lcf": [45, 45], "o-rcf": [45, 55]
        },
        "ball": [18, 50],
        "title": "Phase 1: Luring the Press",
        "caption": "The 3 CBs stretch the first line. The CCB triggers the press, looking to shift the opponent block to one side.",
        "arrows": [
            {"kind": "pass", "from": [18, 50], "to": [22, 22]}
        ],
        "props": {
            "o-lcf": {"cue": "PRESS"}
        }
    },
    # Phase 2: Drawing the Block (The Trap)
    {
        "coords": {
            "u-gk": [6, 50], "u-lcb": [22, 22], "u-ccb": [18, 50], "u-rcb": [22, 75],
            "u-lwb": [45, 8], "u-lcm": [30, 35], "u-rcm": [35, 60], "u-rwb": [45, 92],
            "u-lam": [45, 25], "u-ram": [50, 70], "u-9": [65, 50],
            "o-gk": [94, 50], "o-lb": [65, 18], "o-lcb": [68, 40], "o-rcb": [70, 60], "o-rb": [72, 85],
            "o-lm": [45, 20], "o-lcm": [48, 45], "o-rcm": [50, 60], "o-rm": [50, 80],
            "o-lcf": [40, 35], "o-rcf": [42, 50]
        },
        "ball": [22, 22],
        "title": "Phase 2: Shifting the Block",
        "caption": "As the ball goes to the LCB, the opposition shifts aggressively. The LCM drops to offer an angle.",
        "arrows": [
            {"kind": "pass", "from": [22, 22], "to": [30, 35]}
        ],
        "props": {
            "u-lcm": {"cue": "SUPPORT"}
        }
    },
    # Phase 3: The Box Midfield Exposed
    {
        "coords": {
            "u-gk": [6, 50], "u-lcb": [24, 24], "u-ccb": [20, 50], "u-rcb": [24, 72],
            "u-lwb": [45, 8], "u-lcm": [30, 35], "u-rcm": [35, 60], "u-rwb": [50, 92],
            "u-lam": [42, 28], "u-ram": [48, 65], "u-9": [65, 50],
            "o-gk": [94, 50], "o-lb": [62, 20], "o-lcb": [65, 42], "o-rcb": [68, 62], "o-rb": [70, 85],
            "o-lm": [42, 22], "o-lcm": [42, 38], "o-rcm": [48, 58], "o-rm": [48, 80],
            "o-lcf": [35, 30], "o-rcf": [38, 48]
        },
        "ball": [30, 35],
        "title": "Phase 3: The Box Midfield Superiority",
        "caption": "The LCM breaks the first line. The opponent's CM steps up to press, leaving a massive gap for the #10 (LAM) inside the box midfield.",
        "arrows": [
            {"kind": "pass", "from": [30, 35], "to": [42, 28]}
        ],
        "bands": [
            {"kind": "zone", "rect": {"x": 28, "y": 25, "w": 25, "h": 45}}
        ],
        "props": {
            "o-lcm": {"cue": "JUMPS"}
        }
    },
    # Phase 4: Pinning & The Switch
    {
        "coords": {
            "u-gk": [6, 50], "u-lcb": [26, 26], "u-ccb": [22, 50], "u-rcb": [26, 70],
            "u-lwb": [48, 8], "u-lcm": [32, 38], "u-rcm": [38, 55], "u-rwb": [55, 92],
            "u-lam": [45, 30], "u-ram": [48, 65], "u-9": [65, 45],
            "o-gk": [94, 50], "o-lb": [55, 25], "o-lcb": [60, 42], "o-rcb": [65, 65], "o-rb": [68, 85],
            "o-lm": [45, 20], "o-lcm": [40, 35], "o-rcm": [46, 55], "o-rm": [48, 78],
            "o-lcf": [38, 35], "o-rcf": [40, 50]
        },
        "ball": [45, 30],
        "title": "Phase 4: Pinning and Switching",
        "caption": "The LAM receives but is closed down. However, the opponent is now completely pinned on the left. The RCM executes the switch to the free RWB.",
        "arrows": [
            {"kind": "pass", "from": [45, 30], "to": [38, 55]},
            {"kind": "switch", "from": [38, 55], "to": [60, 92], "bend": 0.2},
            {"kind": "run", "from": [55, 92], "to": [60, 92]}
        ],
        "props": {
            "u-rwb": {"cue": "SPARE"},
            "o-lb": {"cue": "PINNED"}
        }
    },
    # Phase 5: The Weak-Side Isolation (1v1)
    {
        "coords": {
            "u-gk": [6, 50], "u-lcb": [30, 26], "u-ccb": [28, 50], "u-rcb": [32, 65],
            "u-lwb": [50, 10], "u-lcm": [35, 40], "u-rcm": [40, 58], "u-rwb": [60, 92],
            "u-lam": [48, 32], "u-ram": [55, 65], "u-9": [68, 50],
            "o-gk": [94, 50], "o-lb": [60, 30], "o-lcb": [65, 50], "o-rcb": [68, 68], "o-rb": [65, 85],
            "o-lm": [50, 25], "o-lcm": [45, 40], "o-rcm": [50, 60], "o-rm": [55, 80],
            "o-lcf": [42, 40], "o-rcf": [45, 55]
        },
        "ball": [60, 92],
        "title": "Phase 5: Weak-Side 1v1",
        "caption": "The RWB receives in acres of space. The opponent's block scrambles to shift across, forcing their full-back to jump late.",
        "arrows": [
            {"kind": "carry", "from": [60, 92], "to": [72, 92]},
            {"kind": "run", "from": [55, 65], "to": [75, 75]}
        ],
        "bands": [
            {"kind": "danger", "rect": {"x": 62, "y": 70, "w": 25, "h": 25}}
        ],
        "props": {
            "o-rb": {"cue": "LATE TO PRESS"}
        }
    },
    # Phase 6: Attacking the Half-Space
    {
        "coords": {
            "u-gk": [8, 50], "u-lcb": [35, 26], "u-ccb": [35, 50], "u-rcb": [40, 65],
            "u-lwb": [55, 10], "u-lcm": [40, 40], "u-rcm": [45, 58], "u-rwb": [72, 92],
            "u-lam": [55, 35], "u-ram": [75, 75], "u-9": [75, 50],
            "o-gk": [94, 50], "o-lb": [65, 35], "o-lcb": [70, 52], "o-rcb": [75, 68], "o-rb": [72, 88],
            "o-lm": [55, 30], "o-lcm": [50, 45], "o-rcm": [55, 65], "o-rm": [60, 82],
            "o-lcf": [48, 45], "o-rcf": [50, 60]
        },
        "ball": [72, 92],
        "title": "Phase 6: The Half-Space Threat",
        "caption": "As the full-back commits to the wing-back, the RAM (#10) makes a devastating underlapping run into the exposed half-space.",
        "arrows": [
            {"kind": "pass", "from": [72, 92], "to": [82, 75]},
            {"kind": "run", "from": [75, 50], "to": [85, 45]}
        ],
        "bands": [
            {"kind": "danger", "rect": {"x": 72, "y": 68, "w": 15, "h": 18}}
        ],
        "props": {
            "u-ram": {"cue": "SPACE"}
        }
    },
    # Phase 7: The Cutback Finish
    {
        "coords": {
            "u-gk": [10, 50], "u-lcb": [40, 26], "u-ccb": [40, 50], "u-rcb": [45, 65],
            "u-lwb": [60, 10], "u-lcm": [45, 40], "u-rcm": [50, 58], "u-rwb": [75, 90],
            "u-lam": [72, 35], "u-ram": [82, 75], "u-9": [85, 45],
            "o-gk": [94, 50], "o-lb": [70, 38], "o-lcb": [78, 55], "o-rcb": [80, 70], "o-rb": [75, 88],
            "o-lm": [60, 35], "o-lcm": [55, 50], "o-rcm": [60, 70], "o-rm": [65, 85],
            "o-lcf": [52, 48], "o-rcf": [55, 62]
        },
        "ball": [82, 75],
        "title": "Phase 7: The Cutback",
        "caption": "The RAM reaches the byline. The defense is broken and facing their own goal. A simple cutback to the ST (9) finishes the move.",
        "arrows": [
            {"kind": "pass", "from": [82, 75], "to": [85, 45]},
            {"kind": "run", "from": [72, 35], "to": [85, 55]}
        ],
        "bands": [],
        "props": {
            "u-9": {"cue": "FINISH"}
        }
    }
]

def generate_tokens(coords, properties={}):
    tokens = []
    for tid, (x, y) in coords.items():
        side = "us" if tid.startswith("u-") else "them"
        label = tid.split("-")[1].upper()
        if label == 'LCM': label = '6' if side == 'us' else 'CM'
        if label == 'RCM': label = '8' if side == 'us' else 'CM'
        if label == 'LAM' or label == 'RAM': label = '10'
        if label == 'LCF' or label == 'RCF': label = 'CF'
        if label == 'CCB': label = 'CB'
        
        tok = {"id": tid, "x": x, "y": y, "label": label, "side": side}
        if tid in properties:
            if "dim" in properties[tid]: tok["dim"] = properties[tid]["dim"]
            if "cue" in properties[tid]: tok["cue"] = properties[tid]["cue"]
        
        # Automatically dim players far away from the action to focus the eye
        # We will dim the opposite side fullbacks/wingbacks and GKs in advanced phases
        if tid in ['u-gk', 'o-gk']:
            tok['dim'] = True
            
        tokens.append(tok)
    return tokens

acts = []
for i, phase in enumerate(phases):
    props = phase.get("props", {})
    
    act = {
        "id": f"act-{i+1}",
        "title": phase["title"],
        "caption": phase["caption"],
        "ball": {"x": phase["ball"][0], "y": phase["ball"][1]},
        "tokens": generate_tokens(phase["coords"], props),
        "arrows": [],
        "bands": phase.get("bands", [])
    }
    
    # Add arrows
    for arrow in phase.get("arrows", []):
        arr = {
            "id": rand_id("ar"),
            "kind": arrow["kind"],
            "from": {"x": arrow["from"][0], "y": arrow["from"][1]},
            "to": {"x": arrow["to"][0], "y": arrow["to"][1]}
        }
        if "bend" in arrow: arr["bend"] = arrow["bend"]
        act["arrows"].append(arr)
        
    acts.append(act)

final_data = {
  "v": 1,
  "title": "Mastering the 3-4-2-1 (Full Analysis)",
  "subtitle": "Xabi Alonso's Leverkusen Blueprint: A 7-Phase Breakdown",
  "pitch": "full",
  "matchBall": "trionda",
  "teams": {
    "us": { "name": "Leverkusen", "base": "#E2473B", "deep": "#B5392F", "text": "#FFFFFF" },
    "them": { "name": "Opposition", "base": "#333333", "deep": "#111111", "text": "#FFFFFF" }
  },
  "acts": acts
}

with open("../content/systems/mastering-3-4-2-1-full.json", "w") as f:
    json.dump(final_data, f, indent=2)

print("Generated content/systems/mastering-3-4-2-1-full.json")
