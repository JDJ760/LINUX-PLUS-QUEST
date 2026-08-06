# TechQuest — Design: from quiz engine to teaching tool

> Design map, written 2026-08-06, before implementation. Decide here, build after.
> Companions: [ROADMAP.md](ROADMAP.md) (prioritized fixes), [PROJECT_NOTES.md](PROJECT_NOTES.md) (current state).

---

## 1. The core problem

**A quiz engine assesses. It cannot teach.**

Open the Python subject with zero Python experience and you get:

> `What does [x*2 for x in range(4)] produce?`

You will get it wrong. The explanation says *"A list comprehension maps the expression
over the iterable"* — which assumes you already know what a list, an expression, an
iterable, and `range()` are. The explanation is **feedback for someone who nearly knew
it**, not instruction for someone who didn't.

That's the gap. Everything in this document follows from it.

544 questions is a good *assessment* bank. To "teach anyone," the app needs a second
content type it currently has none of: **instruction**, plus a structure that decides
what to teach next.

---

## 2. The two-audience problem

You asked for it to work for someone with no experience **and** someone rusty with real
experience. Those two need opposite things:

| | Complete beginner | Rusty experienced dev |
|---|---|---|
| Wants | Teach me, slowly, in order | Find my gaps, skip the rest |
| Needs first | Instruction | Assessment |
| Worked examples | Essential | Actively annoying |
| Wrong answer means | "I haven't learned this" | "I forgot this specific thing" |
| Failure tolerance | Must be safe to fail | Wants to be pushed |

