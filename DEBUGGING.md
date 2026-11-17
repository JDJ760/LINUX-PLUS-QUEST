# TechQuest — Debugging Guide

How to run the app, look inside it while it runs, and track down the five most
likely kinds of breakage. Read [ARCHITECTURE.md](ARCHITECTURE.md) first.

---

## 1. Run it locally

You need Python 3 (already installed on the build machine).

From the repo root:

```bash
python -m http.server 8765 --directory linux-plus-quest
```

Open `http://localhost:8765` in Chrome or Edge. Stop the server with Ctrl+C.

**Why a server and not double-clicking the file?** Opened as `file://`, the
service worker (offline support) and install do not run, so you would be
testing a different app from the one users get.

**After editing `index.html`:** save, then reload the page. If your change does
not show up, see problem 1 below.

---

## 2. Browser dev tools in 5 minutes

Press **F12** (or right-click → Inspect). The tabs that matter:

### Console — errors, and a live command line
- Red text = a JavaScript error. It shows the message and a link like
  `index.html:3712`. Click it to jump to the exact line.
- You can type JavaScript and press Enter. Everything in the app is global, so
  you can inspect and poke it directly:

| Type this | To see |
|---|---|
| `S` | the entire game state right now |
| `S.queue[S.idx]` | the question on screen, including its answer |
| `BANK.length` | how many questions exist |
| `BANK.filter(q => q.sub==="linux").length` | questions in one subject |
| `loadStats()` | your saved per-question history |
| `getDueQuestions("linux").length` | how many are due for review |
| `cmdKey("sudo ls -al /tmp")` | how the terminal lab reads a command |
| `S.lives = 99` | give yourself lives (changes take effect on next redraw) |
| `startGame("linux", 4)` | jump straight into a mode |

### Sources — pause the code and step through it
1. Open `index.html` in the Sources tab.
2. Ctrl+F for a function, e.g. `function grade(`.
3. Click the line number. A blue marker appears: that is a **breakpoint**.
4. Answer a question in the app. Execution freezes on that line.
5. Hover over any variable to see its value. Use the step buttons:
   **Step over** (run this line), **Step into** (go inside the function call),
   **Resume** (carry on).

This is the same idea as a debugger in Visual Studio.

Shortcut: put the line `debugger;` anywhere in the code. With dev tools open,
the browser pauses there.

### Application — saved data and offline
- **Local Storage → http://localhost:8765**: every `tq_` key. You can edit or
  delete values. Delete all of them to simulate a brand-new user.
- **Service Workers**: shows the registered worker. Tick **Offline** to test
  offline mode. Click **Unregister** to remove the worker.
- **Storage → Clear site data**: wipes storage, caches and the worker at once.
  This is the "start completely fresh" button.
- **Manifest**: shows install settings and flags problems such as missing icons.

### Network — what was downloaded
Reload with this tab open. Each row is a file. Status `200` is good, `404`
means not found. Tick **Disable cache** while developing so you always get
your newest edit.

### Elements — the live page
Click the arrow icon, then click anything on the page to see its HTML and the
CSS rules applied to it. You can edit CSS here to try a change before putting
it in the file.

---

## 3. The 5 most likely ways it breaks

### Problem 1 — "I changed the code but the page looks the same"

**Why:** the browser or the service worker is showing a saved copy.

**How to find it:**
1. Network tab → reload. Look at the `Size` column for `index.html`. If it says
   `(ServiceWorker)` or `(disk cache)`, you got a saved copy.
2. Sources tab → open `index.html` → search for the text you just added. If it
   is not there, the browser has the old file.

**Fix:** Network tab → tick **Disable cache**, reload. If still stale:
Application → Storage → **Clear site data**, reload. Also confirm you saved the
file and are editing `linux-plus-quest/index.html`, not the root redirect.

### Problem 2 — A blank or frozen page after editing the question bank

