import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { meetingId: string } }
) {
  try {
    const meetingId = params.meetingId

    // Get all conversations for this meeting with their messages
    const { data: conversations, error: convError } = await supabaseAdmin
      .from('ChatConversation')
      .select(`
        id,
        createdAt,
        messages:ChatMessage(
          id,
          role,
          content,
          createdAt
        )
      `)
      .eq('meetingId', meetingId)
      .order('createdAt', { ascending: false })

    if (convError) {
      throw convError
    }

    // Sort messages within each conversation by creation time
    const sortedConversations = conversations?.map(conv => ({
      ...conv,
      messages: conv.messages.sort((a: any, b: any) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    })) || []

    return NextResponse.json({
      conversations: sortedConversations
    })

  } catch (error: any) {
    console.error('Error fetching conversations:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
} 