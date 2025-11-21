-- Fix naming conflict: current_time conflicts with PostgreSQL's CURRENT_TIME function
-- Rename variable to now_time to avoid the conflict

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
  now_time TIMESTAMPTZ := NOW();
  week_start TIMESTAMPTZ;
  week_end TIMESTAMPTZ;
  found_week RECORD;
  day_of_week INT;
  hours_since_midnight INT;
  days_to_subtract INT;
BEGIN
  -- Try to find existing week where now_time is between start_at and end_at
  SELECT w.* INTO found_week
  FROM weeks w
  WHERE now_time >= w.start_at
    AND now_time < w.end_at
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
  day_of_week := EXTRACT(DOW FROM now_time)::INT; -- 0=Sunday, 6=Saturday
  hours_since_midnight := EXTRACT(HOUR FROM now_time)::INT;
  
  -- Calculate how many days to go back to get to last Sunday
  IF day_of_week = 0 THEN
    -- It's Sunday
    IF hours_since_midnight < 19 THEN
      -- Before 7pm, go back 7 days
      days_to_subtract := 7;
    ELSE
      -- After 7pm, this Sunday is the start
      days_to_subtract := 0;
    END IF;
  ELSE
    -- Not Sunday, go back to last Sunday
    days_to_subtract := day_of_week;
  END IF;
  
  -- Calculate week_start: last Sunday at 7pm
  week_start := DATE_TRUNC('day', now_time) - (days_to_subtract || ' days')::INTERVAL + INTERVAL '19 hours';

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

