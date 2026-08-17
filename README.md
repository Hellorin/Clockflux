# Clockflux

**Quality:**
[![Reliability Rating](https://sonarcloud.io/api/project_badges/measure?project=Clockflux&metric=reliability_rating)](https://sonarcloud.io/summary/new_code?id=Clockflux)
[![Security Rating](https://sonarcloud.io/api/project_badges/measure?project=Clockflux&metric=security_rating)](https://sonarcloud.io/summary/new_code?id=Clockflux)
[![Maintainability Rating](https://sonarcloud.io/api/project_badges/measure?project=Clockflux&metric=sqale_rating)](https://sonarcloud.io/summary/new_code?id=Clockflux)
[![Bugs](https://sonarcloud.io/api/project_badges/measure?project=Clockflux&metric=bugs)](https://sonarcloud.io/summary/new_code?id=Clockflux)
[![Code Smells](https://sonarcloud.io/api/project_badges/measure?project=Clockflux&metric=code_smells)](https://sonarcloud.io/summary/new_code?id=Clockflux)
[![Technical Debt](https://sonarcloud.io/api/project_badges/measure?project=Clockflux&metric=sqale_index)](https://sonarcloud.io/summary/new_code?id=Clockflux)

**Codebase:**
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=Clockflux&metric=coverage)](https://sonarcloud.io/summary/new_code?id=Clockflux)
[![Lines of Code](https://sonarcloud.io/api/project_badges/measure?project=Clockflux&metric=ncloc)](https://sonarcloud.io/summary/new_code?id=Clockflux)
[![Duplicated Lines (%)](https://sonarcloud.io/api/project_badges/measure?project=Clockflux&metric=duplicated_lines_density)](https://sonarcloud.io/summary/new_code?id=Clockflux)

A lightweight work hours tracker PWA built with React and Vite. Track your daily check-ins and check-outs, review your history, manage holiday allowance, and monitor your work/life health — all stored locally in your browser.

## Features

### Track
- **Check in / Check out** — One-tap time tracking for the current day
- **Live timer** — Real-time display of elapsed time for the active session
- **Today's summary** — Aggregated hours for all sessions in the current day, with a decimal/h:mm display toggle
- **History list** — Chronological log of past working days with total hours
- **Days off & weekend awareness** — Check-in is disabled on weekends and manually marked days off
- **Weekly progress indicator** — Current week total is highlighted in green when you're on track based on days elapsed
- **Milestone celebrations** — Confetti animation and a brief overlay card when you hit your daily (8 h) or prorated weekly target

### Calendar
- **Monthly overview** of logged days, with bulk day-off marking
- **Day edit modal** — Edit or delete individual sessions for any past day

### Holiday
- **Holiday balance card** — Days available, used, and accrued so far this year
- **Accrual modes** — Track allowance as accruing gradually through the year or available all at once
- **Prorated allowance** — Automatically adjusts for an employment start date mid-year
- **Year-end projection** — Warns if planned + used days off will exceed your annual allowance
- **Holiday chart** — Earned vs. used days off over the year

### Health
- **Health status card** — At-a-glance signal for whether your recent hours are on track, too high, or too low
- **Cumulative overtime chart** — Running total of over/under time relative to your weekly target
- **Recent weeks breakdown** — Hours vs. target for each of the last several weeks

### Platform
- **Offline-first PWA** — Installable on any device, works without internet
- **Local storage** — No backend, no account — data stays on your device
- **Landing page** — A crawlable home page shown once on a visitor's first visit, reachable afterwards from the **?** button in the header

## Tech Stack

- [React 19](https://react.dev/)
- [Vite 7](https://vite.dev/)
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (Workbox)
- [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/react) for unit/component tests

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |
| `npm run test` | Run the test suite once |
| `npm run test:watch` | Run the test suite in watch mode |
| `npm run test:coverage` | Run the test suite with coverage report |

## Code Quality

Every push and pull request to `main` runs the test suite with coverage and submits results to [SonarQube Cloud](https://sonarcloud.io/summary/new_code?id=Clockflux) (see `.github/workflows/sonarqube.yml`).

## Landing Page & SEO

The app has no server-side rendering, so the landing page is **static markup in `index.html`** rather than a React view — that is the only way the copy reaches crawlers that don't execute JavaScript. React owns visibility, not content, through three tokens: the `#landing` element, `[data-landing-dismiss]` controls, and a `data-landing` attribute on `<html>`. A missing attribute means *visible*, so any failure of the pre-paint script falls back to showing the content.

A render-blocking script in `<head>` hides the landing before first paint for anyone who has visited before, so returning visitors never see it flash. `src/hooks/useLandingPage.ts` takes over from there.

`index.html` also carries the meta description, canonical link and `WebApplication` JSON-LD, all pointing at the production domain `https://clockflux.app/`. The same URL appears in `public/robots.txt` and `public/sitemap.xml`; `src/test/indexHtml.test.ts` fails if they drift apart.

## Data Storage

All session data is persisted in `localStorage` under the key `app`. Whether a visitor has seen the landing page is recorded separately under `appVisited`. No data is sent to any server.
