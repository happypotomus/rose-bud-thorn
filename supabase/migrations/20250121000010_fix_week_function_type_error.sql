-- Fix type error in get_or_create_current_week function
-- The issue is with date arithmetic and type casting

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
  day_of_week INT;
  hours_since_midnight INT;
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
  -- Calculate start_at: most recent Sunday 7pm
  day_of_week := EXTRACT(DOW FROM current_time)::INT; -- 0=Sunday, 6=Saturday
  hours_since_midnight := EXTRACT(HOUR FROM current_time)::INT;
  
  -- Start with today at midnight (as TIMESTAMPTZ)
  week_start := DATE_TRUNC('day', current_time);
  
  -- Calculate days to subtract to get to last Sunday
  IF day_of_week = 0 THEN
    -- It's Sunday
    IF hours_since_midnight < 19 THEN
      -- Before 7pm, go back 7 days to last Sunday
      week_start := week_start - INTERVAL '7 days';
    END IF;
    -- If after 7pm on Sunday, week_start is already today
  ELSE
    -- Not Sunday, go back to last Sunday
    -- Use make_interval to avoid string concatenation issues
    week_start := week_start - make_interval(days => day_of_week);
  END IF;
  
  -- Add 19 hours (7pm) to get to Sunday 7pm
  week_start := week_start + INTERVAL '19 hours';

  -- Calculate end_at: next Sunday 6:59pm (7 days later, minus 1 minute)
  week_end := week_start + INTERVAL '7 days' - INTERVAL '1 minute';

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

