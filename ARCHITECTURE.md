# TechQuest — Architecture

A plain-English tour of how the app works. Written for someone who knows basic
C++ and has not done web development.

To find any function named here, open `linux-plus-quest/index.html` and search
(Ctrl+F) for `function name(`.

---

## 1. The 60-second version

TechQuest is **one web page**. There is no server-side code, no database, no
framework and no build step. The browser downloads one file, and that file
contains everything:

- **HTML** — the skeleton of the page (a header, an empty `<main>` box, a footer)
- **CSS** — the look (colours, spacing, layout)
- **JavaScript** — the logic, plus all the questions as one big array

The JavaScript works like a small state machine:

1. There is one global object, `S`, holding the current game state.
2. Each screen is a function that **rewrites the inside of `<main>`**.
3. Clicking something runs a function that changes `S`, then draws again.

Your progress is saved in the browser's own storage (`localStorage`), so there
are no accounts and nothing leaves your device.

---

## 2. Files

```
repo root
├── index.html              redirect to ./linux-plus-quest/ (21 lines)
├── ARCHITECTURE.md         this file
├── DEBUGGING.md            how to run it, inspect it and fix it
├── HANDOFF.md              session notes: what changed, what's next
└── linux-plus-quest/
    ├── index.html          THE APP (CSS + HTML + question bank + engine)
    ├── sw.js               service worker: makes the app work offline
    ├── manifest.json       install settings (name, colours, icons)
    ├── icon-192.png        app icons used when installed
    ├── icon-512.png
    └── *.md                older notes and roadmap
```

### Inside `linux-plus-quest/index.html`

| Part | What it is |
|---|---|
| `<style> … </style>` | All CSS. Colours are variables at the top (`--green`, `--dim`, …). |
| `<body>` | About 15 lines of fixed HTML: header, HUD, `<main id="main">`, footer. |
| `const BANK = [ … ]` | Every question. About 2,600 lines. This is data, not logic. |
| `MODES`, `SUBS`, `SUB_ORDER` | Settings: difficulty levels and subjects. |
| `S` | The game state object. |
| Everything after | The engine: about 1,200 lines of functions. |

---

## 3. The diagram

```
                         ┌──────────────────────────┐
   page loads  ────────► │  showSubjectSelect()     │◄──────────────┐
                         │  home: subject cards     │               │
                         └───────┬──────────┬───────┘               │
                                 │          │ PROGRESS button       │
                                 │          ▼                       │
                                 │   ┌──────────────────┐           │
                                 │   │ showDashboard()  │           │
                                 │   │ export / import  │           │
                                 │   └──────────────────┘           │
                                 ▼                                  │
                         ┌──────────────────────────┐               │
                         │ showDifficultySelect(sub)│◄──────┐       │
                         │ mode cards for 1 subject │       │       │
                         └───────────┬──────────────┘       │       │
                                     │ pick a mode          │       │
        ┌──────────┬─────────┬───────┼────────┬─────────┬───┴────┐  │
        ▼          ▼         ▼       ▼        ▼         ▼        │  │
   startGame  startExam  startDue startReview startLab startStarred │
        │          │         │       │        │         │        │  │
        └──────────┴─────────┴───┬───┴────────┴─────────┘        │  │
           each one: resetMode() │ fill S.queue, reset S         │  │
                                 ▼                               │  │
                         ┌──────────────────────────┐            │  │
                  ┌────► │ renderQ()                │            │  │
                  │      │ draw S.queue[S.idx]      │            │  │
                  │      └───────────┬──────────────┘            │  │
                  │                  │ user answers              │  │
                  │      ┌───────────┴───────────────────┐       │  │
                  │      ▼          ▼          ▼         ▼       │  │
                  │    pick()  pickMulti()  pickFill()  renderCmd()  │
                  │      └───────────┬───────────────────┘       │  │
                  │                  ▼                           │  │
                  │      ┌──────────────────────────┐            │  │
                  │      │ grade(q, correct, text)  │            │  │
                  │      │  recordStat() ──► storage│            │  │
                  │      │  score, streak, lives    │            │  │
                  │      │  show explanation        │            │  │
                  │      └───────────┬──────────────┘            │  │
                  │                  ▼                           │  │
                  │            showNext()  (NEXT button)         │  │
                  │                  │ S.idx++                   │  │
                  └──────────────────┘                           │  │
                     when out of lives or questions:             │  │
                         ┌──────────────────────────┐   RETRY    │  │
                         │ gameOver()               │────────────┘  │
                         │ rank, high score         │   CHANGE      │
                         └──────────────────────────┴───────────────┘

   startFlashcards() ──► renderFlashcard()   (separate loop, no grading)
```

---

## 4. The key ideas, one at a time

### 4.1 A question is a plain object

Like a C++ `struct`, but written inline. Fields:

| Field | Meaning |
|---|---|
| `sub` | subject key, e.g. `"linux"`. Must exist in `SUBS`. |
| `lvl` | difficulty 1–4 |
| `d` | topic label shown as a tag, also used by the dashboard |
| `q` | the question text |
| `e` | the explanation shown after answering |
| `type` | omitted for multiple choice, or `"fill"`, `"multi"`, `"cmd"` |

