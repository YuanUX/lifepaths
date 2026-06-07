# LifePath Cloudflare Workers Backend

This is the Cloudflare Workers backend for LifePath, using D1 (SQLite) database and Workers AI.

## Setup Instructions

### 1. Install Wrangler (Cloudflare CLI)

```bash
cd workers
npm install
```

### 2. Login to Cloudflare

```bash
npx wrangler login
```

### 3. Create D1 Database

```bash
npm run db:create
```

This will output a database ID. Copy it and update `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "lifepath"
database_id = "your-database-id-here"  # <-- Paste your ID here
```

### 4. Initialize Database Schema

```bash
npm run db:init
```

This creates all the tables (users, goals, subtasks, milestones).

### 5. Set JWT Secret

```bash
npx wrangler secret put JWT_SECRET
```

Enter a random secret string (e.g., generate one with `openssl rand -base64 32`).

### 6. Deploy to Cloudflare

```bash
npm run deploy
```

After deployment, you'll get a URL like: `https://lifepath-api.your-subdomain.workers.dev`

### 7. Update Frontend Environment Variables

In your main project's `.env` file, add:

```env
VITE_WORKERS_API_URL=https://lifepath-api.your-subdomain.workers.dev
```

## Local Development

Run the worker locally:

```bash
npm run dev
```

This starts a local server at `http://localhost:8787`

## Features

- ✅ User authentication with JWT
- ✅ Goals, subtasks, and milestones CRUD
- ✅ D1 database (SQLite)
- ✅ Workers AI integration
- ✅ CORS enabled
- ✅ Automatic foreign key cascading

## API Endpoints

### Auth
- `POST /api/auth/signup` - Create account
- `POST /api/auth/signin` - Sign in

### User
- `GET /api/user` - Get user profile
- `PUT /api/user` - Update user profile

### Goals
- `GET /api/goals` - Get all goals
- `POST /api/goals` - Create goal
- `PUT /api/goals/:id` - Update goal
- `DELETE /api/goals/:id` - Delete goal

### Subtasks
- `POST /api/subtasks` - Create subtask
- `PUT /api/subtasks/:id` - Update subtask
- `DELETE /api/subtasks/:id` - Delete subtask

### Milestones
- `GET /api/milestones/global` - Get global milestones
- `POST /api/milestones/global` - Create global milestone
- `PUT /api/milestones/global/:id` - Update global milestone
- `DELETE /api/milestones/global/:id` - Delete global milestone
- `POST /api/milestones/goal` - Create goal milestone
- `PUT /api/milestones/goal/:id` - Update goal milestone
- `DELETE /api/milestones/goal/:id` - Delete goal milestone

### AI
- `POST /api/ai/suggestions` - Get AI suggestions for goal breakdown

## Database Management

View your data in the Cloudflare dashboard:
https://dash.cloudflare.com/ → Workers & Pages → D1

Or query via CLI:
```bash
npx wrangler d1 execute lifepath --command "SELECT * FROM users"
```

## Troubleshooting

**CORS errors?**
- Make sure the worker is deployed
- Check that `VITE_WORKERS_API_URL` is set correctly

**401 Unauthorized?**
- Make sure you're signed in
- Check that JWT_SECRET is set in Cloudflare

**Database errors?**
- Run `npm run db:init` to create tables
- Check database_id in wrangler.toml
