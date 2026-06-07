#!/bin/bash
# Quick deployment script for LifePath Cloudflare Workers

set -e

echo "🚀 LifePath Cloudflare Workers Deployment"
echo "=========================================="
echo ""

# Check if wrangler is installed
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js first."
    exit 1
fi

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Login to Cloudflare
echo ""
echo "🔐 Logging in to Cloudflare..."
echo "This will open your browser. Please authorize the CLI."
npx wrangler login

# Create D1 database
echo ""
echo "🗄️  Creating D1 database..."
echo "Creating database 'lifepath'..."
DB_OUTPUT=$(npx wrangler d1 create lifepath 2>&1 || true)

# Extract database ID
DB_ID=$(echo "$DB_OUTPUT" | grep "database_id" | sed 's/.*"\(.*\)".*/\1/')

if [ -z "$DB_ID" ]; then
    echo "⚠️  Database might already exist. Checking..."
    # Try to get existing database info
    DB_INFO=$(npx wrangler d1 list 2>&1 | grep lifepath || true)
    if [ -z "$DB_INFO" ]; then
        echo "❌ Could not create or find database. Please create manually:"
        echo "   npx wrangler d1 create lifepath"
        exit 1
    else
        echo "✅ Found existing database"
        echo "⚠️  Please manually update database_id in wrangler.toml"
        echo "   Run: npx wrangler d1 list"
        echo "   Then copy the database_id to wrangler.toml"
    fi
else
    echo "✅ Database created with ID: $DB_ID"
    # Update wrangler.toml
    echo ""
    echo "📝 Updating wrangler.toml..."
    sed -i.bak "s/database_id = \".*\"/database_id = \"$DB_ID\"/" wrangler.toml
    rm wrangler.toml.bak 2>/dev/null || true
    echo "✅ Updated wrangler.toml"
fi

# Initialize database schema
echo ""
echo "🏗️  Initializing database schema..."
npx wrangler d1 execute lifepath --file=./schema.sql
echo "✅ Database schema created"

# Set JWT secret
echo ""
echo "🔑 Setting JWT secret..."
echo "Generating random secret..."
JWT_SECRET=$(openssl rand -base64 32 2>/dev/null || echo "$(date +%s)_$(uuidgen || echo $RANDOM$RANDOM$RANDOM)")
echo "$JWT_SECRET" | npx wrangler secret put JWT_SECRET
echo "✅ JWT secret set"

# Deploy worker
echo ""
echo "🚀 Deploying worker..."
npx wrangler deploy
echo ""
echo "✅ Worker deployed successfully!"

# Get worker URL
echo ""
echo "📋 Next steps:"
echo "1. Copy your worker URL from above (looks like: https://lifepath-api.xxx.workers.dev)"
echo "2. Update your .env file:"
echo "   VITE_WORKERS_API_URL=https://your-worker-url.workers.dev"
echo "3. Restart your frontend dev server"
echo ""
echo "🎉 Deployment complete!"
