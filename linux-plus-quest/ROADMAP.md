# TechQuest — Improvement Roadmap

> Prioritized by impact on **actual learning and career outcomes**, not by ease of build.
> Written 2026-08-06. Companion to [PROJECT_NOTES.md](PROJECT_NOTES.md).

Current state: 10 subjects, 544 questions, 4 difficulty modes, exam sim, weak spots,
flashcards, bookmarks, PWA/offline.

---

## Tier 0 — The one change that matters most

### 1. Real spaced repetition (SM-2 / Leitner scheduler)

**This is the single highest-leverage upgrade in this document.** Everything else is
incremental; this changes what the app *is*.

Right now "Weak Spots" is binary — a question is either weak or it isn't. That's a
filter, not a schedule. The research on retention is unambiguous: reviewing material at
*expanding intervals* right before you'd forget it beats any amount of re-reading or
massed practice. It's why Anki works.

What to build:
- Store per question: `ease` (default 2.5), `interval` (days), `dueDate`, `reps`, `lapses`
- After each answer, ask **Again / Hard / Good / Easy** (one tap)
- Apply SM-2: correct → `interval *= ease`; wrong → reset interval, `ease -= 0.2`
- New home screen: **"42 cards due today"** across all subjects
- Cap daily new cards (~20) so it stays sustainable

Why it beats what's there now: you stop re-drilling things you already know, and
material you're about to forget resurfaces automatically. Over a semester this is the
difference between cramming and durable knowledge.

**Depends on:** nothing. `tq_stats` already tracks `seen`/`wrong`/`lastSeen`, so the
data model is half-built.

---

## Tier 1 — Closes the gap to the real exams

### 2. Performance-based questions (PBQs)

CompTIA exams open with PBQs, and they're weighted heavily. Pure multiple choice
does not prepare you for them — this is the biggest fidelity gap in the app.

Formats worth adding:
- **Drag-to-order** — put the 7 malware removal steps in sequence; order an OSI stack
- **Matching** — pair ports to protocols, tools to purposes, RAID levels to descriptions
- **Click-the-target** — given a diagram or config, click the misconfigured line
- **Terminal emulation** — "the service won't start; type the command to check status"

Start with drag-to-order and matching; both are achievable in the existing engine and
cover most of what CompTIA actually asks.

### 3. Command / syntax drill mode (recall, not recognition)

Recognizing `chmod 755` in a list of four is far easier than producing it. For Linux+
and for real work, production is the skill that matters.

Build a mode that shows a *task* and requires typing the command. The `fill` engine
already exists — extend it to accept multiple valid forms (`chmod +x` / `chmod 755`)
and to give partial credit on flags.

### 4. Map every question to an exam objective

Tag each question with its official domain (e.g. `1.2 Given a scenario, use the
appropriate Linux command...`). Then:
- Show per-domain mastery so blind spots are visible
- Weight exam-sim question selection to match CompTIA's published domain percentages
- Answer "am I ready?" with evidence instead of a vibe

This is tedious but it converts the app from a quiz into a study *plan*.

### 5. Fix the content weighting

Exam sim currently draws uniformly. Real exams don't. A+ Core 1 is ~27% hardware,
~20% networking; matching those ratios makes your practice score actually predictive.

---

## Tier 2 — Content gaps that block the career path

### 6. Networking subject — the biggest hole

There is no networking subject, and networking is the foundation of cyber. OSI vs
TCP/IP, subnetting, VLANs, routing, DNS, DHCP, NAT, common ports, Wireshark reading.
**Subnetting especially deserves a generator** that produces infinite random practice
problems rather than a fixed bank — it's a skill built by repetition.

### 7. Security+ SY0-701 — your stated next cert

CIA triad, threat actors, cryptography (symmetric/asymmetric/hashing/PKI), IAM,
network security, incident response, risk management, governance. This should be a
first-class subject before you sit the exam.

### 8. PowerShell

Pairs with A+ and with any Windows/AD security role. Cmdlet structure, pipeline,
objects vs text (the key mental shift from bash), execution policy, and its role in
both blue-team automation and red-team tradecraft.

### 9. Expand the new banks

CS1C, CS 3A, Discrete Math, Python, Bash, and SQL are 48 questions each — a solid
start, not exam-grade depth. Target 120+ each. Prioritize by what's graded soonest.

---

## Tier 3 — Protects the work

### 10. Progress export / import (do this sooner than it looks)

**All progress lives in `localStorage`.** Clearing browser data, switching devices, or
iOS evicting storage from an unused PWA wipes every stat, star, and high score with no
recovery. That's a real risk to months of study history.

Minimum: a JSON export/import button. Better: optional sync via a free tier of
Supabase or Firebase.

### 11. Automated test suite in the repo

The 544-question regression that caught the timer crash and the blank-`<iostream>`
question was written ad hoc in a browser console and thrown away. It should live in
the repo and run on every push.

Suggested: Vitest + jsdom, or a plain Node script. Assert that every question scores
correctly when answered correctly, that wrong answers never score, that `timeUp()`
survives every question type, and that no question renders blank options.

### 12. Split the single file

`index.html` is ~3,000 lines. The zero-build simplicity was the right call and still
is for the app shell — but the question bank should move to `questions.json` (or one
file per subject) loaded with `fetch`. Content and engine change for different reasons
and at different rates; they shouldn't share a file.

---

## Tier 4 — Polish

13. **Progress dashboard** — accuracy over time, streaks, per-domain heatmap, time-to-exam readiness
14. **Search** across all questions — "show me everything about DNS"
15. **Interleaved practice mode** — mix subjects in one session; interleaving beats blocked practice for transfer
16. **Explain-back prompts** — occasionally ask you to recall *why* before revealing options
17. **Light theme + accessibility pass** — contrast ratios, screen-reader labels, focus rings, `prefers-reduced-motion`
18. **Daily goal + streak** — the habit loop that makes the scheduler in #1 actually get used
19. **Question feedback button** — flag a wrong or unclear question so the bank improves over time

---

## Language learning path

Now in the app: **Python**, **Bash**, **SQL** (plus C++ from coursework).

That's deliberately the right starting three for cyber:

| Language | Why it's here |
|---|---|
| **Python** | The default language of security tooling and automation. Non-negotiable. |
| **Bash** | Every Linux box, every pipeline, every privilege-escalation writeup. Pairs with Linux+. |
| **SQL** | Injection is a top-10 web vulnerability, and analysts query data constantly. |

Suggested order after these:

1. **PowerShell** — Windows/AD is where most enterprise security work happens
2. **JavaScript** — you can't understand XSS, CSRF, or web app security without it
3. **Go** — increasingly the language security tooling is *written* in; excellent concurrency
4. **Rust or C** — for memory-safety and exploit fundamentals; C especially if you go toward
   binary exploitation or malware analysis

Don't chase breadth. Depth in Python plus real fluency in Bash will carry you further
than surface familiarity with six languages.

---

## Suggested order of attack

If you do nothing else, do these four in this order:

1. **#1 spaced repetition** — changes how well everything else sticks
2. **#10 progress export** — protects the data the scheduler depends on
3. **#6 Networking subject** — the largest content hole for a cyber career
4. **#11 test suite** — so adding content stops risking regressions

Everything else can follow opportunistically.
