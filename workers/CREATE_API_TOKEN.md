# Create Cloudflare API Token for Workers Deployment

Your current API token only has Workers AI permissions. To deploy workers, you need a token with additional permissions.

## Steps to Create the Right Token:

1. Go to: https://dash.cloudflare.com/profile/api-tokens

2. Click **"Create Token"**

3. Click **"Create Custom Token"**

4. Configure the token:
   - **Token name**: `LifePath Workers Deploy`
   
   - **Permissions**:
     - Account > Workers Scripts > Edit
     - Account > Workers KV Storage > Edit
     - Account > Workers R2 Storage > Edit
     - Account > D1 > Edit
     - Account > Account Settings > Read
     - Account > Workers AI > Edit (if using AI features)
   
   - **Account Resources**:
     - Include > Your Account (<your-account-id>)
   
   - **Zone Resources**:
     - All zones

5. Click **"Continue to summary"**

6. Click **"Create Token"**

7. **Copy the token** (it will look like: `xxx_yyyyyyy...`)

## Use the New Token:

Update your `.dev.vars` file:

```bash
CLOUDFLARE_ACCOUNT_ID=<your-account-id>
CLOUDFLARE_API_TOKEN=<your-new-token-here>
JWT_SECRET=<your-jwt-secret>
```

Then deploy:

```bash
export CLOUDFLARE_API_TOKEN=<your-new-token-here>
export CLOUDFLARE_ACCOUNT_ID=<your-account-id>
pnpm exec wrangler deploy
```

## Alternative: Use Local Development

If you don't want to deploy yet, you can run the worker locally:

```bash
pnpm run dev
```

This starts your API at `http://localhost:8787` - perfect for testing!
