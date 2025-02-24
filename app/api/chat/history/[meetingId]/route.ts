import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  try {
    const meetingId = params.meetingId

    // Get the latest conversation for this meeting with its messages
    const { data: conversation, error: convError } = await supabaseAdmin
      .from('ChatConversation')
      .select(`
        id,
        messages:ChatMessage(
          id,
          role,
          content,
          createdAt
        )
      `)
      .eq('meetingId', meetingId)
      .order('createdAt', { ascending: false })
      .limit(1)
      .single()

    if (convError) {
      if (convError.code === 'PGRST116') {
        // No conversation found - return empty history
        return NextResponse.json({
          messages: [],
          conversationId: null
        })
      }
      throw convError
    }

    // Sort messages by creation time if they exist
    const messages = conversation?.messages?.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    ) || []

    return NextResponse.json({
      messages,
      conversationId: conversation?.id || null
    })

  } catch (error: any) {
    console.error('Error fetching chat history:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch chat history' },
      { status: 500 }
    )
  }
} 