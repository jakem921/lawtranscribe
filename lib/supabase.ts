import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client for frontend (limited access)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Admin client for backend operations (full access)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js/2.39.7',
      Authorization: `Bearer ${supabaseServiceKey}`
    }
  },
  db: {
    schema: 'public'
  }
})

// Helper functions for common database operations
export const db = {
  meetings: {
    async findMany() {
      const { data, error } = await supabaseAdmin
        .from('Meeting')
        .select('*')
      if (error) {
        console.error('Error fetching meetings:', error)
        throw error
      }
      return data
    },
    
    async findUnique(id: string) {
      const { data, error } = await supabaseAdmin
        .from('Meeting')
        .select(`
          *,
          tasks:Task(*),
          decisions:Decision(*),
          questions:Question(*),
          insights:Insight(*),
          deadlines:Deadline(*),
          attendees:Attendee(*),
          followUps:FollowUp(*),
          risks:Risk(*),
          agenda:AgendaItem(*)
        `)
        .eq('id', id)
        .single()
      if (error) {
        console.error('Error fetching meeting:', error)
        throw error
      }
      return data
    },
    
    async create(data: any) {
      const { data: meeting, error } = await supabaseAdmin
        .from('Meeting')
        .insert([data])
        .select()
      if (error) {
        console.error('Error creating meeting:', error)
        throw error
      }
      return meeting[0]
    }
  }
} 