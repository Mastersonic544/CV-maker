# CV Maker

An autonomous, AI-powered platform for navigating the complete job search lifecycle. From intelligent role discovery and GAN-engineered resumes to headless Playwright applications and persona-driven interview simulations.

## Prerequisites
- Python 3.11+
- Node.js 18+
- Playwright (Chromium)
- Gmail account with App Password (for SMTP email applications)

## Setup

1. **Clone this repository** to your local machine.
2. **Environment Variables**: Copy `.env.example` to a new `.env` file and populate your API keys:
   - `OPENROUTER_API_KEY` — required for all LLM calls
   - `LINKEDIN_EMAIL`, `LINKEDIN_PASSWORD` — for Playwright automation
   - `SMTP_USER`, `SMTP_PASSWORD` — Gmail address and App Password for email applications
   - `APIFY_TOKEN` — optional, for LinkedIn scraping (falls back to Playwright)
3. **Profile**: Fill in your profile at `data/profile.json` — this is the source of truth for all CV generation.
4. **Backend Initialization**:
   ```bash
   python -m venv .venv
   source .venv/bin/activate  # Or .venv\Scripts\activate on Windows
   pip install -r requirements.txt
   playwright install chromium
   ```
5. **Frontend Initialization**:
   ```bash
   cd frontend
   npm install
   ```

## Run

You will need to run the backend API and the frontend UI concurrently.

**Terminal 1 (Backend - FastAPI)**
```bash
uvicorn backend.main:app --reload   # http://localhost:8000
```

**Terminal 2 (Frontend - React/Vite)**
```bash
cd frontend
npm run dev                          # http://localhost:3000
```

## Usage Lifecycle

1. **Dashboard**: Review your profile completeness score and historical application timelines.
2. **Discovery**: Let the AI interpret your profile to recommend target job roles, then scrape real LinkedIn listings.
3. **Review**: Run the GAN Generator/Discriminator loop to craft highly optimized CVs and cover letters targeted to specific hiring personas.
4. **Apply Queue**: Track automated outreach via Playwright (LinkedIn Easy Apply) and Gmail SMTP with rate limiting.
5. **Interview Simulator**: Practice with an AI that role-plays as the target company's HR persona, with inline coaching and performance scoring.

## File Structure Overview

Refer to `prd.md` for full phase requirements and data schemas. Skill workflow documentation lives in `/skills`.
