import json
import uuid
import copy

def rand_id(prefix):
    return f"{prefix}-{uuid.uuid4().hex[:6]}"

# Field is approx 0 to 100 in x and y. Let's use central area.
# Positions for "Double Diamond Continuous Passing"
# A: 50, 15 (Start bottom)
# B: 50, 35 (Pivot)
# C: 30, 50 (Left Wing)
# D: 70, 50 (Right Wing)
# E: 50, 65 (Attacking Mid)
# F: 50, 85 (Striker)

base_gear = [
    {"x": 50, "y": 15, "id": "gr-A", "kind": "marker-cone"},
    {"x": 50, "y": 35, "id": "gr-B", "kind": "marker-cone"},
    {"x": 30, "y": 50, "id": "gr-C", "kind": "marker-cone"},
    {"x": 70, "y": 50, "id": "gr-D", "kind": "marker-cone"},
    {"x": 50, "y": 65, "id": "gr-E", "kind": "marker-cone"},
    {"x": 50, "y": 85, "id": "gr-F", "kind": "marker-cone"},
]

base_tokens = [
    {"x": 50, "y": 13, "id": "us-X1", "side": "us", "label": "1"},
    {"x": 52, "y": 35, "id": "us-X2", "side": "us", "label": "2"},
    {"x": 28, "y": 50, "id": "us-X3", "side": "us", "label": "3"},
    {"x": 72, "y": 50, "id": "us-X4", "side": "us", "label": "4"},
    {"x": 52, "y": 65, "id": "us-X5", "side": "us", "label": "5"},
    {"x": 52, "y": 85, "id": "us-X6", "side": "us", "label": "6"},
    {"x": 48, "y": 11, "id": "us-X7", "side": "us", "label": "7"}, # waiting in line
]

# The drill logic:
# We will create an act for the "pass", then an act for "ball travels & player moves".
# To keep it simple but > 15 phases, we just map out a list of events.
# Event: (passer_id, receiver_id, next_pos_for_passer (optional))

events = [
    # 1. A to B
    ("us-X1", "us-X2", None),
    # 2. B sets back to A
    ("us-X2", "us-X1", None),
    # 3. A plays long to E
    ("us-X1", "us-X5", None),
    # 4. E lays off to C
    ("us-X5", "us-X3", None),
    # 5. C plays inside to B
    ("us-X3", "us-X2", None),
    # 6. B plays wide to D
    ("us-X2", "us-X4", None),
    # 7. D plays into F
    ("us-X4", "us-X6", None),
    # 8. F lays off to E
    ("us-X6", "us-X5", None),
    # 9. E plays through to D (making a run)
    ("us-X5", "us-X4", (65, 75)), 
    # 10. D crosses back to C (making a run)
    ("us-X4", "us-X3", (35, 75)),
    # 11. C passes back to B
    ("us-X3", "us-X2", None),
    # 12. B passes to X7 (at start)
    ("us-X2", "us-X7", None),
    # 13. X7 starts second cycle, passes to B
    ("us-X7", "us-X2", None),
    # 14. B sets back to X7
    ("us-X2", "us-X7", None),
    # 15. X7 to E
    ("us-X7", "us-X5", None),
    # 16. E to D
    ("us-X5", "us-X4", (72, 50)), # D goes back to original
    # 17. D to B
    ("us-X4", "us-X2", None),
    # 18. B to C
    ("us-X2", "us-X3", (28, 50)), # C goes back
    # 19. C to F
    ("us-X3", "us-X6", None),
    # 20. F to X1
    ("us-X6", "us-X1", None)
]

acts = []
current_tokens = copy.deepcopy(base_tokens)

def get_token(t_id):
    for t in current_tokens:
        if t["id"] == t_id: return t
    return None

current_ball_pos = {"x": 50, "y": 13}

for i, ev in enumerate(events):
    passer_id = ev[0]
    receiver_id = ev[1]
    mover_dest = ev[2]
    
    passer = get_token(passer_id)
    receiver = get_token(receiver_id)
    
    # Act A: Preparing the pass (arrow from passer to receiver)
    act_a = {
        "id": rand_id("act"),
        "ball": {"x": passer["x"], "y": passer["y"]},
        "gear": base_gear,
        "shot": {"h": 100, "w": 100, "x": 50, "y": 50},
        "balls": [{"x": passer["x"], "y": passer["y"], "id": "ball"}],
        "bands": [],
        "texts": [],
        "title": f"Phase {i*2 + 1}",
        "arrows": [
            {
                "id": rand_id("ar"),
                "to": {"x": receiver["x"], "y": receiver["y"]},
                "from": {"x": passer["x"], "y": passer["y"]},
                "kind": "pass",
                "toId": receiver_id,
                "fromId": passer_id,
                "opacity": 0.5
            }
        ],
        "tokens": copy.deepcopy(current_tokens),
        "caption": ""
    }
    
    # If the player is going to move, add a run arrow
    if mover_dest:
        act_a["arrows"].append({
            "id": rand_id("ar"),
            "to": {"x": mover_dest[0], "y": mover_dest[1]},
            "from": {"x": receiver["x"], "y": receiver["y"]} if mover_dest == "receiver" else {"x": passer["x"], "y": passer["y"]},
            "kind": "run",
            "fromId": receiver_id if mover_dest == "receiver" else passer_id,
            "opacity": 0
        })

    acts.append(act_a)
    
    # Update token position if there was a move
    if mover_dest:
        if mover_dest == "receiver":
            pass # complex to handle receiver moving before ball gets there
        else:
            passer["x"] = mover_dest[0]
            passer["y"] = mover_dest[1]

    # Act B: Ball has arrived
    act_b = {
        "id": rand_id("act"),
        "ball": {"x": receiver["x"], "y": receiver["y"]},
        "gear": base_gear,
        "shot": {"h": 100, "w": 100, "x": 50, "y": 50},
        "balls": [{"x": receiver["x"], "y": receiver["y"], "id": "ball"}],
        "bands": [],
        "texts": [],
        "title": f"Phase {i*2 + 2}",
        "arrows": [],
        "tokens": copy.deepcopy(current_tokens),
        "caption": ""
    }
    acts.append(act_b)

final_data = {
    "v": 1,
    "acts": acts
}

with open("content/systems/advanced-continuous-passing.json", "w") as f:
    json.dump(final_data, f, indent=2)

print("Created content/systems/advanced-continuous-passing.json")
