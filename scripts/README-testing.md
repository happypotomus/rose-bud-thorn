# Testing Scripts

Scripts for functional testing of the photo upload feature and other functionality.

## Visual Preview

Visit `/preview` in your local development environment to see all UI components with mock data.

**Note:** The preview page is only available in development mode. It will return 404 in production.

## Functional Testing

### Setup Test Circle

Create a test circle for functional testing:

```bash
npx tsx scripts/create-test-circle.ts
```

This will:
- Create a test circle with a clear name (includes "TEST" prefix)
- Generate an invite link
- Create/get the current week
- Save the circle ID to `.test-circle-id` for easy cleanup

**Requirements:**
- `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`
- `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`

**Next Steps:**
1. Copy the invite link from the output
2. Go to your app and join the test circle
3. Test photo uploads, submissions, reviews, etc.
4. When done, clean up with the cleanup script

### Cleanup Test Circle

Remove the test circle and all associated data:

```bash
npx tsx scripts/cleanup-test-circle.ts [circle-id]
```

If no circle ID is provided, it will read from `.test-circle-id` file (created by the setup script).

This will delete:
- All reflections in the test circle
- All photos in storage for those reflections
- All circle members
- The test circle itself

**Safety:** The script checks if the circle name contains "TEST" and warns if it doesn't.

### Testing Mid-Week Submissions

Since you're testing mid-week:

1. The test circle will use the current week (created automatically)
2. You can submit reflections immediately (no need to wait for week start)
3. Test the full flow:
   - Submit reflection with photo
   - View in review page
   - Read in read page
   - Check photo display

## Notes

- Test circles are clearly marked with "TEST" in the name
- All test data is isolated to the test circle
- Cleanup is safe and thorough (removes all associated data)
- The `.test-circle-id` file is gitignored (won't be committed)
