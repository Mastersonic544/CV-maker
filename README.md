# CV Maker

**CV Maker** is a local, AI-powered platform that automates the full job-search lifecycle — from intelligent role discovery and adversarially-optimized resumes to headless application submission and persona-driven interview practice.

Everything runs on your machine. All state is stored as local JSON files — **there is no database and no cloud backend**. Your profile data never leaves your computer except when calling the LLM/scraping APIs you configure.

---

## ✨ Features

- **Multi-user profiles** — multiple isolated local users, each with their own encrypted API keys and data directory.
- **AI onboarding** — paste a free-text "data dump" (or your resume text) and an LLM extracts a structured profile for you.
- **Role discovery** — the LLM reads your profile and suggests target roles, then real LinkedIn listings are scraped via Playwright.
- **Hiring-persona research** — each job posting is analyzed to synthesize the HR persona you're really writing for.
- **GAN-style CV/cover-letter generation** — a Generator LLM and a Discriminator LLM (role-playing as HR) iterate until the document scores above a quality threshold, then render to PDF.
- **Quick CV** — generate a tailored CV straight from the Dashboard with just a role title (and optional job description) — no scraping, no targets, no Discovery round-trip. Leave the description blank and the AI auto-drafts an ideal, domain-correct posting from the title for sharper tailoring. Saved Quick CVs can be previewed, reordered (up/down), and deleted inline.
- **Harvard-style resume** — one-click generation of a classic, ATS-friendly [Harvard resume](https://careerservices.fas.harvard.edu/) (single-column, black-and-white) built deterministically from your profile data — no job or LLM required — with clean page-break handling so entries never split across pages.
- **Automated applying** — submit via LinkedIn Easy Apply (Playwright) or Gmail SMTP email, with built-in daily rate limiting and randomized delays.
- **Interview simulator** — chat with an AI that role-plays the target company's HR persona, with an inline coaching overlay and post-session scoring.
- **Encrypted secrets** — per-user API keys are stored encrypted at rest (Fernet / AES-128 + HMAC).

---

## 🏗️ Architecture

```
Profile (JSON)
   │
   ▼  Discovery        LLM suggests roles → Playwright scrapes LinkedIn → targets.json
   │
   ▼  Research         Job text → LLM synthesizes a HiringPersona
   │
   ▼  Generation       Generator LLM ⟷ Discriminator LLM (HR) loop → cv.json + cv.pdf
   │
   ▼  Apply            Playwright Easy Apply  OR  Gmail SMTP → history.json
   │
   ▼  Interview        LLM role-plays HR persona → transcript scored & saved
```

**Backend** — FastAPI + Pydantic v2 (Python 3.11+). Thin routers delegate to a service layer; all reads/writes go through an atomic JSON store. LLM calls go through a single OpenRouter (OpenAI-compatible) entry point, with mock fallbacks when no API key is set. CV/cover-letter PDFs are rendered with Playwright Chromium from inline Jinja2 templates.

**Frontend** — React + Vite + Tailwind CSS + React Router. No global store; each page fetches its own data via a single API client. Dark/light theming and inline i18n are provided via React contexts.

**Storage** — Local JSON under `data/users/{user_id}/` (profiles, targets, history, applications, interview sessions), plus per-user Fernet-encrypted `api_keys.enc`. A `master.key` is auto-generated on first run and must never be shared.

---

## 🧰 Tech Stack

| Layer    | Technologies |
|----------|--------------|
| Backend  | FastAPI, Uvicorn, Pydantic v2, httpx, Jinja2, cryptography |
| Scraping / automation | Playwright (Chromium), BeautifulSoup, Apify client (optional) |
| LLM      | OpenRouter (OpenAI-compatible API) |
| Frontend | React 18, Vite, Tailwind CSS, React Router, Framer Motion, Lucide |
| Storage  | Local JSON files (no database) |

---

## 📋 Prerequisites

- **Python** 3.11+
- **Node.js** 18+
- **Playwright** Chromium (installed in the setup steps below)
- An **OpenRouter API key** (required for real LLM output; the app falls back to mock data without one)
- *Optional:* a **Gmail account with an App Password** for email applications, and **LinkedIn credentials** for Easy Apply automation

---

## 🚀 Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Mastersonic544/CV-maker.git
   cd CV-maker
   ```

2. **Configure environment variables** — copy the example and fill in your keys:
   ```bash
   cp .env.example .env
   ```
   See [Environment Variables](#-environment-variables) below. Only `OPENROUTER_API_KEY` is needed to get started — the rest unlock optional features. Keys can also be added later, per-user, from the in-app **Setup APIs** screen.

3. **Backend** (a virtual environment is recommended):
   ```bash
   python -m venv .venv
   source .venv/bin/activate        # Windows: .venv\Scripts\activate
   pip install -r requirements.txt
   playwright install chromium
   ```

4. **Frontend**:
   ```bash
   cd frontend
   npm install
   ```

> On first run, the app auto-creates the `data/` structure and a default user. There is no manual `profile.json` to edit — use the in-app onboarding/profile screens instead.

---

## ▶️ Running

Run the backend and frontend concurrently in two terminals.

**Terminal 1 — Backend (FastAPI)**
```bash
uvicorn backend.main:app --reload      # http://localhost:8000
```
Interactive API docs are served at **http://localhost:8000/docs**.

**Terminal 2 — Frontend (React/Vite)**
```bash
cd frontend
npm run dev                            # http://localhost:3000
```

The frontend is fixed to port **3000**, which is the only origin allowed by the backend CORS policy. Open **http://localhost:3000** to start.

---

## 🔑 Environment Variables

| Variable | Required | Purpose |
|----------|:--------:|---------|
| `OPENROUTER_API_KEY` | ✅ | All LLM calls (role suggestions, persona, CV/cover-letter, interview). Without it, the app returns mock responses. |
| `LINKEDIN_EMAIL` / `LINKEDIN_PASSWORD` | ⛔️ optional | LinkedIn Easy Apply automation and DMs via Playwright. |
| `SMTP_USER` / `SMTP_PASSWORD` | ⛔️ optional | Gmail address + **App Password** for sending email applications with PDF attachments. |
| `SENDER_NAME` | ⛔️ optional | Display name used on outgoing application emails. |
| `APIFY_TOKEN` | ⛔️ optional | Alternative LinkedIn scraping path (falls back to Playwright/mock data if unset). |
| `DATA_DIR` | ⛔️ optional | Override the default `./data` storage location. |
| `GROQ_API_KEY` | ⛔️ legacy | Unused; retained for backward compatibility. |

> Keys set via the in-app **Setup APIs** screen are stored **encrypted per-user**. Values in `.env` act as a global fallback.

---

## 🧭 Usage Lifecycle

1. **Profile Selector / Onboarding** — create or pick a user. New users can paste a free-text dump and let the LLM build a structured profile.
2. **Dashboard** — review your profile completeness score and application history. From here you can also:
   - **Quick CV** — enter a role title (and optionally paste a job description, or leave it blank to let the AI draft one) to instantly generate a tailored CV from your profile.
   - **Generate Resume** — produce a Harvard-format resume from your profile in one click. Saved documents are listed below, where they can be previewed full-screen, downloaded, and reordered.
3. **Discovery** — get AI role suggestions, then scrape real LinkedIn listings into your target list.
4. **Review** — run the GAN Generator/Discriminator loop to produce a tailored CV + cover letter, watch progress stream live, then preview/edit before exporting to PDF.
5. **Apply Queue** — submit applications sequentially via Easy Apply or Gmail SMTP, with daily limits and randomized delays.
6. **Interview Simulator** — practice against the target company's HR persona with live coaching and a final performance score.

---

## ⚙️ Configuration & Tuning

Behavioral constants live in [`backend/config.py`](backend/config.py):

| Setting | Default | Meaning |
|---------|:-------:|---------|
| `MAX_GAN_ITERATIONS` | `2` | Max Generator/Discriminator rounds per document |
| `MIN_CV_SCORE` | `7.5` | Target quality score (out of 10) the loop aims to beat |
| `MAX_DAILY_APPLICATIONS` | `20` | Hard daily cap on submitted applications |
| `MIN/MAX_APPLY_DELAY_SECONDS` | `10` / `45` | Randomized delay between applications |
| `OPENROUTER_MODEL` | `openrouter/auto` | Model routed by OpenRouter |
| `LLM_MAX_RETRIES` | `3` | Retry attempts on LLM call failure |

All system prompts are external text files in [`backend/prompts/`](backend/prompts/) — edit those to change AI behavior without touching Python.

---

## 🗂️ Project Structure

```
backend/
  main.py              # FastAPI app, CORS, router mounting, startup migration
  config.py            # Settings: paths, API keys, behavioral constants
  models/schemas.py    # All Pydantic v2 schemas
  routers/             # HTTP layer: users, profile, discovery, generation,
                       #             apply, history, interview
  services/            # Business logic: LLM, CV/GAN loop, scraping, email,
                       #             Playwright, encryption, interview, users
  storage/json_store.py# Atomic JSON read/write helpers
  prompts/*.txt        # External LLM system prompts
frontend/
  src/pages/           # Landing, ProfileSelector, Onboarding, Dashboard,
                       #   Discovery, Review, Apply, Interview, SetupApis, ...
  src/components/       # CVPreview, CVEditorModal, ChatWindow, HelpOverlay, ...
  src/contexts/        # Theme + i18n
  src/api/client.js    # Single API client
tests/                 # pytest suite (mocks all external APIs)
umls/                  # PlantUML architecture & per-phase diagrams
data/                  # Local state (git-ignored; created at runtime)
```

---

## 🧪 Testing

Tests mock all LLM/scraping/email calls — they never hit live APIs.

```bash
pytest tests/                              # all tests
pytest tests/test_cv_service.py -v         # one file
pytest tests/test_discovery.py -v          # discovery flow
```

---

## 🔌 API Overview

All endpoints are mounted under `/api` (full schema at `/docs`):

| Prefix | Responsibility |
|--------|----------------|
| `/api/users` | User CRUD, active-user switching, encrypted API keys, onboarding |
| `/api/profile` | Profile read/update/completeness |
| `/api/discovery` | Role suggestions, LinkedIn scraping, target management |
| `/api/generation` | CV/cover-letter generation with SSE progress streaming; Quick CV (`/quick/*`) and Harvard resume (`/resume/*`) generation, listing, and reordering |
| `/api/apply` | Sequential application execution with rate limiting |
| `/api/history` | Application history |
| `/api/interview` | Interview session start/message/help/end |

---

## 🔒 Data & Privacy

- All personal data lives under `data/` and is **git-ignored** — it is never committed.
- Per-user API keys are encrypted at rest with a locally generated `master.key`. **Never commit or share `master.key` or `data/`.** If `master.key` is lost, stored keys become unrecoverable.
- LLM, scraping, and email features send the relevant data to the third-party services you configure (OpenRouter, Apify, Gmail, LinkedIn). Review their terms before use, and use automation responsibly and in line with each platform's policies.

---

## 📐 Diagrams

PlantUML sources for the system and each lifecycle phase live in [`umls/`](umls/) — including the class diagram, AI process flow, and use cases.
