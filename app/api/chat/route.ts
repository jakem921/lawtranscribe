import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { meetingId, message, conversationId } = await request.json()

    if (!meetingId || !message) {
      return NextResponse.json(
        { error: 'Meeting ID and message are required' },
        { status: 400 }
      )
    }

    // Get meeting transcript
    const { data: meeting, error: meetingError } = await supabaseAdmin
      .from('Meeting')
      .select('rawTranscript')
      .eq('id', meetingId)
      .single()

    if (meetingError || !meeting) {
      return NextResponse.json(
        { error: 'Meeting not found' },
        { status: 404 }
      )
    }

    // Get or create conversation
    let conversation
    if (conversationId) {
      const { data: existingConv, error: convError } = await supabaseAdmin
        .from('ChatConversation')
        .select('*, messages:ChatMessage(*)')
        .eq('id', conversationId)
        .single()

      if (convError) {
        // If conversation not found, create a new one
        const { data: newConv, error: createError } = await supabaseAdmin
          .from('ChatConversation')
          .insert([{ meetingId }])
          .select()
          .single()

        if (createError) {
          console.error('Error creating conversation:', createError)
          throw createError
        }
        conversation = newConv
      } else {
        conversation = existingConv
      }
    } else {
      // Create new conversation
      const { data: newConv, error: createError } = await supabaseAdmin
        .from('ChatConversation')
        .insert([{ meetingId }])
        .select()
        .single()

      if (createError) {
        console.error('Error creating conversation:', createError)
        throw createError
      }
      conversation = newConv
    }

    // Create a temporary file to store the chat data
    const tempDataPath = path.join(process.cwd(), 'public', 'uploads', `${Date.now()}-chat-data.json`)
    const fs = require('fs')
    fs.writeFileSync(tempDataPath, JSON.stringify({
      transcript: meeting.rawTranscript,
      meeting_id: meetingId,
      query: message,
      conversation_id: conversation.id  // Use the actual database conversation ID
    }))

    // Run the Python script
    const pythonScript = path.join(process.cwd(), 'app', 'api', 'chat', 'chat.py')
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
      console.error('Python script error:', errorData)
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

    const response = JSON.parse(outputData)

    // Store the user message and AI response in the database
    const { error: messagesError } = await supabaseAdmin
      .from('ChatMessage')
      .insert([
        {
          role: 'user',
          content: message,
          conversationId: conversation.id
        },
        {
          role: 'assistant',
          content: response.response,
          conversationId: conversation.id
        }
      ])

    if (messagesError) {
      console.error('Error creating messages:', messagesError)
      throw messagesError
    }

    return NextResponse.json({
      ...response,
      metadata: {
        ...response.metadata,
        conversation_id: conversation.id  // Return the actual database conversation ID
      }
    })

  } catch (error: any) {
    console.error('Chat error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process chat request' },
      { status: 500 }
    )
  }
} 