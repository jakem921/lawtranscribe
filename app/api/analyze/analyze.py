#!/usr/bin/env python3
import asyncio
import json
import sys
import logging
import re
from chromadb import PersistentClient, Settings
from chromadb.utils import embedding_functions
import os
import httpx
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('analysis.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class AnalysisService:
    def __init__(self):
        self.openrouter_api_key = os.environ.get('OPENROUTER_API_KEY')
        if not self.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY environment variable is not set")
        
        # Ensure ChromaDB directory exists with absolute path
        persist_directory = os.path.abspath(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), 'data', 'chromadb'))
        os.makedirs(persist_directory, exist_ok=True)
        logger.info(f"Using ChromaDB directory: {persist_directory}")
        
        # Initialize ChromaDB with persistent client
        self.client = PersistentClient(
            path=persist_directory,
            settings=Settings(
                anonymized_telemetry=False,
                is_persistent=True
            )
        )
        
        self.embedding_function = embedding_functions.DefaultEmbeddingFunction()
        
        # Headers for OpenRouter API
        self.headers = {
            "Authorization": f"Bearer {self.openrouter_api_key}",
            "HTTP-Referer": os.environ.get('SITE_URL', 'http://localhost:3000'),
            "X-Title": os.environ.get('SITE_NAME', 'Law Transcribe'),
            "Content-Type": "application/json"
        }

    async def initialize_knowledge(self, transcript: str, analysis_id: str):
        """
        Initialize the knowledge base with a transcript for analysis
        """
        try:
            # Get or create collection for transcript chunks
            collection_name = f"analysis_{analysis_id}"
            logger.info(f"Creating/getting collection: {collection_name}")
            collection = self.client.get_or_create_collection(
                name=collection_name,
                embedding_function=self.embedding_function
            )
            
            # Split transcript into chunks and add to collection
            chunks = self._chunk_transcript(transcript)
            ids = [f"chunk_{i}" for i in range(len(chunks))]
            metadatas = [{"analysis_id": analysis_id} for _ in chunks]
            
            # Add chunks to collection
            collection.add(
                documents=chunks,
                ids=ids,
                metadatas=metadatas
            )
            logger.info(f"Added {len(chunks)} chunks to collection {collection_name}")
            return True
        except Exception as e:
            logger.error(f"Error initializing knowledge: {str(e)}")
            return False

    async def analyze_transcript(self, transcript: str, system_prompt: str, base_prompt: str, type_prompt: str = "") -> dict:
        """
        Analyze transcript using RAG with OpenRouter
        """
        try:
            # Create unique analysis ID
            analysis_id = f"analysis_{datetime.now().timestamp()}"
            
            # Initialize knowledge base
            success = await self.initialize_knowledge(transcript, analysis_id)
            if not success:
                raise Exception("Failed to initialize knowledge base")
            
            # Get collection
            collection_name = f"analysis_{analysis_id}"
            logger.info(f"Accessing collection: {collection_name}")
            collection = self.client.get_or_create_collection(
                name=collection_name,
                embedding_function=self.embedding_function
            )
            
            # Get all chunks for comprehensive analysis
            all_chunks = collection.get()
            if not all_chunks['documents']:
                raise Exception("No chunks found in collection")
                
            context = "\n\n".join(all_chunks['documents'])
            
            # Prepare messages
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"{base_prompt}\n\n{type_prompt}\n\nTranscript Context:\n{context}\n\nImportant: Base your response ONLY on the exact content provided in the context. If you're mentioning specific quotes or timestamps, they MUST be present in the provided context. Do not make assumptions or fill in missing information."}
            ]
            
            logger.info("Sending request to OpenRouter API")
            
            # Make request to OpenRouter API
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=self.headers,
                    json={
                        "model": "openai/gpt-4-turbo-preview",
                        "messages": messages,
                        "temperature": 0.3,
                        "max_tokens": 4000,
                        "response_format": { "type": "json_object" }
                    },
                    timeout=60.0
                )
                
                if response.status_code != 200:
                    raise Exception(f"OpenRouter API error: {response.text}")
                
                result = response.json()
                
                # Get the raw content from the API response
                raw_content = result['choices'][0]['message']['content']
                
                # Log the raw response
                logger.info(f"Raw API Response: {json.dumps(raw_content, indent=2)}")
                
                # Parse the content if it's a string
                try:
                    content = json.loads(raw_content) if isinstance(raw_content, str) else raw_content
                except json.JSONDecodeError as e:
                    logger.error(f"Failed to parse API response content: {e}")
                    raise Exception("Invalid response format from API")

                # Return the raw content directly
                formatted_response = {
                    "choices": [{
                        "message": {
                            "content": content
                        },
                        "finish_reason": result['choices'][0].get('finish_reason', 'stop')
                    }]
                }

                # Log the formatted response
                logger.info(f"Formatted Response: {json.dumps(formatted_response, indent=2)}")

                # Clean up collection after analysis
                try:
                    self.client.delete_collection(collection_name)
                    logger.info(f"Cleaned up collection: {collection_name}")
                except Exception as e:
                    logger.error(f"Error cleaning up collection: {str(e)}")
                
                return formatted_response
                
        except Exception as e:
            logger.error(f"Error in analysis: {str(e)}")
            raise

    def _chunk_transcript(self, transcript: str, chunk_size: int = 500, overlap: int = 100) -> list:
        """
        Split transcript into smaller, overlapping chunks to preserve context
        """
        # Split into sentences first to avoid breaking mid-sentence
        sentences = re.split(r'(?<=[.!?])\s+', transcript)
        chunks = []
        current_chunk = []
        current_size = 0
        
        for sentence in sentences:
            sentence_size = len(sentence)
            
            # If adding this sentence would exceed chunk size
            if current_size + sentence_size > chunk_size and current_chunk:
                # Store the current chunk
                chunks.append(" ".join(current_chunk))
                
                # Start new chunk with overlap
                # Find sentences that fit within overlap size
                overlap_size = 0
                overlap_sentences = []
                for prev_sentence in reversed(current_chunk):
                    if overlap_size + len(prev_sentence) > overlap:
                        break
                    overlap_sentences.insert(0, prev_sentence)
                    overlap_size += len(prev_sentence) + 1  # +1 for space
                
                # Start new chunk with overlapping sentences
                current_chunk = overlap_sentences
                current_size = overlap_size
            
            current_chunk.append(sentence)
            current_size += sentence_size + 1  # +1 for space
        
        # Add the last chunk if there is one
        if current_chunk:
            chunks.append(" ".join(current_chunk))
        
        # Log chunking results
        logger.info(f"Split transcript into {len(chunks)} chunks with size {chunk_size} and overlap {overlap}")
        for i, chunk in enumerate(chunks):
            logger.debug(f"Chunk {i}: {len(chunk)} characters")
            
        return chunks

async def main():
    # Get the input file path from command line arguments
    if len(sys.argv) != 2:
        logger.error("Error: Please provide the path to the input JSON file")
        sys.exit(1)

    input_file = sys.argv[1]

    try:
        # Read the input data
        with open(input_file, 'r') as f:
            input_data = json.load(f)
            
        logger.info(f"Processing analysis request with type: {input_data.get('analysis_type', 'base')}")

        # Initialize the analysis service
        service = AnalysisService()

        # Process the transcript
        result = await service.analyze_transcript(
            transcript=input_data['transcript'],
            system_prompt=input_data['system_prompt'],
            base_prompt=input_data['base_prompt'],
            type_prompt=input_data.get('type_prompt', '')
        )
        
        logger.info(f"Analysis completed with metadata: {result.get('metadata', {})}")

        # Output the results as JSON
        print(json.dumps(result))

    except Exception as e:
        logger.error(f"Error in analyze.py: {str(e)}", exc_info=True)
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main()) 