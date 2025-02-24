# Law Transcribe Application Workflow Guide

## Overview
Law Transcribe is a sophisticated application designed to process, analyze, and interact with legal audio transcripts. This guide explains the complete workflow from audio upload to analysis and interaction.

## Table of Contents
1. [Audio Upload and Processing](#audio-upload-and-processing)
2. [Transcription Process](#transcription-process)
3. [Analysis Features](#analysis-features)
4. [Chat Functionality](#chat-functionality)
5. [Data Management](#data-management)

## Audio Upload and Processing

### Upload Component
The application provides a user-friendly upload interface that:
- Accepts audio files (MP3, WAV) and video files (MP4)
- Handles files up to 24MB
- Provides automatic compression for large files
- Extracts audio from video files
- Monitors existing files in the system

### File Processing
1. **Pre-processing**:
   - Large files are compressed using FFmpeg
   - Video files have audio extracted
   - Files are validated for size and format

2. **Storage**:
   - Processed files are saved in `public/uploads`
   - Unique filenames are generated using timestamps

## Transcription Process

### Transcription Service
The application uses Lemonfox API for transcription with features:
- Speaker diarization
- Word-level timestamps
- High accuracy for legal terminology
- Support for multiple languages

### Transcription Flow
1. Audio file is sent to Lemonfox API
2. API returns detailed JSON with:
   - Full transcript text
   - Speaker segments
   - Timestamps
   - Confidence scores

### Data Processing
The transcript is processed to extract:
- Meeting details
- Speaker information
- Timeline of events
- Key statements
- Tasks and follow-ups
- Questions and answers
- Insights and risks

## Analysis Features

### Available Analysis Types
1. **Sentiment Analysis**
   - Analyzes emotional tone
   - Interpersonal dynamics
   - Communication patterns

2. **Key Phrases**
   - Important statements
   - Legal terminology
   - Recurring themes

3. **Timeline Analysis**
   - Chronological event sequence
   - Time-stamped interactions
   - Event relationships

4. **Speaker Statistics**
   - Speaking patterns
   - Participation levels
   - Role identification

### Analysis Process
1. User selects analysis type
2. System processes transcript using OpenRouter API
3. Results are formatted with:
   - Structured sections
   - Visual formatting
   - Interactive elements

## Chat Functionality

### RAG-Based Chat System
The application implements a Retrieval-Augmented Generation (RAG) system:
- Uses ChromaDB for vector storage
- Implements semantic search
- Provides context-aware responses

### Chat Process
1. **Knowledge Base Initialization**:
   ```python
   # Transcript is split into chunks
   # Each chunk is embedded and stored in ChromaDB
   # Metadata is attached for retrieval
   ```

2. **Query Processing**:
   - User question is received
   - Relevant chunks are retrieved
   - Context is assembled
   - Response is generated using GPT-4

3. **Response Generation**:
   - Legal expertise is applied
   - Sources are cited
   - Clear explanations provided
   - Follow-up suggestions offered

## Data Management

### Database Structure
The application uses a relational database with models for:
- Meetings
- Tasks
- Decisions
- Questions
- Insights
- Deadlines
- Attendees
- Follow-ups
- Risks
- Agenda items

### Data Flow
```
Upload → Transcription → Analysis → Storage → Retrieval
   ↑                                            |
   |-------------------------------------------|
           (Interactive Features)
```

### Export Capabilities
- DOCX format export
- Structured document generation
- Complete meeting details
- Analysis results included

## Technical Components

### Frontend
- Next.js application
- React components
- Tailwind CSS styling
- Framer Motion animations

### Backend
- Node.js API routes
- Python processing scripts
- External API integrations
- Database management

### Services
1. **TranscriptionService**
   - Audio processing
   - Text generation
   - Metadata extraction

2. **AnalysisService**
   - Text analysis
   - Pattern recognition
   - Insight generation

3. **ChatService**
   - Vector storage
   - Context retrieval
   - Response generation

## Environment Setup

### Required Environment Variables
```env
LEMONFOX_API_KEY=your_key
OPENROUTER_API_KEY=your_key
DATABASE_URL=your_url
SITE_URL=your_url
SITE_NAME=your_name
```

### System Requirements
- Python 3.x
- Node.js
- FFmpeg
- ChromaDB
- SQLite/PostgreSQL

## Best Practices

### Audio Processing
- Compress large files
- Extract audio from video
- Validate file formats
- Handle errors gracefully

### Analysis
- Maintain objectivity
- Focus on facts
- Provide clear structure
- Include source references

### Chat Interaction
- Use context effectively
- Provide clear responses
- Cite sources
- Maintain expertise level

## Error Handling

### Common Issues
1. File Processing
   - Size limits
   - Format compatibility
   - Processing failures

2. Transcription
   - API failures
   - Quality issues
   - Timeout handling

3. Analysis
   - Context limits
   - Processing errors
   - Format issues

### Recovery Procedures
- Automatic retries
- Error logging
- User notifications
- Fallback options

## Maintenance

### Regular Tasks
- Monitor API usage
- Update dependencies
- Backup database
- Clean temporary files

### Performance Optimization
- Cache management
- Database indexing
- Query optimization
- Resource monitoring 