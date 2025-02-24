# Backend Architecture Overview

## API Endpoints

### 1. `/api/transcribe` (POST)
- **Purpose**: Handles audio file uploads and transcription
- **Workflow**:
  1. Receives audio file via FormData
  2. Saves file to `public/uploads` directory
  3. Processes audio using Python transcription service
  4. Saves structured data to database using Prisma
  5. Creates related entries for tasks, decisions, questions, etc.

### 2. `/api/analyze` (POST)
- **Purpose**: Handles transcript analysis using OpenRouter API
- **Workflow**:
  1. Receives transcript and analysis type
  2. Sends request to OpenRouter API with specialized prompts
  3. Returns structured analysis with sections like timeline, key statements, etc.

### 3. `/api/chat` (POST)
- **Purpose**: Provides RAG-based chat functionality for meeting transcripts
- **Workflow**:
  1. Receives meeting ID and user message
  2. Retrieves meeting transcript from database
  3. Uses RAGable to process query against transcript context
  4. Returns AI response with relevant source citations
- **Request Body**:
  ```json
  {
    "meetingId": "string",
    "message": "string"
  }
  ```
- **Response**:
  ```json
  {
    "response": "AI generated response",
    "sources": ["Relevant transcript excerpts"],
    "metadata": {
      "meeting_id": "string",
      "confidence": number
    }
  }
  ```

### 4. `/api/meetings/:id/export` (GET)
- **Purpose**: Handles exporting meeting details as DOCX
- **Functionality**: Returns downloadable document with meeting analysis

### 5. `/api/monitored-files` (GET)
- **Purpose**: Lists available audio files in the monitored directory
- **Usage**: Used by the upload component to show existing files

## Database Integration

- **ORM**: Prisma
- **Schema Tables**:
  - Meetings (main record)
  - Tasks
  - Decisions
  - Questions
  - Insights
  - Deadlines
  - Attendees
  - Follow-ups
  - Risks
  - Agenda items

## Service Layer

### 1. TranscriptionService (Python)
- **Purpose**: Handles audio transcription using Lemonfox API
- **Features**:
  - Speaker diarization
  - Timestamps
  - Full text transcription
  - Structured segments

### 2. Analysis Service (via OpenRouter)
- **Purpose**: Processes transcripts for different types of analysis
- **Analysis Types**:
  - Sentiment analysis
  - Key phrase extraction
  - Timeline analysis
  - Speaker statistics

### 3. ChatService (Python)
- **Purpose**: Provides RAG-based chat functionality
- **Features**:
  - Transcript chunking and embedding
  - Vector storage using ChromaDB
  - Context-aware responses using OpenAI
  - Source citation and metadata tracking

## Data Flow
```
Client -> API Routes -> Services -> External APIs -> Database
   ↑                                                   |
   |--------------------------------------------------|
           (Data fetched and displayed in UI)
```

## Environment Configuration
- `LEMONFOX_API_KEY`: For transcription
- `OPENROUTER_API_KEY`: For analysis
- `OPENAI_API_KEY`: For RAG chat functionality
- `DATABASE_URL`: SQLite database location
- `SITE_URL` and `SITE_NAME`: For API identification

## File Storage
- Audio files stored in `public/uploads`
- Temporary JSON files for data transfer between Node.js and Python
- Vector store data in `./data/chromadb`
- Database stores text and metadata only

## System Requirements
- Python 3.x for transcription service
- Node.js for API server
- SQLite for database
- FFmpeg for audio processing
- ChromaDB for vector storage 