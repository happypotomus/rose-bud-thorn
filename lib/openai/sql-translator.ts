import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

const DATABASE_SCHEMA = `
Database Schema for Rose-Bud-Thorn App:

1. profiles
   - id (UUID, PRIMARY KEY, references auth.users)
   - first_name (TEXT, NOT NULL)
   - phone (TEXT, NOT NULL, UNIQUE)
   - created_at (TIMESTAMPTZ, NOT NULL)

2. circles
   - id (UUID, PRIMARY KEY)
   - name (TEXT, NOT NULL)
   - invite_token (TEXT, NOT NULL, UNIQUE)
   - created_at (TIMESTAMPTZ, NOT NULL)

3. circle_members
   - id (UUID, PRIMARY KEY)
   - circle_id (UUID, NOT NULL, references circles.id)
   - user_id (UUID, NOT NULL, references profiles.id)
   - created_at (TIMESTAMPTZ, NOT NULL)
   - UNIQUE constraint on user_id (one circle per user)

4. weeks
   - id (UUID, PRIMARY KEY)
   - start_at (TIMESTAMPTZ, NOT NULL)
   - end_at (TIMESTAMPTZ, NOT NULL)
   - created_at (TIMESTAMPTZ, NOT NULL)

5. reflections
   - id (UUID, PRIMARY KEY)
   - circle_id (UUID, NOT NULL, references circles.id)
   - week_id (UUID, NOT NULL, references weeks.id)
   - user_id (UUID, NOT NULL, references profiles.id)
   - rose_text (TEXT, nullable)
   - bud_text (TEXT, nullable)
   - thorn_text (TEXT, nullable)
   - rose_audio_url (TEXT, nullable)
   - bud_audio_url (TEXT, nullable)
   - thorn_audio_url (TEXT, nullable)
   - rose_transcript (TEXT, nullable)
   - bud_transcript (TEXT, nullable)
   - thorn_transcript (TEXT, nullable)
   - submitted_at (TIMESTAMPTZ, nullable)
   - UNIQUE constraint on (user_id, circle_id, week_id)

6. notification_logs
   - id (UUID, PRIMARY KEY)
   - user_id (UUID, NOT NULL, references profiles.id)
   - circle_id (UUID, NOT NULL, references circles.id)
   - week_id (UUID, NOT NULL, references weeks.id)
   - type (TEXT, NOT NULL, CHECK: 'first_reminder', 'second_reminder', or 'unlock')
   - message (TEXT, NOT NULL)
   - sent_at (TIMESTAMPTZ, NOT NULL)

Common relationships:
- profiles.id → circle_members.user_id
- circles.id → circle_members.circle_id
- profiles.id → reflections.user_id
- circles.id → reflections.circle_id
- weeks.id → reflections.week_id
- profiles.id → notification_logs.user_id
- circles.id → notification_logs.circle_id
- weeks.id → notification_logs.week_id

PostgreSQL functions available:
- get_or_create_current_week() - Returns the current week row
`

/**
 * Translates natural language queries into SQL SELECT statements
 * @param naturalLanguageQuery - The natural language query from the user
 * @returns SQL SELECT statement or null if translation fails
 */
export async function translateToSQL(naturalLanguageQuery: string): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using mini for cost efficiency
      messages: [
        {
          role: 'system',
          content: `You are a SQL query translator for a PostgreSQL database. Your job is to translate natural language questions into valid SQL SELECT queries.

${DATABASE_SCHEMA}

IMPORTANT RULES:
1. You MUST only generate SELECT queries. Never generate INSERT, UPDATE, DELETE, DROP, ALTER, CREATE, TRUNCATE, GRANT, or REVOKE statements.
2. You can use WITH clauses (CTEs), JOINs, WHERE, GROUP BY, ORDER BY, HAVING, and other SELECT features.
3. Use proper PostgreSQL syntax.
4. Always use table aliases for clarity.
5. Handle NULL values appropriately.
6. Use proper date/time functions for TIMESTAMPTZ columns.
7. Return ONLY the SQL query, no explanations, no markdown formatting, no code blocks.
8. The SQL should be ready to execute directly - do NOT include a trailing semicolon.
9. If the query asks about "this week" or "current week", use the get_or_create_current_week() function.
10. Be precise with JOINs and relationships between tables.`,
        },
        {
          role: 'user',
          content: `Translate this natural language query into SQL:\n\n${naturalLanguageQuery}`,
        },
      ],
      temperature: 0.1, // Low temperature for consistent SQL generation
    })

    const sql = response.choices[0]?.message?.content?.trim()
    
    if (!sql) {
      return null
    }

    // Remove markdown code blocks if present
    let cleanedSQL = sql
      .replace(/^```sql\n?/i, '')
      .replace(/^```\n?/i, '')
      .replace(/\n?```$/i, '')
      .trim()

    // Remove trailing semicolons (the exec_sql function will handle this, but doing it here too for safety)
    cleanedSQL = cleanedSQL.replace(/;+$/, '').trim()

    return cleanedSQL
  } catch (error) {
    console.error('Error translating to SQL:', error)
    throw error
  }
}