**Why:** a syntax error in `BANK`. The usual causes are a missing comma between
two questions, a missing closing `}` or `]`, or a `"` inside a `"…"` string.
One syntax error stops the **whole** script, so nothing draws.

**How to find it:** Console tab. You will see something like
`Uncaught SyntaxError: Unexpected token '{'` with a line number. The real
mistake is on that line or the one just above it.

**Fix:** correct that line. To use a double quote inside a string, write `\"`
or wrap the string in single quotes or backticks instead.

**Related:** a question that loads but behaves wrongly usually has a wrong
field. Check with the Console:

```js
BANK.filter(q => !q.type && !(q.c >= 0 && q.c < q.a.length))
```

That lists multiple-choice questions whose correct index `c` is out of range.
An empty list `[]` means none.

### Problem 3 — A mode behaves like a different mode

Example: a normal game ends with an exam result, or a timer fires on the menu.

**Why:** a leftover mode flag or a timer that was never stopped. This exact bug
existed (see HANDOFF.md). It happens when a new entry point forgets to call
`resetMode()`, or a new flag is added to `S` but not cleared in `resetMode()`.

**How to find it:**
1. When the wrong screen appears, type `S` in the Console.
2. Look at `exam`, `review`, `flash`, `due`, `lab`, `examExpired`. At most one
   mode should be `true`, and it should be the one you are in.
3. Check `S.timerInterval` and `S.examClockInterval`. On a menu screen both
   should be `null`.

**Fix:** make sure the function that started this screen calls `resetMode()`
first, and that `resetMode()` clears every flag.

### Problem 4 — Progress disappeared, or stats look wrong

**Why, most likely first:**
1. Browser data was cleared, or a different browser/device/address is being
   used. Storage is separate for each address, so `localhost:8765` and the live
   site do not share progress.
2. A question's text was edited, which changed its id (`qid`). Its old history
   is still stored but no longer matches any question.
3. Storage is blocked or full. The app keeps working from memory for that
   session but nothing is saved.

**How to find it:**
1. Application → Local Storage. Are there any `tq_` keys? None means cause 1 or 3.
2. In the Console, count stored records that match no current question:

```js
const ids = new Set(BANK.map(qid)); Object.keys(loadStats()).filter(k => !ids.has(k)).length
```

   A number above 0 means cause 2.
3. Test whether saving works: `store.set("tq_test","1")` should print `true`.
   `false` means cause 3. Clean up with `store.del("tq_test")`.

**Fix:** for cause 1, IMPORT a backup from the PROGRESS screen (so export one
regularly). For cause 2, nothing is broken; the history simply restarts for
that question. For cause 3, allow site data for the address or free up space.

### Problem 5 — Install or offline stopped working

**Why:** the app is not being served over `https://` or `localhost`, a file
listed in `ASSETS` in `sw.js` is missing, or `manifest.json` has an error. If
any file in `ASSETS` returns 404, the service worker fails to install at all.

**How to find it:**
1. Application → Manifest. Warnings appear at the top (for example a missing
   icon).
2. Application → Service Workers. It should say "activated and is running". If
   it shows an error, the Console has the reason.
3. Network tab → reload → look for any `404` row.
4. Test offline: Application → Service Workers → tick **Offline** → reload.

**Fix:** make sure every file in `ASSETS` exists with exactly that name
(file names on GitHub Pages are case-sensitive), then Clear site data and
reload.

---

## 4. A debugging routine that works for almost anything

1. **Reproduce it.** Find the exact clicks that cause the problem every time.
2. **Read the Console.** A red error with a line number solves most cases.
3. **Inspect state.** Type `S` and `S.queue[S.idx]`. Is the data what you expect?
4. **Narrow it down.** Put a breakpoint (or `console.log("here", someValue)`)
   in the function you suspect. Did it run? With what values?
5. **Change one thing**, reload, test again.
6. **Check you did not break anything else:** play one full round, open
   PROGRESS, and look at the Console once more.

Use `git diff` to see exactly what you changed, and `git checkout -- <file>` to
throw away an experiment that went wrong.
