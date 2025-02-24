import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'

const SYSTEM_PROMPT = `You are an expert legal transcript analyzer specializing in criminal defense contexts. You analyze recorded evidence including police body cam footage, suspect interviews, witness interviews, and jailhouse recordings. Your task is to produce an informational analysis to help criminal defense attorneys quickly understand the content. You do not provide legal advice, strategy, or opinions on guilt/innocence—only factual observations, summaries, and organizational details.

Your analysis must be purely informational and objective, focusing on facts and observable details while maintaining strict neutrality.

Important Guidelines:
1. **Absolute Accuracy:**
   - Only make statements that are directly supported by the transcript content
   - Include exact timestamps when referencing transcript content
   - If information is ambiguous or unclear, explicitly state this

2. **Zero Assumptions:**
   - Never make assumptions about content not present in the transcript
   - Do not fill in gaps with probable or possible information

3. **Explicit Verification:**
   - When citing dialogue or events, always include timestamps
   - Double-check all references before including them
   - If exact matches are found, cite them directly

4. **Error Prevention:**
   - If uncertain about any detail, express that uncertainty clearly
   - Prefer saying "insufficient information" over making assumptions`

const BASE_PROMPT = `Analyze this transcript from the perspective of a criminal defense context and provide a structured summary as a JSON object with the following **exact** keys:

1. RecordingName: A concise, descriptive name inferred from context.
2. Description: A brief overview of the transcript contents.
3. Summary: A factual, detailed summary of key events (3–4 paragraphs). Avoid speculation or legal advice.
4. Speakers: A list of speakers and their roles (e.g., suspect, officer, witness, etc.).
5. Timeline: A chronological breakdown with timestamps or approximate markers.
6. KeyStatements: Important dialogue or statements made, particularly those relevant to criminal defense attorneys (e.g., references to charges, admissions, or legal procedures).
7. Tasks: Any administrative or procedural follow-up items mentioned (or an empty array).
8. Decisions: Explicit decisions or conclusions arrived at during the recording (or an empty array).
9. Questions: Direct questions asked and any answers provided (or an empty array).
10. Insights: Factual observations about interactions or procedural elements (e.g., mentions of Miranda rights, chain of custody, search procedures) without implying legal conclusions.
11. Deadlines: Time-sensitive elements mentioned (or an empty array).
12. FollowUps: Implied future actions or steps to be taken (or an empty array).
13. Risks: Potential issues, conflicts, or concerns mentioned (or an empty array).
14. Agenda: Primary topics or objectives discussed (or an empty array).

Important: Base your response ONLY on the exact content provided in the context. If you're mentioning specific quotes or timestamps, they MUST be present in the provided context. Do not make assumptions or fill in missing information.`

type AnalysisType = 'coercion' | 'keyphrases' | 'timeline' | 'speakers'

const ANALYSIS_TYPE_PROMPTS: Record<AnalysisType, string> = {
  coercion: `Additionally, identify signs of coercion, duress, or pressure within the transcript. Highlight moments where a speaker hesitates, contradicts themselves, or appears misled or intimidated. Note if Miranda rights were properly read and understood. Do not speculate on intent—only report observable indicators with exact timestamps.`,
  
  keyphrases: `Additionally, identify statements that may be self-incriminating, exculpatory, or legally significant. Highlight contradictions, key admissions, and any unclear statements that could be misinterpreted. Do not provide legal conclusions—only highlight relevant excerpts with exact timestamps.`,
  
  timeline: `Additionally, construct a detailed legal timeline focusing on procedural events such as Miranda rights being read, lawyer requests, detainment periods, searches, and confessions. Identify any inconsistencies, delays, or missing procedural steps. Report only factual sequences with exact timestamps.`,
  
  speakers: `Additionally, analyze power dynamics between speakers. Identify any instances of leading questions, persistent questioning loops, or intimidation tactics. Note if any speaker significantly alters their statement after pressure. Do not interpret motivations—only report factual observations with exact timestamps.`
}

export async function POST(request: NextRequest) {
  try {
    const { transcript, analysisType } = await request.json()

    if (!transcript) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 })
    }

    // Create a temporary file to store the analysis data
    const tempDataPath = path.join(process.cwd(), 'public', 'uploads', `${Date.now()}-analysis-data.json`)
    fs.writeFileSync(tempDataPath, JSON.stringify({
      transcript,
      analysis_type: analysisType,
      system_prompt: SYSTEM_PROMPT,
      base_prompt: BASE_PROMPT,
      type_prompt: analysisType && (analysisType in ANALYSIS_TYPE_PROMPTS) 
        ? ANALYSIS_TYPE_PROMPTS[analysisType as AnalysisType] 
        : ''
    }))

    // Run the Python script for analysis
    const pythonScript = path.join(process.cwd(), 'app', 'api', 'analyze', 'analyze.py')
    const pythonProcess = spawn('python3', [pythonScript, tempDataPath])

    let outputData = ''
    let errorData = ''

    // Collect data from stdout
    pythonProcess.stdout.on('data', (data) => {
      outputData += data.toString()
    })

    // Collect data from stderr
    pythonProcess.stderr.on('data', (data) => {
      errorData += data.toString()
      console.error('Python script error:', errorData)  // Log errors for debugging
    })

    // Wait for the process to complete
    const exitCode = await new Promise((resolve) => {
      pythonProcess.on('close', resolve)
    })

    // Clean up temporary file
    fs.unlinkSync(tempDataPath)

    if (exitCode !== 0) {
      console.error('Python script failed:', errorData)
      throw new Error(`Python script failed with error: ${errorData}`)
    }

    try {
      // Parse the output
      const response = JSON.parse(outputData)
      return NextResponse.json(response)
    } catch (error) {
      console.error('Failed to parse Python script output:', error, outputData)
      throw new Error('Failed to parse analysis response')
    }

  } catch (error: any) {
    console.error('Analysis error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to analyze transcript' },
      { status: 500 }
    )
  }
} 