Type-specific fields:

| Type | Extra fields |
|---|---|
| multiple choice | `a` (array of 4 options), `c` (index of the right one) |
| `"fill"` | `answers` (array of accepted strings) |
| `"multi"` | `a` (options), `correct` (array of right indexes) |
| `"cmd"` | `steps` (array of `{ask, accept, out, hint}`) |

`BANK` is an array of these, like `std::vector<Question>`. Getting the Linux
level-2 questions is one line: `BANK.filter(q => q.sub==="linux" && q.lvl===2)`.

### 4.2 `S` is the whole game state

One global object. The important fields:

| Field | Meaning |
|---|---|
| `S.sub`, `S.lvl` | current subject and level |
| `S.mode` | settings for this run: lives, points per question, timer seconds |
| `S.queue` | the list of questions for this run |
| `S.idx` | which question you are on (an index into `S.queue`) |
| `S.score`, `S.correct`, `S.streak`, `S.lives` | running totals |
| `S.answered` | has the current question been answered yet? |
| `S.exam`, `S.review`, `S.flash`, `S.due`, `S.lab` | which special mode is active |

**Rule:** every `start…` function calls `resetMode()` first, which turns all
the mode flags off and stops all timers. Then it sets the one flag it needs.

### 4.3 Screens are drawn by replacing HTML

`$("main").innerHTML = "…"` throws away what is inside `<main>` and replaces it
with new HTML built from a string. `$` is just a short name for
`document.getElementById`.

After the HTML is in place, the function attaches click handlers:
`$("some-id").addEventListener("click", someFunction)`.

Because the old HTML is thrown away, its buttons and handlers vanish with it.
That is why every screen function sets up its own handlers again.

### 4.4 Text is escaped before it becomes HTML

`esc()` turns `<` into `&lt;` and so on. Without it, a question containing
`<iostream>` would be read by the browser as an HTML tag and disappear. It is
also the defence against script injection. **Every question field goes through
`esc()`.**

### 4.5 Answers are shuffled by index

In the bank, the correct option is `q.a[q.c]`. On
screen the options are shuffled. `renderQ()` shuffles a list of *indexes* such
as `[2,0,3,1]` and remembers where the right one landed. See the comment above
that code for a worked example.

### 4.6 Grading goes through one function

`pick()`, `pickMulti()`, `pickFill()` and `renderCmd()` each decide whether the
answer was right. Then they all call `grade()`, which is the only place that
changes score, streak and lives, saves stats, and shows the explanation.

### 4.7 Saving: `store` and the `tq_` keys

`localStorage` is a small key→string table the browser keeps per website. It
can throw errors (blocked or full), so the app never touches it directly. It
uses the `store` object, which catches those errors.

| Key | Holds |
|---|---|
| `tq_stats` | per-question history: `{id: {seen, wrong, lastSeen, lastMissed, box, due}}` |
| `tq_starred` | bookmarked question ids |
| `tq_meta` | XP, day streak |
| `tq_<sub>_<lvl>` | high score for that subject and level |

Objects are saved as JSON text (`JSON.stringify`) and read back with
`JSON.parse`.

### 4.8 A question's id is a hash of its text

`qid(q)` turns `q.q + sub + lvl` into a short code. Stats are stored under that
code. This survives reordering the bank. The cost: editing a question's text
gives it a new id and its history starts over.

### 4.9 Spaced repetition

Each answered question has a `box` from 0 to 5. Right → up one box. Wrong →
back to box 0. `BOX_DAYS = [0,1,3,7,14,30]` gives the days until it is due
again. `getDueQuestions()` returns everything whose due date has passed, and
`startDue()` runs a session of up to 20.

### 4.10 Terminal lab

`cmdKey()` reduces a typed command to a comparable form (optional `sudo`
removed, flags sorted, `-la` split into `l` and `a`). `cmdMatch()` compares
that with each accepted command. Nothing is really executed.

### 4.11 Offline: the service worker

`sw.js` runs in the background, separate from the page. It intercepts every
file request. Online, it fetches the newest file and saves a copy. Offline, it
returns the saved copy. `manifest.json` and the icons are what let a browser
offer "Install".

---

## 5. How to make common changes

| I want to… | Do this |
|---|---|
| Add a question | Add an object to `BANK`, before `]; // end BANK`. |
| Add a subject | Add a key to `SUBS`, add it to `SUB_ORDER`, add questions with that `sub`. |
| Change lives, points or timer | Edit the matching row in `MODES`. |
| Change review gaps | Edit `BOX_DAYS`. |
| Add a terminal task | Add a `type:"cmd"` object with `steps`. Copy an existing one. |
| Change a colour | Edit the variables in `:root` at the top of `<style>`. |
| Add a new mode | Write a `start…` function that calls `resetMode()` first. If it needs a new flag on `S`, also clear that flag inside `resetMode()`. |

After any change: reload the page, open the Console (F12), check for red errors.
