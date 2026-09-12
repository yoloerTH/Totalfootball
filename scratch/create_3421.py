import json
import copy

base_tokens = [
    { "id": "u-gk", "x": 6, "y": 50, "label": "GK", "side": "us" },
    { "id": "u-lcb", "x": 25, "y": 25, "label": "LCB", "side": "us" },
    { "id": "u-ccb", "x": 22, "y": 50, "label": "CB", "side": "us" },
    { "id": "u-rcb", "x": 25, "y": 75, "label": "RCB", "side": "us" },
    { "id": "u-lwb", "x": 45, "y": 10, "label": "LWB", "side": "us" },
    { "id": "u-lcm", "x": 40, "y": 38, "label": "6", "side": "us" },
    { "id": "u-rcm", "x": 40, "y": 62, "label": "8", "side": "us" },
    { "id": "u-rwb", "x": 45, "y": 90, "label": "RWB", "side": "us" },
    { "id": "u-lam", "x": 60, "y": 28, "label": "10", "side": "us" },
    { "id": "u-ram", "x": 60, "y": 72, "label": "10", "side": "us" },
    { "id": "u-9", "x": 75, "y": 50, "label": "9", "side": "us" },
    { "id": "o-gk", "x": 94, "y": 50, "label": "GK", "side": "them" },
    { "id": "o-lb", "x": 80, "y": 20, "label": "LB", "side": "them" },
    { "id": "o-lcb", "x": 82, "y": 40, "label": "CB", "side": "them" },
    { "id": "o-rcb", "x": 82, "y": 60, "label": "CB", "side": "them" },
    { "id": "o-rb", "x": 80, "y": 80, "label": "RB", "side": "them" },
    { "id": "o-lm", "x": 65, "y": 15, "label": "LM", "side": "them" },
    { "id": "o-lcm", "x": 67, "y": 42, "label": "CM", "side": "them" },
    { "id": "o-rcm", "x": 67, "y": 58, "label": "CM", "side": "them" },
    { "id": "o-rm", "x": 65, "y": 85, "label": "RM", "side": "them" },
    { "id": "o-lcf", "x": 48, "y": 43, "label": "CF", "side": "them" },
    { "id": "o-rcf", "x": 48, "y": 57, "label": "CF", "side": "them" }
]

def get_token(tokens, tid):
    for t in tokens:
        if t["id"] == tid: return t
    return None

# Act 1
act1_tokens = copy.deepcopy(base_tokens)
act1 = {
    "id": "act-1",
    "title": "The 3-4-2-1 Structure",
    "caption": "Xabi Alonso's blueprint: 3 centre-backs, a double pivot, flying wing-backs, and twin #10s.",
    "ball": { "x": 22, "y": 50 },
    "tokens": act1_tokens,
    "arrows": [],
    "bands": []
}

# Act 2
act2_tokens = copy.deepcopy(base_tokens)
for t in act2_tokens:
    if t["id"] in ["u-gk", "u-lcb", "u-ccb", "u-rcb", "u-lwb", "u-rwb", "u-9", "o-gk", "o-lb", "o-lcb", "o-rcb", "o-rb", "o-lm", "o-rm", "o-lcf", "o-rcf"]:
        t["dim"] = True
    if t["id"] in ["u-lcm", "u-rcm", "u-lam", "u-ram"]:
        t["cue"] = "BOX"

act2 = {
    "id": "act-2",
    "title": "The Box Midfield Superiority",
    "caption": "The two #6s and two #10s create a 4v2 central overload, dominating the midfield.",
    "ball": { "x": 40, "y": 62 },
    "tokens": act2_tokens,
    "arrows": [
        { "id": "ar-2", "kind": "pass", "from": { "x": 22, "y": 50 }, "to": { "x": 40, "y": 62 } }
    ],
    "bands": [
        { "id": "bd-box", "kind": "zone", "rect": { "x": 35, "y": 25, "w": 30, "h": 50 } }
    ]
}

# Act 3
act3_tokens = copy.deepcopy(base_tokens)
get_token(act3_tokens, "o-rm")["cue"] = "PINNED"
get_token(act3_tokens, "u-lwb")["cue"] = "ISOLATED"
act3 = {
    "id": "act-3",
    "title": "Isolating the Wing-Back",
    "caption": "By fixing the opponent centrally, the weak-side wing-back is isolated 1v1 in space.",
    "ball": { "x": 45, "y": 10 },
    "tokens": act3_tokens,
    "arrows": [
        { "id": "ar-3", "kind": "switch", "from": { "x": 40, "y": 62 }, "to": { "x": 45, "y": 10 }, "bend": 0.2 }
    ],
    "bands": [
        { "id": "bd-iso", "kind": "danger", "rect": { "x": 40, "y": 5, "w": 25, "h": 20 } }
    ]
}

# Act 4
act4_tokens = copy.deepcopy(base_tokens)
# Move ball to LWB
get_token(act4_tokens, "u-lwb")["x"] = 55
get_token(act4_tokens, "u-lwb")["y"] = 12
# Opponent LB jumps
get_token(act4_tokens, "o-lb")["x"] = 65
get_token(act4_tokens, "o-lb")["y"] = 15
# LAM attacks space
get_token(act4_tokens, "u-lam")["x"] = 78
get_token(act4_tokens, "u-lam")["y"] = 20

act4 = {
    "id": "act-4",
    "title": "Attacking the Half-Space",
    "caption": "When the opposition full-back jumps, the #10 exploits the space left behind them.",
    "ball": { "x": 78, "y": 20 },
    "tokens": act4_tokens,
    "arrows": [
        { "id": "ar-4-run", "kind": "run", "from": { "x": 60, "y": 28 }, "to": { "x": 78, "y": 20 } },
        { "id": "ar-4-pass", "kind": "pass", "from": { "x": 55, "y": 12 }, "to": { "x": 78, "y": 20 } }
    ],
    "bands": [
        { "id": "bd-space", "kind": "danger", "rect": { "x": 70, "y": 10, "w": 15, "h": 20 } }
    ]
}

final_data = {
  "v": 1,
  "title": "Mastering the 3-4-2-1",
  "subtitle": "Xabi Alonso's Leverkusen Blueprint",
  "pitch": "full",
  "matchBall": "trionda",
  "teams": {
    "us": { "name": "Leverkusen", "base": "#E2473B", "deep": "#B5392F", "text": "#FFFFFF" },
    "them": { "name": "Opposition", "base": "#333333", "deep": "#111111", "text": "#FFFFFF" }
  },
  "acts": [act1, act2, act3, act4]
}

with open("../content/systems/mastering-3-4-2-1.json", "w") as f:
    json.dump(final_data, f, indent=2)

print("Generated content/systems/mastering-3-4-2-1.json")
