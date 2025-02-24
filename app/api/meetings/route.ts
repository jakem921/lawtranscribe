import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/supabase'

export const GET = async () => {
  try {
    const meetings = await db.meetings.findMany()
    return NextResponse.json(meetings, { status: 200 })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to fetch meetings.' }, { status: 500 })
  }
}

export const POST = async (request: NextRequest) => {
  try {
    const data = await request.json()
    const meeting = await db.meetings.create(data)
    return NextResponse.json(meeting, { status: 201 })
  } catch (error: any) {
    console.error(error)
    return NextResponse.json({ error: 'Failed to create meeting.' }, { status: 500 })
  }
}
