#!/usr/bin/env python3
"""Assemble data/predictions.json from the raw research files.

Inputs (all in data/):
  raw-groups-ABC.json, raw-groups-DEF.json, raw-groups-GHI.json, raw-groups-JKL.json
  raw-bracket.json            — knockout structure, stadiums, results so far
  raw-knockout-predictions.json — oracle's projected knockout teams/scores/readings
  raw-oracle.json             — tournament-level analysis (champion, odds, narratives)
  raw-results.json (optional) — daily-updated actual results: [{"matchNo"|"id", "score", "date"?}]

Output: data/predictions.json (single file the site fetches).
"""
import json
import datetime
import pathlib

DATA = pathlib.Path(__file__).resolve().parent.parent / "data"


def load(name, optional=False):
    p = DATA / name
    if not p.exists():
        if optional:
            return None
        raise SystemExit(f"missing {p}")
    return json.loads(p.read_text())


def main():
    group_files = ["raw-groups-ABC.json", "raw-groups-DEF.json",
                   "raw-groups-GHI.json", "raw-groups-JKL.json"]
    bracket = load("raw-bracket.json")
    oracle_raw = load("raw-oracle.json")
    ko_pred = load("raw-knockout-predictions.json", optional=True) or {}
    results = load("raw-results.json", optional=True) or []

    teams, groups, matches = {}, [], []

    for gf in group_files:
        for g in load(gf)["groups"]:
            for t in g["teams"]:
                teams[t["name"]] = {**t, "group": g["group"]}
            groups.append({"group": g["group"],
                           "predictedOrder": g["predictedOrder"],
                           "groupReading": g.get("groupReading", "")})
            for i, m in enumerate(g["matches"], 1):
                mid = f"M{m['matchNo']}" if m.get("matchNo") else f"G{g['group']}{i}"
                matches.append({"id": mid, "stage": "GROUP", "group": g["group"], **m})

    # fold in results: from bracket.resultsSoFar (by team names) and raw-results.json (by matchNo/id)
    def mark(home, away, score):
        for m in matches:
            if m.get("home") == home and m.get("away") == away:
                m["played"], m["actualScore"] = True, score
                return True
        return False

    for r in bracket.get("resultsSoFar", []):
        if r.get("score") and "-" in str(r["score"]):
            mark(r["home"], r["away"], r["score"])
    for r in results:
        key = r.get("id") or f"M{r.get('matchNo')}"
        for m in matches:
            if m["id"] == key and r.get("score"):
                m["played"], m["actualScore"] = True, r["score"]

    for k in bracket["knockout"]:
        matches.append({**k, **ko_pred.get(k["id"], {}), "played": k.get("played", False)})
    # knockout results can also arrive via raw-results.json using the R32-1…FINAL ids
    for r in results:
        for m in matches:
            if m["id"] == r.get("id") and r.get("score") and m["stage"] != "GROUP":
                m["played"], m["actualScore"] = True, r["score"]
                if r.get("home"):
                    m["home"], m["away"] = r["home"], r.get("away")

    oracle = dict(oracle_raw["oracle"])
    oracle["championOdds"] = oracle_raw["championOdds"]
    oracle["darkHorses"] = oracle_raw["darkHorses"]
    oracle["narratives"] = oracle_raw["narratives"]
    oracle["contenders"] = oracle_raw["contenders"]
    oracle["goldenBoot"]["candidates"] = [
        f"{c['player']} ({c['team']})" for c in oracle_raw["goldenBootCandidates"]]

    out = {
        "meta": {
            "updated": datetime.date.today().isoformat(),
            "tournament": "FIFA World Cup 2026",
            "format": bracket["format"],
            "thirdPlaceRule": bracket["thirdPlaceRule"],
        },
        "oracle": oracle,
        "teams": teams,
        "groups": sorted(groups, key=lambda g: g["group"]),
        "matches": matches,
    }
    (DATA / "predictions.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
    played = sum(1 for m in matches if m.get("played"))
    print(f"wrote predictions.json: {len(teams)} teams, {len(matches)} matches ({played} played)")


if __name__ == "__main__":
    main()
