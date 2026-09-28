# CovrIQ — AI Sports Betting Intelligence & Mathematical Handicapping

CovrIQ is a production-ready, full-stack AI sports betting intelligence and handicapping platform built with React (Vite), Node.js/Express, PostgreSQL (Prisma ORM), and OpenAI Responses API with real-time web search capabilities.

---

## 🌟 Key Highlights & Architecture

- **Zero Third-Party Sports APIs Required**: CovrIQ dynamically fetches real-time starting lineups, injury reports, odds lines, weather, and matchup conditions on-demand using OpenAI's reasoning engine with built-in Web Search at request time.
- **Immediate Full-Screen AI Chat Workspace**: No traditional landing page barrier. Visiting `/` immediately opens the conversational sports intelligence workspace. Unauthenticated visitors can analyze fixtures immediately; logging in unlocks persistent history and synced saved picks.
- **Mathematical Precision Engine**: Exact formulas for converting American odds, Decimal odds, Implied Probability %, Betting Edge %, and Expected Value (EV%).
- **Interactive Visual Cards**:
  - `[Game Header]`: Sport badge, Matchup, scheduled slot, league.
  - `[Market Card]`: American/Decimal odds, Implied % vs AI Model Win %, Betting Edge %, and Expected Value (EV%).
  - `[Why I Like It]`: Key statistical edges & tactical advantages.
  - `[Matchup & Current Info]`: Confirmed starting pitchers/goalies/lineups, inactives, weather/dome factors, and recent form.
  - `[Value & Contrarian Analysis]`: Public betting bias vs sharp market value.
  - `[Risks & Why NOT to Bet]`: Honest counter-arguments and variance risks.
  - `[Final Verdict Badge]`: Visual badges (`BET`, `LEAN`, `PASS`, `AVOID`) with confidence score & unit recommendations.
  - `[Clickable Sources Section]`: Verified external citations directly from live web search.
- **Discover Modes**:
  - `AI Picks`: High-confidence mathematical edges
  - `Value Finder`: Mispriced market discrepancies
  - `Upset Finder`: High-value live underdogs
  - `Compare Bets`: Head-to-head comparison
  - `Parlay Lab`: Correlated multi-leg builder with compound odds math
  - `Deep Analysis`: Advanced regression, rest, and weather modeling
- **Interactive Odds Calculator & Parlay Tool**: Built-in modal for calculating single bets, multi-leg parlays, and EV modeling.
- **Email & Auth**: Custom session/JWT auth with bcrypt hashing + Brevo transactional email API for 6-digit OTP password resets.
- **Design Aesthetic**: Deep charcoal near-black dark mode (primary) with crisp light mode switch. AI responses formatted with Claude-inspired serif typography (`"Anthropic Serif", Georgia, "Times New Roman", serif`).

---

## 🚀 Quick Start

### 1. Prerequisites
- Node.js 18+ (tested on Node v22)
- PostgreSQL (or use the built-in resilient local persistence mode)

### 2. Environment Setup
Configure your environment in `server/.env`:
```env
PORT=5000
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/covriq?schema=public"
JWT_SECRET="covriq_super_secure_jwt_secret_key_2026_sports_ai"
OPENAI_API_KEY="sk-..."       # OpenAI API key (gpt-5.6 with web search)
OPENAI_MODEL="gpt-5.6"
BREVO_API_KEY=""              # Optional: Brevo API key for OTP emails
```

### 3. Run Development Servers
Start both backend (port 5000) and frontend (port 5173) simultaneously:
```bash
npm run dev
```

Or run individually:
```bash
npm run dev:server   # Express API & AI streaming
npm run dev:client   # React / Vite UI
```

### 4. Run Unit Tests
Validate mathematical odds conversions, probabilities, and EV calculations:
```bash
npm run test:server
```

---

## 📐 Mathematical Formulas

- **Positive American to Decimal**: $\text{Decimal} = 1 + \left(\frac{\text{American}}{100}\right)$
- **Negative American to Decimal**: $\text{Decimal} = 1 + \left(\frac{100}{|\text{American}|}\right)$
- **Positive Implied Probability**: $\text{Implied \%} = \frac{100}{\text{American} + 100} \times 100$
- **Negative Implied Probability**: $\text{Implied \%} = \frac{|\text{American}|}{|\text{American}| + 100} \times 100$
- **Decimal Implied Probability**: $\text{Implied \%} = \frac{1}{\text{Decimal}} \times 100$
- **Expected Value (EV)**: $\text{EV \%} = \left(\text{WinProbability} \times \text{DecimalOdds} - 1\right) \times 100$
- **Betting Edge**: $\text{Edge \%} = \text{AI Model Probability \%} - \text{Market Implied Probability \%}$

---

## 🗄️ Database Schema (Prisma)

- `User`: User identity, password hash, email, and preferences.
- `Conversation`: Chat sessions with auto-generated contextual titles.
- `Message`: Chat logs, roles, models, and JSONB structured response metadata.
- `SavedItem`: Bookmarked picks and analysis cards.
- `UserPreference`: Theme, odds display format, and typography choices.
- `AiResearchLog`: Live web search query logs and citation URLs.

---

## ☕ Support CovrIQ
CovrIQ is 100% free for launch with zero paywalls. Support ongoing development on Buy Me a Coffee via the sidebar button.
