#!/bin/bash
# Script to deploy Edge Functions and set secrets
# Requires: Supabase CLI, Docker (for bundling), and environment variables

set -e

PROJECT_REF="wildgnkpmalxvadlmjbj"

echo "🚀 Deploying Edge Functions to Supabase..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    echo "   Edge Functions require Docker for bundling."
    exit 1
fi

# Deploy functions
echo "📦 Deploying sunday-reminder function..."
supabase functions deploy sunday-reminder --project-ref $PROJECT_REF --no-verify-jwt

echo "📦 Deploying monday-reminder function..."
supabase functions deploy monday-reminder --project-ref $PROJECT_REF --no-verify-jwt

echo ""
echo "✅ Functions deployed successfully!"
echo ""
echo "⚠️  Next steps:"
echo "   1. Set Edge Function secrets in Supabase Dashboard:"
echo "      - Go to Project Settings → Edge Functions → Secrets"
echo "      - Add: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER"
echo ""
echo "   2. Or set secrets via CLI:"
echo "      supabase secrets set SUPABASE_URL=your-url --project-ref $PROJECT_REF"
echo "      supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-key --project-ref $PROJECT_REF"
echo "      supabase secrets set TWILIO_ACCOUNT_SID=your-sid --project-ref $PROJECT_REF"
echo "      supabase secrets set TWILIO_AUTH_TOKEN=your-token --project-ref $PROJECT_REF"
echo "      supabase secrets set TWILIO_PHONE_NUMBER=your-number --project-ref $PROJECT_REF"

