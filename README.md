<div align="center">

# 🛤️ LifePaths.work

**A visual timeline tool for planning and tracking your life goals.**

Map out goals, break them into subtasks, drop in milestones, and watch your progress along an interactive timeline — with an AI strategist to help you plan.

🔗 **[Try it live → lifepaths.work](https://lifepaths.work/)**

<img src="docs/images/high-res-demo.gif" alt="LifePaths.work demo" width="100%" />

</div>

## ✨ Features

- **Interactive timeline** — drag to move, resize, and reschedule goals and subtasks
- **Goals & subtasks** — break big goals into manageable steps
- **Milestones** — mark key moments, both per-goal and across your whole timeline
- **AI strategist** — get AI-generated suggestions to plan and break down goals
- **Accounts & sync** — sign up, log in, and keep your data saved across sessions
- **Gamification** — earn XP and level up as you make progress

## 🧱 Tech Stack

**Frontend**
- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) — build tool & dev server
- [Tailwind CSS](https://tailwindcss.com/) — styling
- [Radix UI](https://www.radix-ui.com/) + shadcn/ui — accessible component primitives
- [react-dnd](https://react-dnd.github.io/react-dnd/) — drag-and-drop timeline interactions
- [Motion](https://motion.dev/) — animations
- [Recharts](https://recharts.org/) — data visualization
- [Lucide](https://lucide.dev/) — icons

**Backend** (Cloudflare)
- [Cloudflare Workers](https://workers.cloudflare.com/) — serverless API (`lifepath-api`)
- [Cloudflare D1](https://developers.cloudflare.com/d1/) — SQLite database
- [Workers AI](https://developers.cloudflare.com/workers-ai/) — AI goal suggestions
- JWT-based authentication

## 🚀 Running Locally

### Frontend

```bash
npm i           # install dependencies
cp .env.example .env   # add your env values
npm run dev     # start the dev server
```

### Backend (Cloudflare Worker)

```bash
cd workers
npm i
npx wrangler dev    # run the API locally
```

See [`workers/CREATE_API_TOKEN.md`](workers/CREATE_API_TOKEN.md) and [`CLOUDFLARE_DEPLOYMENT.md`](CLOUDFLARE_DEPLOYMENT.md) for deployment details.

## ⚙️ Environment Variables

Copy `.env.example` to `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `VITE_WORKERS_API_URL` | URL of your deployed Cloudflare Worker API |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous (public) key |
</content>
