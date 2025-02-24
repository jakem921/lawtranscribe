import requests
import json
import os
from typing import Dict, Any, Tuple
from datetime import datetime

class TranscriptionService:
    def __init__(self):
        self.lemonfox_api_key = os.environ.get('LEMONFOX_API_KEY')
        if not self.lemonfox_api_key:
            raise ValueError("LEMONFOX_API_KEY environment variable is not set")
        
        self.headers = {
            "Authorization": f"Bearer {self.lemonfox_api_key}"
        }
        self.transcribe_endpoint = "https://api.lemonfox.ai/v1/audio/transcriptions"
        
    async def transcribe_audio(self, audio_data: bytes, filename: str) -> Dict[str, Any]:
        """
        Transcribe audio using Lemonfox API with detailed output
        """
        try:
            # Prepare the request payload
            files = {
                "file": (filename, audio_data)
            }
            data = {
                "response_format": "verbose_json",  # Get the most detailed output
                "speaker_labels": "true",  # Enable speaker diarization
                "language": "english",  # Specify language for better accuracy
                "timestamp_granularities[]": "word",  # Enable word-level timestamps
                "prompt": "Legal proceeding transcript with precise punctuation and speaker identification.",  # Guide transcription style
            }
            
            # Make the API call
            response = requests.post(
                self.transcribe_endpoint,
                headers=self.headers,
                files=files,
                data=data,
                timeout=300  # Increased timeout for larger files
            )
            
            if response.status_code != 200:
                raise Exception(f"Transcription failed: {response.text}")
            
            return response.json()
                
        except Exception as e:
            raise Exception(f"Error in transcription: {str(e)}")
            
    async def analyze_transcript(self, transcript_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze the transcript data and structure it for our needs
        """
        try:
            # Extract full text and metadata
            full_text = transcript_data.get('text', '')
            duration = transcript_data.get('duration', 0)
            language = transcript_data.get('language', 'english')
            
            # Get segments with speaker information and timestamps
            segments = transcript_data.get('segments', [])
            
            # Format the transcript in screenplay style with preserved formatting
            formatted_lines = []
            
            # Add header with proper spacing
            formatted_lines.extend([
                "LEGAL PROCEEDING TRANSCRIPT",
                f"Duration: {duration:.2f} seconds",
                "=" * 50,
                "",  # Empty line after header
            ])
            
            current_speaker = None
            current_dialogue = []
            
            for segment in segments:
                speaker = segment.get('speaker', 'Unknown')
                start_time = segment.get('start', 0)
                text = segment.get('text', '').strip()
                
                # Skip empty text
                if not text:
                    continue
                    
                # Skip repeated "transcript with precise punctuation" messages
                if "transcript with precise punctuation" in text.lower():
                    continue
                
                # Format timestamp as [MM:SS]
                minutes = int(start_time) // 60
                seconds = int(start_time) % 60
                timestamp = f"[{minutes:02d}:{seconds:02d}]"
                
                # If speaker changes, output accumulated dialogue
                if current_speaker and speaker != current_speaker:
                    formatted_lines.append(f"{current_speaker}:")
                    formatted_lines.extend([f"    {line}" for line in current_dialogue])
                    formatted_lines.append("")  # Add empty line between speakers
                    current_dialogue = []
                
                # Add new line to current dialogue
                current_speaker = speaker
                current_dialogue.append(f"{timestamp} {text}")
            
            # Output final speaker's dialogue
            if current_dialogue:
                formatted_lines.append(f"{current_speaker}:")
                formatted_lines.extend([f"    {line}" for line in current_dialogue])
                formatted_lines.append("")  # Add empty line at the end
            
            # Join with explicit newlines and double spacing between speakers
            formatted_transcript = "\n".join(formatted_lines)
            
            # Structure the analysis
            analysis = {
                "Meeting Name": "Legal Recording Transcript",
                "Description": f"Audio transcription ({duration:.2f} seconds) with speaker identification",
                "Summary": full_text[:500] + "..." if len(full_text) > 500 else full_text,
                "Language": language,
                "Duration": duration,
                "Speakers": self._extract_speakers(segments),
                "FormattedTranscript": formatted_transcript,
                "RawSegments": segments,  # Include full segment data
                "Tasks": [],
                "Decisions": [],
                "Questions": [],
                "Insights": [],
                "Deadlines": [],
                "Follow-ups": [],
                "Risks": [],
                "Agenda": []
            }
            
            return analysis
                
        except Exception as e:
            raise Exception(f"Error in analysis: {str(e)}")
    
    def _extract_speakers(self, segments: list) -> list:
        """
        Extract unique speakers from the transcript segments with their timing information
        """
        speakers = {}
        for segment in segments:
            speaker = segment.get('speaker')
            if speaker:
                if speaker not in speakers:
                    speakers[speaker] = {
                        "name": f"Speaker {speaker}",
                        "role": "Speaker",
                        "segments": []
                    }
                speakers[speaker]["segments"].append({
                    "start": segment.get('start'),
                    "end": segment.get('end'),
                    "text": segment.get('text')
                })
        
        return [{"name": info["name"], "role": info["role"], "segments": info["segments"]} 
                for speaker, info in sorted(speakers.items())]
            
    async def process_audio(self, audio_data: bytes, filename: str) -> Tuple[Dict[str, Any], str]:
        """
        Process audio file through the complete pipeline:
        1. Transcribe audio with detailed output
        2. Analyze transcript
        """
        # Get the detailed transcription
        transcript_data = await self.transcribe_audio(audio_data, filename)
        
        # Analyze the transcript with all available data
        analysis = await self.analyze_transcript(transcript_data)
        
        # Return both the analysis and the formatted transcript
        return analysis, analysis["FormattedTranscript"] 