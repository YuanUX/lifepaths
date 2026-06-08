# Deploying LifePath to Cloudflare

Complete guide to deploy LifePath with Cloudflare Workers backend.

## Prerequisites

- Cloudflare account (free tier works!)
- Node.js installed
- Git installed

## Step 1: Deploy the Workers Backend

### 1.1 Install Dependencies

```bash
cd workers
npm install
```

### 1.2 Login to Cloudflare

```bash
npx wrangler login
```

This opens your browser to authorize the CLI.

### 1.3 Create D1 Database

```bash
npm run db:create
```

**Copy the database ID from the output!** It looks like:
```
✅ Successfully created DB 'lifepath'
database_id: "abc123-def456-ghi789"
```

### 1.4 Update wrangler.toml

Edit `workers/wrangler.toml` and paste your database ID:

```toml
[[d1_databases]]
binding = "DB"
database_name = "lifepath"
database_id = "abc123-def456-ghi789"  # <-- Paste your ID here
```

### 1.5 Initialize Database

```bash
npm run db:init
```

This creates all the tables.

### 1.6 Set JWT Secret

```bash
npx wrangler secret put JWT_SECRET
```

When prompted, enter a random string (you can generate one with `openssl rand -base64 32` or just type a long random string).

### 1.7 Deploy Worker

```bash
npm run deploy
```

**Copy your worker URL from the output!** It looks like:
```
Published lifepath-api
  https://lifepath-api.your-name.workers.dev
```

## Step 2: Update Frontend Configuration

### 2.1 Update .env

In the main project root, edit `.env`:

```env
VITE_WORKERS_API_URL=https://lifepath-api.your-name.workers.dev
```

Replace with your actual worker URL from Step 1.7.

## Step 3: Test Locally

### 3.1 Start Workers Backend

In the `workers/` directory:

```bash
npm run dev
```

This starts the backend at `http://localhost:8787`

### 3.2 Start Frontend

In the main project directory:

```bash
npm run dev
```

Open the app and try:
- Creating an account
- Creating a goal
- Using the AI Plan feature

## Step 4: Deploy Frontend to Cloudflare Pages

### 4.1 Build the Frontend

```bash
npm run build
```

### 4.2 Create Pages Project

```bash
npx wrangler pages create lifepath
```

### 4.3 Deploy

```bash
npx wrangler pages deploy dist
```

**Copy your Pages URL!** Cloudflare may append a suffix if `lifepath` is taken, so the actual subdomain can differ:
```
✨ Deployment complete! Visit your site at:
  https://lifepath-47w.pages.dev
```

### 4.4 Set Environment Variable

Go to:
https://dash.cloudflare.com/ → Workers & Pages → Pages → lifepath → Settings → Environment variables

Add:
- Name: `VITE_WORKERS_API_URL`
- Value: `https://lifepath-api.your-name.workers.dev` (your worker URL)

Then redeploy:
```bash
npm run build
npx wrangler pages deploy dist
```

## Done! 🎉

Your app is now live at:
- Frontend: `https://lifepath-47w.pages.dev`
- Backend: `https://lifepath-api.your-name.workers.dev`

## Managing Your Database

### View Data

Go to: https://dash.cloudflare.com/ → Workers & Pages → D1 → lifepath

### Query via CLI

```bash
cd workers
npx wrangler d1 execute lifepath --command "SELECT * FROM users"
```

### Backup Database

```bash
npx wrangler d1 export lifepath --output=backup.sql
```

## Costs

Cloudflare Free Tier includes:
- 100,000 Worker requests/day
- 5 GB D1 storage
- 100,000 AI requests/day (Workers AI)
- Unlimited Pages deployments

This is more than enough for personal use!

## Troubleshooting

### "Worker not found" errors
- Make sure you deployed the worker: `cd workers && npm run deploy`
- Check your worker URL is correct in `.env`

### "Table doesn't exist" errors
- Run: `cd workers && npm run db:init`

### CORS errors
- Make sure both frontend and backend are deployed
- Check that `VITE_WORKERS_API_URL` is set correctly

### AI not working
- Workers AI is included automatically
- No additional setup needed!

## Next Steps

- Set up a custom domain in Cloudflare Pages settings
- Enable Cloudflare Analytics to track usage
- Set up monitoring alerts in Cloudflare dashboard
