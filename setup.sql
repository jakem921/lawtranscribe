-- First, disable RLS on all tables
ALTER TABLE public."Meeting" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Task" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Decision" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Question" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Insight" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Deadline" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Attendee" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."FollowUp" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."Risk" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."AgendaItem" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."ChatConversation" DISABLE ROW LEVEL SECURITY;
ALTER TABLE public."ChatMessage" DISABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Enable all access for service role" ON public."Meeting";
DROP POLICY IF EXISTS "Enable all access for service role" ON public."Task";
DROP POLICY IF EXISTS "Enable all access for service role" ON public."Decision";
DROP POLICY IF EXISTS "Enable all access for service role" ON public."Question";
DROP POLICY IF EXISTS "Enable all access for service role" ON public."Insight";
DROP POLICY IF EXISTS "Enable all access for service role" ON public."Deadline";
DROP POLICY IF EXISTS "Enable all access for service role" ON public."Attendee";
DROP POLICY IF EXISTS "Enable all access for service role" ON public."FollowUp";
DROP POLICY IF EXISTS "Enable all access for service role" ON public."Risk";
DROP POLICY IF EXISTS "Enable all access for service role" ON public."AgendaItem";
DROP POLICY IF EXISTS "Enable all access for service role" ON public."ChatConversation";
DROP POLICY IF EXISTS "Enable all access for service role" ON public."ChatMessage";

-- Create timestamp trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updatedAt" = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Grant basic permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON SCHEMA public TO postgres;

-- Grant permissions to service_role (which is what we're using)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON SCHEMA public TO service_role;

-- Grant read access to anon and authenticated roles
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- Drop and recreate tables with proper timestamp handling
DROP TABLE IF EXISTS public."ChatMessage";
DROP TABLE IF EXISTS public."ChatConversation";

-- Create ChatConversation table with proper timestamp defaults
CREATE TABLE public."ChatConversation" (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    "meetingId" UUID NOT NULL REFERENCES public."Meeting"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- Create ChatMessage table with proper timestamp defaults
CREATE TABLE public."ChatMessage" (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    "conversationId" UUID NOT NULL REFERENCES public."ChatConversation"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- Create triggers for automatic timestamp updates
DROP TRIGGER IF EXISTS update_chat_conversation_updated_at ON public."ChatConversation";
DROP TRIGGER IF EXISTS update_chat_message_updated_at ON public."ChatMessage";

CREATE TRIGGER update_chat_conversation_updated_at
    BEFORE UPDATE ON public."ChatConversation"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chat_message_updated_at
    BEFORE UPDATE ON public."ChatMessage"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS after table creation
ALTER TABLE public."ChatConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ChatMessage" ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access
CREATE POLICY "Enable all access for service role" ON public."ChatConversation"
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for service role" ON public."ChatMessage"
    FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "chat_message_conversation_id_idx" ON public."ChatMessage"("conversationId");
CREATE INDEX IF NOT EXISTS "chat_conversation_meeting_id_idx" ON public."ChatConversation"("meetingId");
CREATE INDEX IF NOT EXISTS "chat_message_created_at_idx" ON public."ChatMessage"("createdAt");
CREATE INDEX IF NOT EXISTS "chat_conversation_created_at_idx" ON public."ChatConversation"("createdAt");

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS public."Meeting" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    "rawTranscript" TEXT,
    summary TEXT,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."Task" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task TEXT NOT NULL,
    owner TEXT,
    "dueDate" TIMESTAMP WITH TIME ZONE,
    "meetingId" UUID REFERENCES public."Meeting"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."Decision" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    decision TEXT NOT NULL,
    date TIMESTAMP WITH TIME ZONE,
    "meetingId" UUID REFERENCES public."Meeting"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."Question" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question TEXT NOT NULL,
    status TEXT,
    answer TEXT,
    "meetingId" UUID REFERENCES public."Meeting"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."Insight" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    insight TEXT NOT NULL,
    reference TEXT,
    "meetingId" UUID REFERENCES public."Meeting"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."Deadline" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    "dueDate" TIMESTAMP WITH TIME ZONE,
    "meetingId" UUID REFERENCES public."Meeting"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."Attendee" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    role TEXT,
    "meetingId" UUID REFERENCES public."Meeting"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."FollowUp" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    description TEXT NOT NULL,
    owner TEXT,
    "meetingId" UUID REFERENCES public."Meeting"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."Risk" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    risk TEXT NOT NULL,
    impact TEXT,
    "meetingId" UUID REFERENCES public."Meeting"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public."AgendaItem" (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item TEXT NOT NULL,
    "meetingId" UUID REFERENCES public."Meeting"(id) ON DELETE CASCADE,
    "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS after table creation
ALTER TABLE public."Meeting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Decision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Question" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Insight" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Deadline" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Attendee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."FollowUp" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Risk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AgendaItem" ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access
CREATE POLICY "Enable all access for service role" ON public."Meeting"
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for service role" ON public."Task"
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for service role" ON public."Decision"
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for service role" ON public."Question"
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for service role" ON public."Insight"
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for service role" ON public."Deadline"
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for service role" ON public."Attendee"
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for service role" ON public."FollowUp"
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for service role" ON public."Risk"
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Enable all access for service role" ON public."AgendaItem"
    FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS "meeting_created_at_idx" ON public."Meeting"("createdAt");
CREATE INDEX IF NOT EXISTS "task_meeting_id_idx" ON public."Task"("meetingId");
CREATE INDEX IF NOT EXISTS "decision_meeting_id_idx" ON public."Decision"("meetingId");
CREATE INDEX IF NOT EXISTS "question_meeting_id_idx" ON public."Question"("meetingId");
CREATE INDEX IF NOT EXISTS "insight_meeting_id_idx" ON public."Insight"("meetingId");
CREATE INDEX IF NOT EXISTS "deadline_meeting_id_idx" ON public."Deadline"("meetingId");
CREATE INDEX IF NOT EXISTS "attendee_meeting_id_idx" ON public."Attendee"("meetingId");
CREATE INDEX IF NOT EXISTS "followup_meeting_id_idx" ON public."FollowUp"("meetingId");
CREATE INDEX IF NOT EXISTS "risk_meeting_id_idx" ON public."Risk"("meetingId");
CREATE INDEX IF NOT EXISTS "agenda_meeting_id_idx" ON public."AgendaItem"("meetingId"); 