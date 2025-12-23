#!/bin/bash
# Script to manually trigger Sunday 7pm reminder
# Usage: ./scripts/trigger-sunday-reminder.sh [baseUrl]
# Example: ./scripts/trigger-sunday-reminder.sh http://localhost:3000
# Example: ./scripts/trigger-sunday-reminder.sh https://rose-bud-thorn.vercel.app

BASE_URL="${1:-http://localhost:3000}"

echo "🔔 Triggering Sunday Reminder"
echo "Base URL: $BASE_URL"
echo ""

echo "📞 Calling Sunday reminder API..."
RESPONSE=$(curl -s -X POST "$BASE_URL/api/trigger-sunday-reminder" \
  -H "Content-Type: application/json")

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

echo ""
echo "📊 Result:"
SUCCESS=$(echo "$RESPONSE" | grep -o '"success":[^,}]*' | cut -d':' -f2)
TOTAL_SENT=$(echo "$RESPONSE" | grep -o '"totalSent":[0-9]*' | cut -d':' -f2)
TOTAL_ERRORS=$(echo "$RESPONSE" | grep -o '"totalErrors":[0-9]*' | cut -d':' -f2)

if [ "$SUCCESS" = "true" ]; then
  echo "✅ Reminder triggered successfully"
  if [ -n "$TOTAL_SENT" ]; then
    echo "   📱 SMS sent to $TOTAL_SENT member(s)"
  fi
  if [ -n "$TOTAL_ERRORS" ] && [ "$TOTAL_ERRORS" != "0" ]; then
    echo "   ⚠️  $TOTAL_ERRORS error(s) occurred"
  fi
elif [ -n "$(echo "$RESPONSE" | grep -o '"error"')" ]; then
  echo "❌ Error occurred"
  echo "$RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4
else
  echo "⚠️  Unexpected response format"
fi
