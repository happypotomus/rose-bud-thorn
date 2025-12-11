#!/bin/bash
# Script to set Edge Function secrets
# Usage: ./scripts/set-function-secrets.sh
# Requires: .env.local file with the required variables

set -e

PROJECT_REF="wildgnkpmalxvadlmjbj"

# Load environment variables from .env.local if it exists
if [ -f .env.local ]; then
    echo "📝 Loading environment variables from .env.local..."
    export $(grep -v '^#' .env.local | xargs)
fi

# Check for required variables
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "❌ NEXT_PUBLIC_SUPABASE_URL not found in environment"
    echo "   Please set it in .env.local or export it before running this script"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ SUPABASE_SERVICE_ROLE_KEY not found in environment"
    echo "   Please get it from Supabase Dashboard → Project Settings → API → service_role key"
    echo "   Then add it to .env.local or export it"
    exit 1
fi

if [ -z "$TWILIO_ACCOUNT_SID" ] || [ -z "$TWILIO_AUTH_TOKEN" ] || [ -z "$TWILIO_PHONE_NUMBER" ]; then
    echo "❌ Twilio credentials not found in environment"
    echo "   Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER"
    exit 1
fi

echo "🔐 Setting Edge Function secrets..."

# Set Supabase secrets
echo "Setting SUPABASE_URL..."
supabase secrets set SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" --project-ref $PROJECT_REF

echo "Setting SUPABASE_SERVICE_ROLE_KEY..."
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" --project-ref $PROJECT_REF

# Set Twilio secrets
echo "Setting TWILIO_ACCOUNT_SID..."
supabase secrets set TWILIO_ACCOUNT_SID="$TWILIO_ACCOUNT_SID" --project-ref $PROJECT_REF

echo "Setting TWILIO_AUTH_TOKEN..."
supabase secrets set TWILIO_AUTH_TOKEN="$TWILIO_AUTH_TOKEN" --project-ref $PROJECT_REF

echo "Setting TWILIO_PHONE_NUMBER..."
supabase secrets set TWILIO_PHONE_NUMBER="$TWILIO_PHONE_NUMBER" --project-ref $PROJECT_REF

echo ""
echo "✅ All secrets set successfully!"
echo ""
echo "You can verify by running:"
echo "  supabase secrets list --project-ref $PROJECT_REF"


