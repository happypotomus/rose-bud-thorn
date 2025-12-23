'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatReflectionAsText, downloadAsFile, type ReflectionData } from '@/lib/utils/export-reflection'
import { Download } from 'lucide-react'

type DownloadReflectionsProps = {
  userId: string
  circleId: string
}

export function DownloadReflections({ userId, circleId }: DownloadReflectionsProps) {
  const [downloading, setDownloading] = useState(false)
  const supabase = createClient()

  const handleDownload = async () => {
    setDownloading(true)
    try {
      console.log('[DOWNLOAD] Starting download process...')
      console.log('[DOWNLOAD] User ID:', userId)
      console.log('[DOWNLOAD] Circle ID:', circleId)

      // Get all past weeks
      console.log('[DOWNLOAD] Step 1: Fetching all past weeks...')
      const { data: allPastWeeks, error: weeksError } = await supabase
        .from('weeks')
        .select('id, start_at, end_at')
        .lt('end_at', new Date().toISOString())
        .order('start_at', { ascending: false })

      if (weeksError) {
        console.error('[DOWNLOAD] Error fetching weeks:', weeksError)
        alert('Error fetching weeks. Please try again.')
        setDownloading(false)
        return
      }

      if (!allPastWeeks || allPastWeeks.length === 0) {
        console.log('[DOWNLOAD] No past weeks found')
        alert('No past reflections found.')
        setDownloading(false)
        return
      }

      console.log(`[DOWNLOAD] Found ${allPastWeeks.length} past weeks`)
      console.log('[DOWNLOAD] Past week IDs:', allPastWeeks.map(w => w.id))

      // Filter to only unlocked weeks (same logic as review page)
      console.log('[DOWNLOAD] Step 2: Checking which weeks are unlocked...')
      const { isCircleUnlocked } = await import('@/lib/supabase/unlock')
      const unlockedWeeks = []
      const unlockCheckResults: Array<{ weekId: string; unlocked: boolean; error?: string }> = []
      
      for (let i = 0; i < allPastWeeks.length; i++) {
        const week = allPastWeeks[i]
        console.log(`[DOWNLOAD] Checking unlock for week ${i + 1}/${allPastWeeks.length}: ${week.id} (${new Date(week.start_at).toLocaleDateString()})`)
        
        try {
          const unlocked = await isCircleUnlocked(circleId, week.id, supabase)
          unlockCheckResults.push({ weekId: week.id, unlocked })
          console.log(`[DOWNLOAD] Week ${week.id}: ${unlocked ? 'UNLOCKED' : 'locked'}`)
          
          if (unlocked) {
            unlockedWeeks.push(week)
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          console.error(`[DOWNLOAD] Error checking unlock for week ${week.id}:`, errorMsg)
          unlockCheckResults.push({ weekId: week.id, unlocked: false, error: errorMsg })
        }
      }

      console.log(`[DOWNLOAD] Unlock check complete: ${unlockedWeeks.length} unlocked out of ${allPastWeeks.length} total weeks`)
      console.log('[DOWNLOAD] Unlock results:', unlockCheckResults)
      console.log('[DOWNLOAD] Unlocked week IDs:', unlockedWeeks.map(w => w.id))

      if (unlockedWeeks.length === 0) {
        console.log('[DOWNLOAD] No unlocked weeks found')
        alert('No unlocked weeks found.')
        setDownloading(false)
        return
      }

      // Get all user's reflections for unlocked weeks only
      const weekIds = unlockedWeeks.map(w => w.id)
      
      console.log(`[DOWNLOAD] Step 3: Fetching reflections for ${weekIds.length} unlocked weeks...`)
      console.log('[DOWNLOAD] Week IDs to query:', weekIds)
      
      // Check if user has reflections for these weeks - query each week individually to debug
      console.log('[DOWNLOAD] Checking reflections per week individually...')
      const reflectionsPerWeek: Map<string, any[]> = new Map()
      
      for (const weekId of weekIds) {
        const { data: weekReflections, error: weekError } = await supabase
          .from('reflections')
          .select('id, week_id, submitted_at')
          .eq('user_id', userId)
          .eq('circle_id', circleId)
          .eq('week_id', weekId)
          .not('submitted_at', 'is', null)
        
        if (weekError) {
          console.error(`[DOWNLOAD] Error checking week ${weekId}:`, weekError)
        } else {
          const count = weekReflections?.length || 0
          console.log(`[DOWNLOAD] Week ${weekId}: Found ${count} reflection(s)`)
          if (weekReflections && weekReflections.length > 0) {
            reflectionsPerWeek.set(weekId, weekReflections)
            console.log(`[DOWNLOAD] Week ${weekId} reflection details:`, weekReflections.map(r => ({ id: r.id, week_id: r.week_id, submitted_at: r.submitted_at })))
          }
        }
      }
      
      console.log(`[DOWNLOAD] Total reflections found (per-week check): ${Array.from(reflectionsPerWeek.values()).flat().length}`)

      // Fetch all reflections - query each week individually (more reliable than .in())
      // This matches the approach used in the review page
      console.log(`[DOWNLOAD] Fetching reflections for each week individually...`)
      let allReflections: any[] = []

      for (const weekId of weekIds) {
        console.log(`[DOWNLOAD] Fetching reflections for week ${weekId}...`)
        
        const { data: reflections, error } = await supabase
          .from('reflections')
          .select(`
            id,
            week_id,
            rose_text,
            bud_text,
            thorn_text,
            rose_audio_url,
            bud_audio_url,
            thorn_audio_url,
            rose_transcript,
            bud_transcript,
            thorn_transcript,
            submitted_at
          `)
          .eq('user_id', userId)
          .eq('circle_id', circleId)
          .eq('week_id', weekId)
          .not('submitted_at', 'is', null)
          .order('submitted_at', { ascending: false })

        if (error) {
          console.error(`[DOWNLOAD] Error fetching reflections for week ${weekId}:`, error)
          // Continue with other weeks instead of failing completely
          continue
        }

        if (reflections && reflections.length > 0) {
          console.log(`[DOWNLOAD] Week ${weekId}: Found ${reflections.length} reflection(s)`)
          allReflections = allReflections.concat(reflections)
        } else {
          console.log(`[DOWNLOAD] Week ${weekId}: No reflections found`)
        }
      }
      
      // Sort all reflections by submitted_at descending (most recent first)
      allReflections.sort((a, b) => {
        const dateA = new Date(a.submitted_at).getTime()
        const dateB = new Date(b.submitted_at).getTime()
        return dateB - dateA
      })
      
      console.log(`[DOWNLOAD] Total reflections collected: ${allReflections.length}`)

      const reflections = allReflections

      console.log(`[DOWNLOAD] Step 4: Processing ${reflections.length} total reflections...`)

      if (!reflections || reflections.length === 0) {
        console.log('[DOWNLOAD] No reflections found after querying')
        alert('No reflections found to download.')
        setDownloading(false)
        return
      }

      // Group reflections by week_id to see distribution
      const reflectionsByWeek = new Map<string, number>()
      for (const r of reflections) {
        reflectionsByWeek.set(r.week_id, (reflectionsByWeek.get(r.week_id) || 0) + 1)
      }
      console.log('[DOWNLOAD] Reflections per week:', Array.from(reflectionsByWeek.entries()).map(([weekId, count]) => ({ weekId, count })))

      console.log(`[DOWNLOAD] Found ${reflections.length} reflections for ${unlockedWeeks.length} unlocked weeks`)

      // Create a map of week_id -> week data for quick lookup
      const weekMap = new Map(unlockedWeeks.map(w => [w.id, w]))
      
      // Also log which week_ids we have vs which reflections we found
      console.log('[DOWNLOAD] Expected week IDs:', weekIds)
      console.log('[DOWNLOAD] Reflection week_ids found:', Array.from(reflectionsByWeek.keys()))
      console.log('[DOWNLOAD] Missing week IDs (unlocked but no reflections):', weekIds.filter(id => !reflectionsByWeek.has(id)))

      // Format all reflections
      console.log('[DOWNLOAD] Step 5: Formatting reflections...')
      let allReflectionsText = 'My Reflections\n'
      allReflectionsText += '='.repeat(50) + '\n\n'

      let formattedCount = 0
      let skippedCount = 0

      for (const reflection of reflections) {
        const week = weekMap.get(reflection.week_id)
        
        if (!week) {
          console.warn(`[DOWNLOAD] Week not found for reflection ${reflection.id}, week_id: ${reflection.week_id}`)
          skippedCount++
          continue
        }

        const reflectionData: ReflectionData = {
          rose_text: reflection.rose_text,
          bud_text: reflection.bud_text,
          thorn_text: reflection.thorn_text,
          rose_transcript: reflection.rose_transcript,
          bud_transcript: reflection.bud_transcript,
          thorn_transcript: reflection.thorn_transcript,
          rose_audio_url: reflection.rose_audio_url,
          bud_audio_url: reflection.bud_audio_url,
          thorn_audio_url: reflection.thorn_audio_url,
          submitted_at: reflection.submitted_at,
        }

        const formatted = formatReflectionAsText(
          reflectionData,
          new Date(week.start_at),
          new Date(week.end_at)
        )

        allReflectionsText += formatted + '\n\n'
        allReflectionsText += '='.repeat(50) + '\n\n'
        formattedCount++
      }

      console.log(`[DOWNLOAD] Formatted ${formattedCount} reflections, skipped ${skippedCount}, text length: ${allReflectionsText.length}`)

      // Generate filename with current date
      const today = new Date()
      const filename = `my-reflections-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.txt`

      // Download the file
      console.log('[DOWNLOAD] Step 6: Downloading file...')
      downloadAsFile(allReflectionsText.trim(), filename, 'text/plain')
      console.log('[DOWNLOAD] Download complete!')
    } catch (error) {
      console.error('[DOWNLOAD] Error downloading reflections:', error)
      alert('Failed to download reflections. Please try again.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={downloading}
      className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm sm:text-base transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Download className="w-4 h-4 sm:w-5 sm:h-5" />
      <span>{downloading ? 'Downloading...' : 'Download Your Reflections'}</span>
    </button>
  )
}
