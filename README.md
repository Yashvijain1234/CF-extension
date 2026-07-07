# ⚡ Codeforces LeetMode

A production-ready Chrome extension (Manifest V3) that transforms the Codeforces
problem-solving experience into a modern, **LeetCode-inspired** UI — without ever
breaking Codeforces itself.

Open any problem, hit **✨ Open in Better UI**, and get a premium split-screen
workspace: a beautifully typeset statement on the left and a Monaco editor with
submit, tests, notes, timer, AI hints, submission history and GitHub sync on the
right.

---

## ✨ Features

| Area | What you get |
| --- | --- |
| **Problem detection** | Auto-detects `problemset`, `contest`, and `gym` problem pages and injects a themed floating button (also `Alt+O`). |
| **Structured parser** | Parses the page into clean JSON (`title, rating, tags, limits, statement, samples, images, formulas, constraints`) — never raw HTML injection. |
| **Premium UI** | Sticky title, difficulty badge, tags, limits, gorgeous typography, KaTeX math, collapsible sections, sample cards with copy buttons, light/dark themes. |
| **Monaco editor** | C++, Java, Python, Kotlin, Rust, Go, JavaScript, C#. Autosave per language, font-size & theme controls, starter templates. |
| **Submit** | Submits through your existing logged-in Codeforces session (CSRF handled automatically), polls the verdict, and shows Accepted / WA / RE / TLE / MLE / CE in a clean UI — no page switching. |
| **Run tests** | Custom input, expected vs actual comparison, and a diff viewer. Local JavaScript execution in a sandboxed worker. |
| **Notes** | One markdown note per problem, live preview, autosave. |
| **Timer** | Auto-start, pause, reset, persisted elapsed time. |
| **AI hints** | First/Next hint, Explain Editorial, Explain My Code, Find Bug, Time/Space Complexity. Pluggable providers (OpenAI, Anthropic, Gemini, custom). |
| **Submissions** | Previous submissions with verdict, runtime, memory, language and date (via the Codeforces API). |
| **Progress** | Mark Solved / Revision / Favorite / Starred, stored locally. |
| **Shortcuts** | `Ctrl+Enter` Submit · `Ctrl+S` Save · `Ctrl+B` Notes · `Ctrl+J` Custom Input. |
| **GitHub (LeetHub-style)** | On an Accepted verdict, prompt to push `solution.ext` + `README.md` into `Codeforces/<id>_<slug>/`. Auto-upload, duplicate handling (update / keep history / skip), repo selection/creation, branch config. |

---

## 🧱 Tech stack

- **Manifest V3** Chrome extension
- **React 18** + **JavaScript (JSX)**
- **Vite** + **@crxjs/vite-plugin**
- **Tailwind CSS** (preflight disabled + scoped, so nothing leaks into Codeforces)
- **Monaco Editor** (bundled locally — no CDN, CSP-safe)
- **KaTeX** for math, **react-markdown** for notes/AI output
- **Chrome Storage API**, Content Scripts, Background Service Worker

---

## 📂 Project structure

```
src/
  api/          # language configuration (Monaco ids, CF program-type ids, templates)
  background/   # MV3 service worker – message router for GitHub + AI
  content/      # content script entry (detection + FAB) and overlay mount
  editor/       # Monaco bootstrap (workers, loader)
  github/       # reusable GitHub layer: REST client, README builder, push service
  hooks/        # React hooks (settings, problem data, timer, submission, shortcuts, theme)
  options/      # settings page (React)
  parser/       # Codeforces DOM → structured JSON parser
  popup/        # toolbar popup (React)
  services/     # codeforces submission service, difficulty, messaging, ai/
  storage/      # chrome.storage wrappers
  styles/       # global (scoped) Tailwind + theme tokens
  types/        # shared constants + JSDoc-documented data shapes
  ui/           # the Better UI React app + components
manifest.config.js
vite.config.js
```

Business logic (parser, services, storage, github) is kept fully separate from the
React UI so it can be reused and tested independently.

---

## 🚀 Installation (from source)

Requirements: **Node 18+** and npm.

```bash
# 1. Install dependencies
npm install

# 2. Build the extension
npm run build      # outputs to dist/
```

Then load it in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the generated **`dist/`** folder.
4. Visit any Codeforces problem (e.g. `https://codeforces.com/problemset/problem/71/A`).
5. Make sure you're **logged in to Codeforces**, then click **✨ Open in Better UI**.

### Development with hot reload

```bash
npm run dev
```

Load the `dist/` folder as unpacked; @crxjs will hot-reload on changes.

---

## ⚙️ Configuration

Open the extension **Settings** (popup → ⚙, or the ⚙ button in the overlay).

### GitHub

The most reliable method is a **fine-grained Personal Access Token** with
`Contents: Read and write` on the target repository:

1. GitHub → Settings → Developer settings → Fine-grained tokens → Generate.
2. Paste it into **Settings → GitHub → Connect with Token**.
3. Select or create a repository, set the branch, and toggle auto-upload.

**OAuth:** GitHub's web flow requires a client secret for the token exchange,
which cannot ship inside a public extension. To enable the "Connect with OAuth"
button, set `OAUTH_CONFIG.clientId` and `OAUTH_CONFIG.tokenExchangeUrl`
(a tiny backend that exchanges `code` → `access_token`) in
`src/github/service.js`. The `chrome.identity` redirect is already wired up.

### AI provider

**Settings → AI Hints**: choose OpenAI / Anthropic / Gemini / Custom, add your
API key and model. Requests are made from the background worker so your key never
touches the Codeforces page. Adding a new provider is a single entry in
`src/services/ai/providers.js`.

---

## 🔒 How submission works (and why it's safe)

The submit flow runs **inside the content script on `codeforces.com`**, so every
request is same-origin and automatically carries your existing session cookies —
exactly as if you clicked *Submit* on the real site. The extension:

1. Fetches the submit page and extracts the CSRF token.
2. POSTs the source with the correct `programTypeId` to the official endpoint.
3. Polls `api/user.status` until the verdict is final.

No credentials are ever collected, stored, or sent anywhere except Codeforces.

---

## 🧭 Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server with HMR (load `dist/` unpacked). |
| `npm run build` | Production build to `dist/`. |
| `npm run lint` / `lint:fix` | ESLint. |
| `npm run format` | Prettier. |

---

## 🗺️ Extending

- **New language** → add an entry to `src/api/languages.js` (Monaco id + CF `cfId` + template).
- **New AI provider** → add an adapter in `src/services/ai/providers.js`.
- **New GitHub behavior** → the `src/github/` service is fully reusable.
- **New panel** → drop a component in `src/ui/components/` and register a tab in `src/ui/App.jsx`.

---

## ⚠️ Notes & limitations

- Codeforces' internal `programTypeId`s occasionally change; they are centralized
  in `src/api/languages.js` for one-line updates.
- Local execution in **Run tests** is supported for JavaScript only (compiled
  languages must be judged remotely — use **Submit**).
- The extension only ever talks to `codeforces.com`, `api.github.com`, and your
  configured AI endpoint.

---

## 📜 License

MIT.
