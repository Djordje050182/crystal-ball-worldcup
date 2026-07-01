# Daily update procedure (for the AI updater agent)

Run once per day during the tournament (June 11 – July 19, 2026). Goal: keep the Oracle's
predictions world-class and current, and grade played matches.

## Steps

1. **Research today's state** (web search: FIFA.com, BBC Sport, ESPN, Opta):
   - Final scores of all matches played since the last update
   - Confirmed group standings / qualified teams as groups conclude
   - New injuries, suspensions, form notes affecting upcoming predictions

2. **Record results** in `data/raw-results.json` (create if absent), appending entries:
   ```json
   [
     {"matchNo": 4, "score": "1-0"},
     {"id": "R32-1", "score": "2-1", "home": "South Korea", "away": "Bosnia and Herzegovina"}
   ]
   ```
   - Group matches: reference by `matchNo` (FIFA official match number).
   - Knockout matches: reference by bracket id (`R32-1` … `R32-16`, `R16-1` …, `QF-1` …, `SF-1`, `SF-2`, `3RD`, `FINAL`) and include the real `home`/`away` team names once known.

3. **Refine future predictions** where the picture has materially changed (injury, form shock,
   confirmed bracket pairing): edit `predictedScore` / `confidence` / `reading` / `keyFactor`
   in the relevant `data/raw-groups-*.json` or `data/raw-knockout-predictions.json`.
   Keep readings in the mystical-but-grounded voice. NEVER change predictions for matches
   already played — the Oracle's record must stay honest.

4. **As groups conclude**, update `data/raw-knockout-predictions.json` so `predHome`/`predAway`
   reflect the real qualified teams, and re-write those readings with real matchup analysis.
   Update `predictedOrder` in the group files to match the final real standings.

4b. **Kickoff times**: every knockout entry in `data/raw-bracket.json` carries a `kickoffUTC`
   ISO timestamp (e.g. `"2026-07-19T19:00:00Z"`). The site uses it to show "On now" status and
   local kick-off times, so preserve these fields, and if FIFA moves a kickoff, correct the
   affected `kickoffUTC` (verify against FIFA.com — convert venue-local to UTC carefully).

5. **Rebuild**: `python3 scripts/build_data.py` (updates `data/predictions.json` and stamps today's date).

6. **Commit and push** to `main` with message `daily oracle update YYYY-MM-DD`.
   GitHub Pages redeploys automatically.

## Integrity rules
- Predictions for played matches are frozen at whatever was last published before kickoff.
- Confidence values stay calibrated: 35–55 for tight games, 55–70 favourites, 70+ only for mismatches.
- Every reading must contain at least one concrete, verifiable analytical hook (form, injury, tactic, venue).
