/**
 * Formats a reflection for export
 * Combines text and transcripts, preferring text when available
 */
export type ReflectionData = {
  rose_text: string | null
  bud_text: string | null
  thorn_text: string | null
  rose_transcript: string | null
  bud_transcript: string | null
  thorn_transcript: string | null
  rose_audio_url?: string | null
  bud_audio_url?: string | null
  thorn_audio_url?: string | null
  submitted_at: string | null
}

/**
 * Gets the display content for a section
 * Priority: user-typed text > GPT transcript > "Audio response" (if audio exists) > empty
 * For export: we want the actual content, not just "Audio response"
 */
function getSectionContent(text: string | null, transcript: string | null, audioUrl?: string | null): string {
  // Helper to check if a string has actual content
  const hasContent = (str: string | null | undefined): boolean => {
    return str != null && typeof str === 'string' && str.trim().length > 0
  }
  
  // Priority 1: If user typed text, use it (user typed it)
  if (hasContent(text)) {
    return (text as string).trim()
  }
  
  // Priority 2: If GPT transcript exists, use it (this is the cleaned transcription)
  // This is the actual transcript content, not just "Audio response"
  if (hasContent(transcript)) {
    return (transcript as string).trim()
  }
  
  // Priority 3: If audio exists but no text/transcript available yet, indicate audio response
  // This should only happen if transcription hasn't completed or failed
  if (hasContent(audioUrl)) {
    return 'Audio response'
  }
  
  // Priority 4: No content at all
  return ''
}

/**
 * Formats reflection as plain text
 */
export function formatReflectionAsText(
  reflection: ReflectionData,
  weekStartDate?: Date,
  weekEndDate?: Date
): string {
  const rose = getSectionContent(reflection.rose_text, reflection.rose_transcript, reflection.rose_audio_url)
  const bud = getSectionContent(reflection.bud_text, reflection.bud_transcript, reflection.bud_audio_url)
  const thorn = getSectionContent(reflection.thorn_text, reflection.thorn_transcript, reflection.thorn_audio_url)

  let output = ''

  // Week header
  if (weekStartDate || weekEndDate) {
    if (weekStartDate && weekEndDate) {
      output += `Week of ${weekStartDate.toLocaleDateString()} - ${weekEndDate.toLocaleDateString()}\n\n`
    } else if (weekStartDate) {
      output += `Week of ${weekStartDate.toLocaleDateString()}\n\n`
    }
  }

  // Rose section
  output += '🌹 Rose\n'
  output += '-'.repeat(30) + '\n'
  output += (rose || '(No response)') + '\n\n'

  // Bud section
  output += '🌱 Bud\n'
  output += '-'.repeat(30) + '\n'
  output += (bud || '(No response)') + '\n\n'

  // Thorn section
  output += '🌵 Thorn\n'
  output += '-'.repeat(30) + '\n'
  output += (thorn || '(No response)') + '\n\n'

  return output.trim()
}

/**
 * Formats reflection as Markdown
 */
export function formatReflectionAsMarkdown(
  reflection: ReflectionData,
  weekStartDate?: Date,
  weekEndDate?: Date
): string {
  const rose = getSectionContent(reflection.rose_text, reflection.rose_transcript, reflection.rose_audio_url)
  const bud = getSectionContent(reflection.bud_text, reflection.bud_transcript, reflection.bud_audio_url)
  const thorn = getSectionContent(reflection.thorn_text, reflection.thorn_transcript, reflection.thorn_audio_url)

  let output = ''

  // Week header
  if (weekStartDate || weekEndDate) {
    if (weekStartDate && weekEndDate) {
      output += `**Week of** ${weekStartDate.toLocaleDateString()} - ${weekEndDate.toLocaleDateString()}\n\n`
    } else if (weekStartDate) {
      output += `**Week of** ${weekStartDate.toLocaleDateString()}\n\n`
    }
  }

  // Rose section
  output += '## 🌹 Rose\n\n'
  output += (rose || '(No response)') + '\n\n'

  // Bud section
  output += '## 🌱 Bud\n\n'
  output += (bud || '(No response)') + '\n\n'

  // Thorn section
  output += '## 🌵 Thorn\n\n'
  output += (thorn || '(No response)') + '\n\n'

  return output.trim()
}

/**
 * Downloads text as a file
 */
export function downloadAsFile(content: string, filename: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Copies text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch (err) {
    console.error('Failed to copy to clipboard:', err)
    // Fallback for older browsers
    try {
      const textArea = document.createElement('textarea')
      textArea.value = text
      textArea.style.position = 'fixed'
      textArea.style.left = '-999999px'
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      return true
    } catch (fallbackErr) {
      console.error('Fallback copy failed:', fallbackErr)
      return false
    }
  }
}
