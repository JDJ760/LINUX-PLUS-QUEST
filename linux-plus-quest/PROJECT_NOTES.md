# TechQuest / Linux+ Quest — Project Notes

> Durable context doc for anyone (including future-me or an AI assistant) picking up this project.

---

## What this is

A single-file Progressive Web App (PWA) study game for IT certifications. Built by Jason Johnson (GitHub: [JDJ760](https://github.com/JDJ760)) as a personal study tool while working toward CompTIA A+, Linux+, and Security+, and during CS1B (C++/OOP) coursework.

**Live:** https://jdj760.github.io/LINUX-PLUS-QUEST/
**Repo:** https://github.com/JDJ760/LINUX-PLUS-QUEST

---

## Owner / context

- **Jason Johnson** — Cyber Defense student at Saddleback College, transferring to CSU Fullerton
- **Email:** jasondjohnson1010@gmail.com
- **Active goals:** CompTIA A+ (220-1101 / 220-1102) in progress, Linux+ XK0-005 next, Security+ SY0-701 after
- **Side goal:** explore turning this into a sellable app-store product long-term
- **Build machine:** Windows PC, Git Bash, PowerShell, VS Code / Visual Studio
- **Deploy:** GitHub Pages (automatic on push to `main`)

---

## File layout

```
LINUX-PLUS-QUEST/              ← repo root
├── index.html                 ← root redirect → ./linux-plus-quest/
└── linux-plus-quest/          ← actual app
    ├── index.html             ← THE app (single file, ~1,800 lines, all HTML/CSS/JS)
    ├── manifest.json          ← PWA manifest (start_url + scope = "./")
    └── sw.js                  ← service worker (cache-first, versioned)
```

**Everything lives in `linux-plus-quest/index.html`.** CSS, JS, question bank — all inline. Intentional: zero build step, fast iteration, works offline, trivial to deploy.

---

## How to work on it

```bash
# Edit
# …open linux-plus-quest/index.html in your editor

# Test locally
start linux-plus-quest/index.html          # Windows opens in default browser

# Ship
cd "path/to/repo"
git add linux-plus-quest/
git commit -m "what changed"
git push            # GH Pages auto-redeploys in ~30s
```

**Every functional change MUST bump `CACHE` in `sw.js`** (e.g. `linuxquest-v8` → `linuxquest-v9`), otherwise users load the cached old version. Users also need a hard-refresh to pick up new SW.

---

## Architecture decisions (why things are the way they are)

| Decision | Rationale |
|---|---|
| Single-file HTML | No build tooling, instant edit/refresh loop |
| PWA (manifest + SW) | Installable on phone/PC, works offline |
| localStorage for state | No backend needed, user owns their data |
| CSP with `'unsafe-inline'` | Inline scripts are fundamental to single-file design; external scripts still blocked |
| No dependencies | Zero supply-chain attack surface; no npm |
| `start_url: "./"` | Works from any deployment path (GH Pages subfolder, Netlify root, local file) |
| Root `index.html` redirect | So `jdj760.github.io/LINUX-PLUS-QUEST/` works (not just the nested path) |

---

## Data model — question shape

All questions live in one big `BANK` array in `index.html`. Four types exist:

```js
// Multiple choice (default — no `type` field needed)
{sub:"linux", lvl:1, d:"Commands",
 q:"What does `pwd` do?",
 a:["Print working dir", "Change dir", "List", "Quit"], c:0,
 e:"pwd = print working directory"},

// Fill in the blank
{sub:"ap", lvl:2, d:"Core 1 · Networking", type:"fill",
 q:"The port for HTTPS is ______",
 answers:["443"],            // array — multiple accepted spellings allowed
 e:"HTTPS uses TCP 443"},

// Multi-select (select all that apply)
{sub:"ap", lvl:3, d:"Core 2 · Security", type:"multi",
 q:"Which are social engineering? (Select all)",
 a:["Phishing","Brute force","Tailgating","SQLi","Vishing"],
 correct:[0,2,4],            // indices of ALL correct answers
 e:"Social eng targets humans…"},
```

**Question text is DATA, never markup.** Every BANK field is passed through `esc()`
before it reaches `innerHTML`. Write `vector<int>`, `<iostream>`, and `2>&1` as plain
characters — do NOT hand-escape them as `&lt;`. Before `esc()` existed, raw angle
brackets were parsed as HTML tags and silently deleted, which made the "which header
do you need for cout and cin?" question render four completely blank buttons.

**Fields:**
- `sub` — subject key: `"linux" | "cs" | "cs1b" | "ap"`
- `lvl` — difficulty: `1` beginner, `2` easy, `3` medium, `4` hard
- `d` — domain / category string, shown as a tag
- `q` — the question text
- `a` — answer array (always shown; shuffled at render time)
- `c` — (MC only) index of correct answer in `a`
- `answers` — (fill only) array of accepted strings (case-insensitive, whitespace-normalized)
- `correct` — (multi only) array of correct indices
- `e` — explanation shown after the answer is graded
- `type` — `"fill" | "multi"` (omit for MC)

---

## Subjects (`SUBS`)

| Key | Name | Icon | Color |
|---|---|---|---|
| `linux` | Linux+ | 🐧 | green |
| `ap` | CompTIA A+ | 🔧 | red |
| `cs` | C++ / CS | 💻 | cyan |
| `cs1b` | CMPR 121 | 📚 | yellow |
| `cs1c` | CS1C | 🌳 | purple |
| `cs3a` | CS 3A | ⚙️ | orange |
| `disc` | Discrete Math | 🔢 | pink |
| `py` | Python | 🐍 | blue |
| `bash` | Bash | 🐚 | mint |
| `sql` | SQL | 🗄️ | tan |

Adding a new subject is now **two lines plus questions**: add the key to `SUBS`, add the
key to `SUB_ORDER` (controls display order), and add questions to `BANK`.
`showSubjectSelect()` builds its cards by looping over `SUB_ORDER` — there is no
per-subject markup to copy any more.

Optional polish for a new subject: a `.subject-card.<key>:hover` and
`.subject-card.<key> .card-title` colour rule in the CSS block near the other ones.

Note on the grid: the subject grid is always two columns. `showSubjectSelect()` adds an
`odd-count` class when `SUB_ORDER.length` is odd, which makes the LAST card span the full
width so the layout never ends on a lonely half-row. This is automatic — you do not need
to touch the CSS when adding or removing a subject.

---

## localStorage keys

| Key | Shape | Purpose |
|---|---|---|
| `tq_<sub>_<lvl>` | number | High score per subject+difficulty |
| `tq_stats` | `{[qid]: {seen, wrong, lastMissed, lastSeen}}` | Per-question stats for weak-spot mode |

`qid(q)` = 32-bit FNV-1a hash of `q.q + "|" + q.sub + "|" + q.lvl`. Stable across reorderings.

---

## Feature status

### ✅ Built (phases 1–5a)
- 10 subjects, 4 difficulty modes each (beginner / easy / medium / hard)
- 544 questions total (as of v12)
- Shuffled question order + shuffled answer order (no memorizing position)
- Fill-in-the-blank question type
- Multi-select question type ("select all that apply")
- Timer mode (HARD level gets 30s/q)
- Hint system (50/50, costs points on easy, free on beginner)
- Streak bonus (+50pts per correct after 3-in-a-row)
- Per-question stats tracking
- **Weak Spots review mode** — drill only missed questions, unlimited lives, sorted most-recent-miss first
- **Exam Simulation mode** — 60 random mixed questions, 60-min countdown, pass at 75%, PASS/FAIL banner
- **Bookmarks / Starred** — star button on every question; "Starred" review card on difficulty screen drills only starred Qs (localStorage `tq_starred`)
- **Flashcard mode** — flip-card study mode, no scoring/timer/lives, click to reveal answer + explanation, prev/next nav
- PWA install support
- Service worker offline cache
- Strict CSP + no-referrer privacy meta

### 🗺️ Roadmap (pending)

See **[DESIGN-TEACHING.md](DESIGN-TEACHING.md)** for the design map that turns this
from a quiz engine into a teaching tool (concept graph, lessons, placement diagnostic,
new item types, the code-execution decision, and phasing).

See **[ROADMAP.md](ROADMAP.md)** for the prioritized plan (spaced repetition, PBQs,
Networking + Security+ subjects, progress export, test suite). The table below is the
older running idea list.

| Phase | Idea |
|---|---|
| 5b | Custom quiz builder (pick subject + tags + count) |
| 6 | Match / drag-and-order question types |
| 6 | Daily streak / question-of-the-day |
| — | Content: expand CS1C / CS 3A / Discrete Math past 48 questions each, and align them with the actual Saddleback syllabi once they're posted |
| — | Content: expand Python / Bash / SQL past 48 each; add PowerShell and a Networking subject |
| — | Content: Security+ SY0-701 subject |
| — | Content: Networking deep-dive subject |
| — | Content: Expand A+ bank to 150+ |
| — | Dark/light theme toggle (currently neon-dark only) |
| — | Export missed questions as text |
| — | Keyboard shortcuts (A/B/C/D keys for MC — already done) |

---

## Commercialization ideas (future / exploratory)

Currently a personal study tool. Possible paths to a sellable product:

**1. Native app wrapping**
- [PWABuilder](https://www.pwabuilder.com/) generates Android (Bubblewrap/TWA) and iOS app packages from a PWA
- Capacitor (ionic.io) for more native integration if needed
- Same codebase → App Store + Play Store submissions

**2. Pricing models**
- **Freemium:** one subject free (e.g. Linux+), unlock others via one-time IAP ($4.99 each) or bundle ($12.99)
- **Subscription:** $2.99/mo for all certs + new content + exam-sim unlocks
- **One-time paid:** $5–10 flat, lifetime
- Avoid ads — bad fit for a study tool, annoying during focus

**3. Competitive landscape**
- **Pocket Prep** — polished, expensive (~$40/cert), test-bank-focused
- **Dion Training** — video courses + practice tests, subscription
- **Professor Messer** — free YouTube + paid practice tests
- **Crucial differentiator here:** weak-spots review, student-built voice, covers combination of certs + coursework, fast installable PWA

**4. Before shipping**
- Tag questions by topic for filtering
- Add at least 500 questions per cert to be taken seriously
- Write real explanations (not one-liners)
- Add licensing / question source attribution
- Privacy policy + terms (iOS requires this)
- Consistent UI polish pass
- Replace emoji icons with vector icons
- Proper analytics (Plausible/etc., not invasive)
- Content review for exam-objective coverage (match CompTIA's actual domain %)

**5. Risks**
- Cert exam content is copyrighted by CompTIA — questions must be original phrasing/scenarios (not copied from practice tests). Current bank is original, which is correct.
- CompTIA trademarks: fine to say "CompTIA A+ study tool" but not to use their logo or imply endorsement.

---

## Gotchas / lessons learned

- **Cache-bust on every ship** or users see stale content (bump `CACHE` in `sw.js`)
- **URL path case-sensitivity** on GH Pages: `LINUX-PLUS-QUEST` (uppercase) vs `linux-plus-quest/` (lowercase subfolder) bit us once
- **Service worker + PWA:** `start_url` and `scope` MUST be relative (`"./"`) or the PWA breaks on non-root deploys
- **Inline scripts + CSP:** CSP requires `'unsafe-inline'` for script-src since everything is in one file. Acceptable tradeoff given no external deps.
- **Don't commit Visual Studio build artifacts** — `.pdb`, `.ilk`, `x64/Debug/` directories should be in `.gitignore`. Happened on the `Computer-Science` repo (5.7 MB mostly build junk)

---

## Related repos

- **[LINUX-PLUS-QUEST](https://github.com/JDJ760/LINUX-PLUS-QUEST)** — this project (flagship)
- **[Computer-Science](https://github.com/JDJ760/Computer-Science)** — CS1B coursework (needs .gitignore cleanup)
- **[Extra-Credit-CS1B](https://github.com/JDJ760/Extra-Credit-CS1B)** — CS1B extra credit
- **[JDJ760](https://github.com/JDJ760/JDJ760)** — profile README
