import base64
from typing import Dict, Any, Tuple
import httpx
import json
import os
from datetime import datetime

class TranscriptionService:
    def __init__(self):
        self.groq_api_key = os.environ.get('GROQ_API_KEY')
        if not self.groq_api_key:
            raise ValueError("GROQ_API_KEY environment variable is not set")
        
        self.headers = {
            "Authorization": f"Bearer {self.groq_api_key}",
            "Content-Type": "application/json"
        }
        self.whisper_endpoint = "https://api.groq.com/openai/v1/audio/transcriptions"
        self.chat_endpoint = "https://api.groq.com/openai/v1/chat/completions"
        
    async def transcribe_audio(self, audio_data: bytes, filename: str) -> str:
        """
        Transcribe audio using Groq's Whisper model
        """
        try:
            # Convert audio data to base64
            audio_base64 = base64.b64encode(audio_data).decode('utf-8')
            
            # Prepare the request payload
            payload = {
                "file": audio_base64,
                "model": "whisper-1",
                "response_format": "text"
            }
            
            # Make the API call
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.whisper_endpoint,
                    headers=self.headers,
                    json=payload,
                    timeout=180.0
                )
                
                if response.status_code != 200:
                    raise Exception(f"Transcription failed: {response.text}")
                
                return response.text
                
        except Exception as e:
            raise Exception(f"Error in transcription: {str(e)}")
            
    async def analyze_transcript(self, transcript: str) -> Dict[str, Any]:
        """
        Analyze the transcript using Groq's LLM
        """
        system_prompt = """You are an AI assistant that analyzes meeting transcripts. Extract and structure the following information:
        1. Meeting Name (infer from context)
        2. Description (brief overview)
        3. Summary (key points)
        4. Tasks (with owners and due dates if mentioned)
        5. Decisions made
        6. Questions raised (with status and answers if available)
        7. Key insights
        8. Deadlines mentioned
        9. Attendees (with roles if mentioned)
        10. Follow-up items
        11. Risks identified
        12. Agenda items discussed

        Format the response as a JSON object with these keys. If any information is not present, include an empty array or appropriate default value."""

        try:
            payload = {
                "model": "mixtral-8x7b-32768",
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": f"Here's the transcript to analyze:\n\n{transcript}"}
                ],
                "temperature": 0.7,
                "max_tokens": 4000
            }
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.chat_endpoint,
                    headers=self.headers,
                    json=payload,
                    timeout=180.0
                )
                
                if response.status_code != 200:
                    raise Exception(f"Analysis failed: {response.text}")
                
                result = response.json()
                analysis = json.loads(result['choices'][0]['message']['content'])
                return analysis
                
        except Exception as e:
            raise Exception(f"Error in analysis: {str(e)}")
            
    async def process_audio(self, audio_data: bytes, filename: str) -> Tuple[Dict[str, Any], str]:
        """
        Process audio file through the complete pipeline:
        1. Transcribe audio
        2. Analyze transcript
        """
        # Get the transcription
        transcript = await self.transcribe_audio(audio_data, filename)
        
        # Analyze the transcript
        analysis = await self.analyze_transcript(transcript)
        
        return analysis, transcript 