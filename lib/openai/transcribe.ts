import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Transcribes audio from a URL and cleans the transcript using GPT
 * @param audioUrl - URL of the audio file (from Supabase Storage)
 * @returns Cleaned transcript text or null if transcription fails
 */
export async function transcribeAndClean(audioUrl: string): Promise<string | null> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set')
  }

  try {
    // Step 1: Fetch the audio file
    const audioResponse = await fetch(audioUrl)
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio: ${audioResponse.statusText}`)
    }

    // Convert response to blob/buffer for OpenAI API
    // In Node.js environment, we need to use a Readable stream or File
    const audioBlob = await audioResponse.blob()
    
    // Convert blob to File for OpenAI API
    // Note: File API is available in Node.js 18+ environments (which Next.js uses)
    const audioFile = new File([audioBlob], 'audio.webm', { 
      type: audioBlob.type || 'audio/webm' 
    })

    // Step 2: Transcribe using OpenAI Whisper API
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
      language: 'en', // Optional: specify language for better accuracy
    })

    const rawTranscript = transcription.text

    if (!rawTranscript || rawTranscript.trim().length === 0) {
      return null
    }

    // Step 3: Clean and format the transcript using GPT
    const cleanedTranscript = await cleanTranscript(rawTranscript)

    return cleanedTranscript
  } catch (error) {
    console.error('Error in transcribeAndClean:', error)
    throw error
  }
}

/**
 * Cleans and formats transcript text using GPT
 * - Adds proper punctuation and capitalization
 * - Removes filler words (um, uh, etc.)
 * - Formats into paragraphs
 * - Preserves the original meaning
 */
async function cleanTranscript(rawText: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini', // Using mini for cost efficiency
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that cleans and formats transcribed audio. 
Your job is to:
- Add proper punctuation and capitalization
- Aggressively remove ALL filler words and sounds: "um", "uh", "uhm", "uh-huh", "hmm", "er", "ah", "like", "you know", "so", "well" (at the start of sentences), and similar verbal tics
- Remove repeated words and false starts (e.g., "I, I mean" → "I mean")
- Format into readable paragraphs where appropriate
- Preserve the speaker's original meaning and tone
- Keep it conversational and natural, but clean and professional
- Remove long pauses and hesitations

Return ONLY the cleaned transcript, no additional commentary.`,
        },
        {
          role: 'user',
          content: `Please clean and format this transcript:\n\n${rawText}`,
        },
      ],
      temperature: 0.3, // Lower temperature for more consistent formatting
    })

    const cleaned = response.choices[0]?.message?.content?.trim()
    return cleaned || rawText // Fallback to raw text if cleaning fails
  } catch (error) {
    console.error('Error cleaning transcript with GPT:', error)
    // Fallback to raw transcript if GPT cleaning fails
    return rawText
  }
}

