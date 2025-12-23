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
      // Get all past weeks
      const { data: allPastWeeks } = await supabase
        .from('weeks')
        .select('id, start_at, end_at')
        .lt('end_at', new Date().toISOString())
        .order('start_at', { ascending: false })

      if (!allPastWeeks || allPastWeeks.length === 0) {
        alert('No past reflections found.')
        setDownloading(false)
        return
      }

      // Filter to only unlocked weeks (same logic as review page)
      const { isCircleUnlocked } = await import('@/lib/supabase/unlock')
      const unlockedWeeks = []
      for (const week of allPastWeeks) {
        const unlocked = await isCircleUnlocked(circleId, week.id, supabase)
        if (unlocked) {
          unlockedWeeks.push(week)
        }
      }

      if (unlockedWeeks.length === 0) {
        alert('No unlocked weeks found.')
        setDownloading(false)
        return
      }

      // Get all user's reflections for unlocked weeks only
      const weekIds = unlockedWeeks.map(w => w.id)
      
      if (weekIds.length === 0) {
        alert('No past weeks found.')
        setDownloading(false)
        return
      }

      // Fetch all reflections (no limit) - use range to get all
      let allReflections: any[] = []
      let from = 0
      const pageSize = 1000
      let hasMore = true

      while (hasMore) {
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
          .in('week_id', weekIds)
          .not('submitted_at', 'is', null)
          .order('submitted_at', { ascending: false })
          .range(from, from + pageSize - 1)

        if (error) {
          console.error('Error fetching reflections:', error)
          alert('Error fetching reflections. Please try again.')
          setDownloading(false)
          return
        }

        if (!reflections || reflections.length === 0) {
          hasMore = false
        } else {
          allReflections = allReflections.concat(reflections)
          if (reflections.length < pageSize) {
            hasMore = false
          } else {
            from += pageSize
          }
        }
      }

      const reflections = allReflections

      if (!reflections || reflections.length === 0) {
        alert('No reflections found to download.')
        setDownloading(false)
        return
      }

      console.log(`Found ${reflections.length} reflections for ${unlockedWeeks.length} unlocked weeks`)

      // Create a map of week_id -> week data for quick lookup
      const weekMap = new Map(unlockedWeeks.map(w => [w.id, w]))
      
      // Also log which week_ids we have vs which reflections we found
      console.log('Week IDs:', weekIds)
      console.log('Reflection week_ids:', reflections.map(r => r.week_id))

      // Format all reflections
      let allReflectionsText = 'My Reflections\n'
      allReflectionsText += '='.repeat(50) + '\n\n'

      for (const reflection of reflections) {
        const week = weekMap.get(reflection.week_id)
        
        if (!week) {
          console.warn(`Week not found for reflection ${reflection.id}, week_id: ${reflection.week_id}`)
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
      }

      console.log(`Formatted ${reflections.length} reflections, text length: ${allReflectionsText.length}`)

      // Generate filename with current date
      const today = new Date()
      const filename = `my-reflections-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}.txt`

      // Download the file
      downloadAsFile(allReflectionsText.trim(), filename, 'text/plain')
    } catch (error) {
      console.error('Error downloading reflections:', error)
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
