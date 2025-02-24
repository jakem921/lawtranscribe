import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { supabaseAdmin } from '@/lib/supabase'
import { spawn } from 'child_process'

export const POST = async (request: NextRequest) => {
  try {
    console.log('=== TRANSCRIPTION API START ===');
    console.log('Received POST request to /api/transcribe')
    const formData = await request.formData()
    const file = formData.get('audio') as File
    const fullPath = formData.get('fullPath') as string

    console.log('=== FILE DETAILS ===');
    console.log({
      name: file?.name,
      type: file?.type,
      size: file?.size,
      path: fullPath
    });

    if (!file) {
      console.error('❌ No audio file provided')
      return NextResponse.json({ error: 'No audio file provided.' }, { status: 400 })
    }

    // Convert File to Buffer
    console.log('=== PROCESSING FILE ===');
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    console.log('Buffer size:', buffer.length, 'bytes')

    // Define directory
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    console.log('Upload directory:', uploadsDir)

    // Ensure directory exists
    try {
      if (!fs.existsSync(uploadsDir)) {
        console.log('Creating uploads directory...')
        fs.mkdirSync(uploadsDir, { recursive: true })
      }
    } catch (error) {
      console.error('Error creating uploads directory:', error)
      return NextResponse.json({ error: 'Failed to create uploads directory.' }, { status: 500 })
    }

    // Save the file
    const fileName = `${Date.now()}-${file.name}`
    const filePath = path.join(uploadsDir, fileName)
    try {
      fs.writeFileSync(filePath, buffer)
      console.log('File saved successfully at:', filePath)
    } catch (error) {
      console.error('Error saving file:', error)
      return NextResponse.json({ error: 'Failed to save audio file.' }, { status: 500 })
    }

    // Process the audio using Python script
    try {
      console.log('Processing audio with transcription service...')
      
      // Create a temporary file to store the audio data
      const tempDataPath = path.join(uploadsDir, `${Date.now()}-data.json`)
      fs.writeFileSync(tempDataPath, JSON.stringify({
        audio_path: filePath,
        filename: file.name
      }))

      // Run the Python script
      const pythonScript = path.join(process.cwd(), 'python', 'transcribe.py')
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
      })

      // Wait for the process to complete
      const exitCode = await new Promise((resolve) => {
        pythonProcess.on('close', resolve)
      })

      // Clean up temporary file
      fs.unlinkSync(tempDataPath)

      if (exitCode !== 0) {
        throw new Error(`Python script failed with error: ${errorData}`)
      }

      // Parse the output
      const { analysis, transcript } = JSON.parse(outputData)
      
      console.log('Transcription and analysis completed successfully')
      console.log('Analyzed Data:', JSON.stringify(analysis, null, 2))
      console.log('Saving to database...')

      // Helper function to format dates as ISO strings
      const formatDate = (date: string) => {
        const parsedDate = new Date(date)
        return !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : null
      }

      // Save to database with safe access
      const { data: meeting, error: meetingError } = await supabaseAdmin
        .from('Meeting')
        .insert([{
          name: analysis['Meeting Name'] || 'Untitled Meeting',
          description: analysis['Description'] || 'No description provided.',
          rawTranscript: transcript,
          summary: analysis['Summary'] || ''
        }])
        .select()
        .single()

      if (meetingError) throw meetingError

      // Create related records in parallel
      await Promise.all([
        // Tasks
        supabaseAdmin.from('Task').insert(
          (analysis['Tasks'] || [])
            .filter((task: any) => task && typeof task === 'object')
            .map((task: any) => ({
              meetingId: meeting.id,
              task: task.description || 'No task description',
              owner: task.owner || 'Unassigned',
              dueDate: task.due_date ? formatDate(task.due_date) : null,
            }))
        ),

        // Decisions
        supabaseAdmin.from('Decision').insert(
          (analysis['Decisions'] || [])
            .filter((decision: any) => decision && typeof decision === 'object')
            .map((decision: any) => ({
              meetingId: meeting.id,
              decision: decision.description || 'No decision description',
              date: decision.date ? formatDate(decision.date) : new Date().toISOString(),
            }))
        ),

        // Questions
        supabaseAdmin.from('Question').insert(
          (analysis['Questions'] || [])
            .filter((question: any) => question && typeof question === 'object')
            .map((question: any) => ({
              meetingId: meeting.id,
              question: question.question || 'No question',
              status: question.status || 'Unanswered',
              answer: question.answer || '',
            }))
        ),

        // Insights
        supabaseAdmin.from('Insight').insert(
          (analysis['Insights'] || [])
            .filter((insight: any) => insight && typeof insight === 'object')
            .map((insight: any) => ({
              meetingId: meeting.id,
              insight: insight.insight || 'No insight',
              reference: insight.reference || '',
            }))
        ),

        // Deadlines
        supabaseAdmin.from('Deadline').insert(
          (analysis['Deadlines'] || [])
            .filter((deadline: any) => deadline && typeof deadline === 'object')
            .map((deadline: any) => ({
              meetingId: meeting.id,
              description: deadline.description || 'No deadline description',
              dueDate: deadline.date ? formatDate(deadline.date) : null,
            }))
        ),

        // Attendees
        supabaseAdmin.from('Attendee').insert(
          (analysis['Speakers'] || [])
            .filter((speaker: any) => speaker && typeof speaker === 'object')
            .map((speaker: any) => ({
              meetingId: meeting.id,
              name: speaker.name || 'Unnamed Speaker',
              role: speaker.role || 'Speaker',
            }))
        ),

        // Follow-ups
        supabaseAdmin.from('FollowUp').insert(
          (analysis['Follow-ups'] || [])
            .filter((followUp: any) => followUp && typeof followUp === 'object')
            .map((followUp: any) => ({
              meetingId: meeting.id,
              description: followUp.description || 'No follow-up description',
              owner: followUp.owner || 'Unassigned',
            }))
        ),

        // Risks
        supabaseAdmin.from('Risk').insert(
          (analysis['Risks'] || [])
            .filter((risk: any) => risk && typeof risk === 'object')
            .map((risk: any) => ({
              meetingId: meeting.id,
              risk: risk.risk || 'No risk description',
              impact: risk.impact || 'No impact specified',
            }))
        ),

        // Agenda items
        supabaseAdmin.from('AgendaItem').insert(
          (analysis['Agenda'] || [])
            .filter((item: any) => item && typeof item === 'string')
            .map((item: string) => ({
              meetingId: meeting.id,
              item: item,
            }))
        ),
      ])

      console.log('Meeting saved successfully:', meeting.id)

      return NextResponse.json({ success: true }, { status: 200 })
    } catch (error: any) {
      console.error('Transcription service error:', {
        message: error.message,
        stack: error.stack
      });
      return NextResponse.json({ 
        error: 'Transcription service error',
        details: error.message
      }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Error in /api/transcribe:', {
      message: error.message,
      stack: error.stack
    });
    return NextResponse.json({ 
      error: 'An error occurred during processing.',
      details: error.message
    }, { status: 500 });
  }
}