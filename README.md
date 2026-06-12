# 🔮 Crystal Ball — World Cup 2026 Oracle

A mobile-first World Cup 2026 predictor game. The Oracle — powered by deep AI research into
every team, player, venue, injury list and betting market — foretells the score of **all 104
matches**, with a mystical-but-explainable "reading" behind every prediction. You make your
own picks and battle the Oracle for Prophecy Points as real results come in.

**Live site:** https://djordje050182.github.io/crystal-ball-worldcup/

## Features
- 🔮 **Today** — today's matches, the Oracle's foreseen scores, and recent visions judged against real results
- 📅 **Matches** — every fixture, filterable by group/knockout, each with a crystal-ball reading, key factor and confidence level
- 🏆 **Groups** — predicted finishing order for all 12 groups; tap any team for its full dossier (manager, tactics, form, key players)
- 🌳 **Bracket** — the Oracle's projected road to the MetLife final, plus a *Your bracket* mode where your picks ripple through the rounds
- 🧙 **Oracle** — champion prophecy, Golden Boot, dark horses, power rankings and the bold prediction
- 🫵 **Prophecy Points** — exact score = 3 pts, right outcome = 1 pt; your tally vs the Oracle's, scored automatically from real results

## How it stays fresh
Predictions and results are regenerated daily by an AI research agent that:
1. Fetches the latest results, injuries, suspensions and form
2. Marks played matches in `data/raw-results.json`
3. Refines future readings in the raw research files
4. Runs `python3 scripts/build_data.py` to rebuild `data/predictions.json`

See `UPDATING.md` for the exact daily procedure.

## Stack
Zero dependencies: vanilla HTML/CSS/JS, one JSON data file, hosted on GitHub Pages.
User picks live in `localStorage` — no accounts, no tracking.
