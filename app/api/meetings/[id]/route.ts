import { NextRequest, NextResponse } from 'next/server'
import { db, supabaseAdmin } from '@/lib/supabase'

export const GET = async (request: NextRequest, { params }: { params: { id: string } }) => {
  const { id } = params

  try {
    const meeting = await db.meetings.findUnique(id)

    if (!meeting) {
      return NextResponse.json({ error: 'Meeting not found.' }, { status: 404 })
    }

    const formattedMeeting = {
      name: meeting.name,
      description: meeting.description,
      transcript: meeting.rawTranscript,
      summary: meeting.summary,
      breakdown: {
        Tasks: meeting.tasks?.map((task: { task: any; owner: any; dueDate: any }) => ({ task: task.task, owner: task.owner, due_date: task.dueDate })) || [],
        Decisions: meeting.decisions?.map((decision: { decision: any; date: any }) => ({ decision: decision.decision, date: decision.date })) || [],
        Questions: meeting.questions?.map((question: { question: any; status: any; answer: any }) => ({ question: question.question, status: question.status, answer: question.answer })) || [],
        Insights: meeting.insights?.map((insight: { insight: any; reference: any }) => ({ insight: insight.insight, reference: insight.reference })) || [],
        Deadlines: meeting.deadlines?.map((deadline: { description: any; dueDate: any }) => ({ description: deadline.description, due_date: deadline.dueDate })) || [],
        Attendees: meeting.attendees?.map((attendee: { name: any; role: any }) => ({ name: attendee.name, role: attendee.role })) || [],
        "Follow-ups": meeting.followUps?.map((followUp: { description: any; owner: any }) => ({ description: followUp.description, owner: followUp.owner })) || [],
        Risks: meeting.risks?.map((risk: { risk: any; impact: any }) => ({ risk: risk.risk, impact: risk.impact })) || [],
        Agenda: meeting.agenda?.map((item: { item: any }) => ({ item: item.item })) || [],
      },
    }
    return NextResponse.json(formattedMeeting, { status: 200 })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch meeting details.' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  try {
    // Delete all associated records in parallel
    const tables = ['Task', 'Decision', 'Question', 'Insight', 'Deadline', 'Attendee', 'FollowUp', 'Risk', 'AgendaItem']
    await Promise.all([
      ...tables.map(table => 
        supabaseAdmin.from(table).delete().eq('meetingId', id)
      ),
      supabaseAdmin.from('Meeting').delete().eq('id', id)
    ])

    return NextResponse.json({ message: 'Meeting deleted successfully' }, { status: 200 })
  } catch (error) {
    console.error('Error deleting meeting:', error)
    return NextResponse.json({ error: 'Failed to delete meeting' }, { status: 500 })
  }
}