This isn't a preference difference, it's a documented effect: **worked examples that
help novices measurably *impair* experts** (the expertise-reversal effect — experts burn
cognitive effort processing material they don't need). A single linear path cannot serve
both. Anything that tries will bore one and drown the other.

### The resolution

Three mechanisms, and they're the architectural heart of this design:

1. **A concept graph** — every teachable idea, with its prerequisites
2. **An adaptive placement diagnostic** — walks the graph to find where you actually are
3. **Per-concept mastery state** — so the same content serves both, entered at different points

Same material. Different entry point, different item mix, different pacing.

---

## 3. Proposed content model

Today there is one type: a flat `BANK` of questions tagged `(sub, lvl, d)`, where `lvl`
1–4 is hand-assigned difficulty.

Proposed three types:

```js
// A CONCEPT — one atomic teachable idea
{
  id: "py.comprehensions",
  subject: "py",
  title: "List comprehensions",
  requires: ["py.lists", "py.for-loops"],   // ← the graph
  lesson: { ... },                           // instruction
  itemIds: [...]                             // assessment bound to this concept
}
```

```js
// A LESSON — structured blocks, not an HTML blob
lesson: {
  hook: "You'll write this pattern more than almost anything else in Python.",
  blocks: [
    { t:"text",    md: "A comprehension builds a list in one line..." },
    { t:"example", src: "squares = [n*n for n in range(5)]",
                   out: "[0, 1, 4, 9, 16]",
                   note: "read it right-to-left: take each n, square it, collect" },
    { t:"faded",   src: "evens = [n for n in range(10) if ___]",
                   blank: "n % 2 == 0" },
    { t:"warn",    md: "A comprehension that spans 3 lines should be a for loop." }
  ]
}
```

```js
// An ITEM — assessment (today's questions map here, mostly unchanged)
{ id:"py.comp.001", concept:"py.comprehensions", kind:"mc"|"fill"|"multi"|"parsons"|"predict", ... }
```

`lvl` 1–4 stops being hand-assigned and becomes **derived from depth in the graph**.

### Why the graph is the highest-value piece

It's not bookkeeping. It unlocks four things nothing else can:

- **Correct teaching order** — topological sort gives a valid syllabus for free
- **Honest progress** — "you know 12 of 38 Python concepts," not "you scored 340 points"
- **Gating** — don't serve comprehensions to someone who hasn't met a for-loop
- **Root-cause remediation** — this is the one almost no study app does:

> You miss a list-comprehension item. Instead of re-drilling comprehensions, the app
> checks its prerequisites. You also miss a `for`-loop item. **The real gap is loops.**
> It teaches loops, then returns you to comprehensions.

That single behavior is worth more than a hundred extra questions.

### Sample: Python concept graph (abridged)

```
py.output ─┐
py.variables ─┬─→ py.types.{num,str,bool}
             │        ├─→ py.operators.arith
             │        └─→ py.operators.compare ─→ py.conditionals ─→ py.while
             ├─→ py.lists ─┬─→ py.indexing ─→ py.slicing
             │             └─→ py.for ─→ py.range ─┐
             │                                     ├─→ py.comprehensions
             │             py.expressions ─────────┘
             ├─→ py.dicts ─→ py.dict-methods
             └─→ py.functions.def ─→ .return ─→ .args ─→ .kwargs
                                                  └─→ py.exceptions ─→ py.files
```

~35–40 concepts covers Python fundamentals through OOP. Bash ~25. SQL ~30.

---

## 4. The two learning loops

### Beginner loop (per concept)

The progression that actually builds skill, in order:

1. **Hook** — one sentence on why this matters
2. **Worked example** — fully solved, annotated, nothing to do but read
3. **Faded example** — same shape, one piece blanked out (a *completion problem*)
4. **Parsons problem** — correct lines, scrambled; drag into order
5. **Independent item** — write/choose it yourself
6. **→ into the spaced-repetition scheduler**

Steps 3 and 4 are the bridge nearly every learning app skips. Jumping from "read an
example" to "write it yourself" is where beginners fall off. Fading is the ramp.

**Lives and the point/streak system must be OFF in this mode.** A beginner will fail
constantly — that's the process working, and "you lost a life" punishes exactly the
exploration you want. The arcade layer is fine for exam-drill mode; it's actively
counterproductive for learning.

### Rusty-expert loop

1. **Adaptive placement** (~12–15 items, ~5 minutes) — see below
2. Passed concepts → marked known, seeded into SRS at a **long** interval
3. Failed concepts → dropped into the beginner loop, but starting at step 4/5, skipping worked examples
4. Straight into mixed drilling

### The placement diagnostic

Not a linear test — a **binary search over the concept DAG**. Start mid-depth. Pass an
item → jump deeper along that branch. Fail → walk back toward prerequisites. Because a
concept's prerequisites are implied by passing it, ~12–15 well-chosen items can place
someone across 40 concepts.

This is what makes the app usable by an experienced dev without insulting them, and it
takes five minutes instead of an hour.

---

## 5. Item types to add

Current: `mc`, `fill`, `multi`. Each new type below teaches something the current three
can't.

| Type | What it looks like | Why it earns its place |
|---|---|---|
| **`parsons`** | Correct code lines, scrambled, drag to order | Best-evidenced novice-programming exercise. Teaches structure without the cognitive load of blank-page writing. |
| **`predict`** | "What does this print?" + free text | Forces mental execution — the actual skill of reading code. **Needs no runtime.** |
| **`spotbug`** | Code with one defect; click the bad line | Debugging is the daily job and is never explicitly taught. |
| **`order`** | Drag steps into sequence | Serves double duty: CompTIA PBQs *and* Parsons. Build once, use twice. |
| **`match`** | Pair ports↔protocols, methods↔purposes | High-density recall; also a CompTIA PBQ format. |
| **`cloze`** | Multi-blank code with a token bank | Between fill and free writing. |
| **`explain`** | "In your own words, why...?" self-graded against a model answer | The self-explanation effect is one of the strongest known study techniques and costs almost nothing to build. |

**The strategic point:** `parsons` + `predict` + `spotbug` deliver most of the value of
"learn to code" **without any code execution runtime.** That matters for cost — see next.

---

## 6. The code-execution fork

The biggest architectural decision. Running real code is transformative for learning a
language, and it's also the thing that would break this app's core design (single file,
no build, no deps, works offline, ~260KB).

Honest options:

| Option | Size cost | Value | Notes |
|---|---|---|---|
| **A. No runtime** | 0 | Medium-high | `predict` / `parsons` / `spotbug` get you surprisingly far |
| **B. JavaScript** | 0 | High (for JS) | Runs natively in a sandboxed Web Worker + timeout. JS isn't yet a subject though. |
| **C. SQL — sql.js** | ~1.5 MB | **Very high** | Real SQLite in WASM. SQL is *the* language where "just run the query" is how you learn. Best value per KB by far. |
| **D. Python — Pyodide** | ~7–10 MB | Very high | Real CPython. Enormous value, but 30× the app's current size. |
| **E. Bash** | Large / custom | Medium | No usable WASM shell. Would need a hand-built fake filesystem + ~20 commands. |

**Blocker to note:** the current CSP is hardened and has no `'wasm-unsafe-eval'` in
`script-src`, so **B/C/D all require loosening the CSP.** That's a deliberate security
tradeoff worth making consciously, not by accident. (`worker-src 'self'` is already
present, so Workers are fine.)

### Recommendation

**Phase 1: Option A.** Build `parsons`, `predict`, and `spotbug`. Zero runtime cost,
zero CSP change, and it validates whether the teaching loop actually works before
spending anything on infrastructure.

**Phase 2: Option C (sql.js).** Highest value-per-byte, and lazy-loaded only when the
SQL playground is opened.

**Phase 3: Option D (Pyodide), only if Phase 1 proves the loop.** Lazy-load behind an
explicit *"Load Python runtime (~7 MB)"* button, cached by the service worker, so the
offline-first promise survives for everyone who doesn't opt in.

**Skip E.** Use `predict`/`parsons` for Bash. A half-real shell teaches half-real habits.

---

## 7. Architecture changes this forces

### Split content out of `index.html` — now non-optional

Measured today: **260 KB total, 206 KB (79%) is the question bank.** Every load ships
the entire bank just to render the subject menu. Adding lessons and 5× the items puts a
single file well past 1 MB.

```
index.html          ← engine + UI only (~55 KB)
content/
  manifest.json     ← subject list, concept counts, versions
  py.json           ← concepts + lessons + items for Python
  bash.json
  sql.json
  ...
```

Load the manifest at boot; fetch a subject's content on demand; let the service worker
cache each file independently. This also means **updating one subject's questions no
longer busts the cache for the whole app** — a real quality-of-life win at this size.

Keeping the no-build philosophy is fine: plain `fetch()` of static JSON, no bundler.

### New persisted state

| Key | Shape | Purpose |
|---|---|---|
| `tq_srs` | `{[itemId]: {ease, interval, due, reps, lapses}}` | Spaced repetition |
| `tq_concept` | `{[conceptId]: {state, lastSeen, strength}}` | `unseen`/`learning`/`known` |
| `tq_profile` | `{goals, examDate, dailyNew, placedAt}` | Personalization |

⚠️ **All of this is localStorage with no backup.** The more state the app accumulates,
the worse the existing data-loss risk gets. Export/import moves up the priority list the
moment this design lands.

---

## 8. What else would make the whole app better

Beyond the ROADMAP items (spaced repetition, PBQs, objective tagging, Networking and
Security+ subjects, progress export, test suite, file split):

**Learning quality**
- **Confidence calibration** — after each answer, "sure / think so / guessed." Tracking
  confidence *against* correctness surfaces overconfidence, which is precisely what
  fails people on exams. Cheap to build, unusually high signal.
- **Error taxonomy** — on a miss, one tap: *didn't know / misread / careless / knew but blanked*.
  These need different fixes, and the app currently treats them identically.
- **Interleaving** — mixed-subject sessions beat blocked practice for transfer.
- **Self-explanation prompts** (the `explain` item type above).

**Session design**
- **Onboarding** — "What are you studying for? By when?" → generates an actual plan.
- **Time-boxed sessions** — "I have 20 minutes" builds the right queue and stops at the bell.
- **Daily goal + streak** — the habit loop that makes spaced repetition actually get used.
  This is the *right* place for gamification, unlike lives-during-learning.

**Trust and content quality**
- **Flag a question** — mark one wrong/unclear/ambiguous; the bank improves over time.
- **Personal notes per concept** — your own words beat any explanation I write.
- **Cite sources** on cert content (objective ID, doc link) so it's verifiable.

**Reach**
- **Accessibility pass** — real gap now, and non-negotiable for a tool claiming to teach
  *anyone*: focus rings, ARIA labels, contrast ratios, `prefers-reduced-motion`, and
  making drag-based items (Parsons, order, match) keyboard-operable. Drag-only would
  exclude keyboard and screen-reader users entirely.
- **Light theme.**
- **Naming** — repo is `LINUX-PLUS-QUEST` and the folder is `linux-plus-quest`, but the
  app is TechQuest with 10 subjects and Linux+ is now a minority of content. Worth
  renaming before any wider release.

**Anti-pattern to avoid**
- The current score/streak/lives system rewards *volume and speed*. Retention rewards
  *difficulty and spacing*. Where those conflict, don't let the game layer win — keep it
  in exam-drill mode and out of learn mode.

---

## 9. Effort reality — read this before picking a scope

**Engine work is roughly 20% of this. Content authoring is 80%.** Any plan that ignores
that is fiction.

To teach Python from scratch, per the model above:
- ~38 concepts × (1 lesson + 2 worked examples + 2 faded/Parsons + ~8 items)
- ≈ **38 lessons, ~76 examples, ~76 scaffolds, ~300 items** — for *one* language

The engine to run all of that is maybe a day's work. The content is not.

**Therefore: do not author three languages against an unvalidated design.**

Build the engine, author **one language end to end** (Python — highest career value for
you), then actually use it for a week. If the loop teaches, replicate to Bash and SQL
with confidence. If it doesn't, you've spent a fraction of the budget finding out.

---

## 10. Proposed phasing

| Phase | Contents | Why here |
|---|---|---|
| **0** | Split content into `content/*.json`; progress export/import; test suite in repo | Foundation + stops the data-loss risk before state grows |
| **1** | Concept graph + mastery state; SRS scheduler (SM-2); learn mode with lives/points off | The Tier-0 item, now with somewhere to live |
| **2** | New item types: `parsons`, `predict`, `spotbug`, `order`, `match` | No runtime needed; `order`/`match` also deliver CompTIA PBQs |
| **3** | **Python authored end to end** — all ~38 concepts with lessons | The validation gate. Use it for a week before continuing. |
| **4** | Placement diagnostic + adaptive routing | Needs a fully-authored subject to place *against* |
| **5** | Replicate to Bash + SQL; add sql.js playground | Only after the loop is proven |
| **6** | Networking + Security+ subjects; objective tagging; dashboard; a11y pass | Career content on a proven engine |

Phases 0–2 are engine work and largely subject-agnostic — they improve all 10 existing
subjects immediately, not just the new languages.

---

## 11. Open decisions

1. **First-build scope** — engine + Python deep (recommended), or lightweight lessons
   spread across all 10 subjects?
2. **Code execution tier** — A (no runtime) → C (sql.js) → D (Pyodide), or commit to
   real execution earlier?
3. **CSP** — willing to add `'wasm-unsafe-eval'` when WASM lands, or keep the hardened
   CSP and stay runtime-free?
4. **Naming** — rename repo/folder to TechQuest before this grows?
