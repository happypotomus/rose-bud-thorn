-- Create RPC function to get or create the current week
-- This function finds the week where now() is between start_at and end_at
-- If no such week exists, it creates one

CREATE OR REPLACE FUNCTION get_or_create_current_week()
RETURNS TABLE (
  id UUID,
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  current_time TIMESTAMPTZ := NOW();
  week_start TIMESTAMPTZ;
  week_end TIMESTAMPTZ;
  found_week RECORD;
BEGIN
  -- Try to find existing week where current_time is between start_at and end_at
  SELECT w.* INTO found_week
  FROM weeks w
  WHERE current_time >= w.start_at 
    AND current_time < w.end_at
  ORDER BY w.start_at DESC
  LIMIT 1;

  -- If week found, return it
  IF found_week IS NOT NULL THEN
    RETURN QUERY SELECT 
      found_week.id,
      found_week.start_at,
      found_week.end_at,
      found_week.created_at;
    RETURN;
  END IF;

  -- No week found, create a new one
  -- Calculate start_at: most recent Sunday 7pm (or current time if it's Sunday 7pm+)
  -- Sunday = 0 in PostgreSQL's DOW (0-6, Sunday=0)
  week_start := DATE_TRUNC('week', current_time) + INTERVAL '1 day' + INTERVAL '19 hours';
  -- If current_time is before Sunday 7pm this week, go back to last Sunday 7pm
  IF EXTRACT(DOW FROM current_time) = 0 AND EXTRACT(HOUR FROM current_time) < 19 THEN
    week_start := week_start - INTERVAL '7 days';
  ELSIF EXTRACT(DOW FROM current_time) != 0 THEN
    -- If not Sunday, go back to last Sunday 7pm
    week_start := week_start - INTERVAL '7 days';
  END IF;

  -- Calculate end_at: next Sunday 6:59pm
  week_end := week_start + INTERVAL '6 days' + INTERVAL '23 hours' + INTERVAL '59 minutes';

  -- Insert new week
  INSERT INTO weeks (start_at, end_at)
  VALUES (week_start, week_end)
  RETURNING weeks.id, weeks.start_at, weeks.end_at, weeks.created_at
  INTO found_week.id, found_week.start_at, found_week.end_at, found_week.created_at;

  -- Return the newly created week
  RETURN QUERY SELECT 
    found_week.id,
    found_week.start_at,
    found_week.end_at,
    found_week.created_at;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_or_create_current_week() TO authenticated;
GRANT EXECUTE ON FUNCTION get_or_create_current_week() TO anon;

