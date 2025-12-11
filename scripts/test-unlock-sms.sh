#!/bin/bash
# Script to test unlock SMS functionality
# Usage: ./scripts/test-unlock-sms.sh [circleId] [weekId]

CIRCLE_ID="${1:-21e9a0b6-8bd3-401b-84d7-5a5976721e9e}"
WEEK_ID="${2:-9d065fa1-0b5c-4981-a80b-0dff35f07bf4}"

echo "🧪 Testing Unlock SMS"
echo "Circle ID: $CIRCLE_ID"
echo "Week ID: $WEEK_ID"
echo ""

echo "📞 Calling unlock SMS API..."
RESPONSE=$(curl -s -X POST http://localhost:3000/api/send-unlock-sms \
  -H "Content-Type: application/json" \
  -d "{\"circleId\":\"$CIRCLE_ID\",\"weekId\":\"$WEEK_ID\"}")

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

echo ""
echo "📊 Result:"
SENT=$(echo "$RESPONSE" | grep -o '"sent":[0-9]*' | cut -d':' -f2)
ERRORS=$(echo "$RESPONSE" | grep -o '"errors":[0-9]*' | cut -d':' -f2)

if [ "$SENT" = "0" ]; then
  echo "⚠️  No SMS sent - Circle is not unlocked yet"
  echo "   This means not everyone in the circle has submitted their reflection."
  echo ""
  echo "💡 To test unlock SMS:"
  echo "   1. Make sure all circle members have submitted reflections for this week"
  echo "   2. Then run this script again"
else
  echo "✅ SMS sent to $SENT member(s)"
  if [ "$ERRORS" != "0" ]; then
    echo "⚠️  $ERRORS error(s) occurred"
  fi
fi


