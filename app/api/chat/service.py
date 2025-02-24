from typing import Dict, Any, List
import os
import httpx
from chromadb import PersistentClient, Settings
from chromadb.utils import embedding_functions
import json
from datetime import datetime
import logging
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ChatService:
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
        
    async def initialize_knowledge(self, transcript: str, meeting_id: str):
        """
        Initialize the knowledge base with a transcript
        """
        try:
            # Get or create collection for transcript chunks
            collection_name = f"meeting_{meeting_id}"
            logger.info(f"Creating/getting collection: {collection_name}")
            collection = self.client.get_or_create_collection(
                name=collection_name,
                embedding_function=self.embedding_function
            )
            
            # Get or create collection for chat history
            history_collection_name = f"chat_history_{meeting_id}"
            logger.info(f"Creating/getting history collection: {history_collection_name}")
            history_collection = self.client.get_or_create_collection(
                name=history_collection_name,
                embedding_function=self.embedding_function
            )
            
            # Split transcript into chunks and add to collection
            chunks = self._chunk_transcript(transcript)
            ids = [f"chunk_{i}" for i in range(len(chunks))]
            metadatas = [{"meeting_id": meeting_id} for _ in chunks]
            
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
            
    async def get_response(self, query: str, meeting_id: str, conversation_id: str = None) -> Dict[str, Any]:
        """
        Get a response using RAG with OpenRouter, maintaining conversation history
        """
        try:
            # Get collections
            collection_name = f"meeting_{meeting_id}"
            logger.info(f"Accessing collection: {collection_name}")
            collection = self.client.get_or_create_collection(
                name=collection_name,
                embedding_function=self.embedding_function
            )
            
            history_collection_name = f"chat_history_{meeting_id}"
            logger.info(f"Accessing history collection: {history_collection_name}")
            history_collection = self.client.get_or_create_collection(
                name=history_collection_name,
                embedding_function=self.embedding_function
            )
            
            # Get conversation history
            history = []
            if conversation_id:
                try:
                    logger.info(f"Retrieving history for conversation: {conversation_id}")
                    history_results = history_collection.get(
                        ids=[conversation_id],
                        include=["documents", "metadatas"]
                    )
                    logger.info(f"History results: {history_results}")
                    if history_results and history_results['documents']:
                        history = json.loads(history_results['documents'][0])
                        logger.info(f"Found existing history with {len(history)} messages")
                    else:
                        logger.info("No existing history found")
                        conversation_id = None
                except Exception as e:
                    logger.error(f"Error retrieving history: {str(e)}")
                    conversation_id = None
            
            if not conversation_id:
                conversation_id = f"conv_{datetime.now().timestamp()}"
                logger.info(f"Creating new conversation: {conversation_id}")
                history_collection.add(
                    ids=[conversation_id],
                    documents=[json.dumps([])],
                    metadatas=[{"meeting_id": meeting_id, "created_at": datetime.now().isoformat()}]
                )
            
            # Perform hybrid search
            # 1. First try exact word matching if the query contains specific words to find
            exact_matches = []
            search_words = self._extract_search_words(query, history)
            if search_words:
                logger.info(f"Searching for exact matches of words: {search_words}")
                all_chunks = collection.get()
                for i, doc in enumerate(all_chunks['documents']):
                    for word in search_words:
                        if word.lower() in doc.lower():
                            exact_matches.append({
                                'chunk': doc,
                                'word': word,
                                'index': i
                            })
            
            # 2. Then do semantic search
            logger.info("Performing semantic search")
            semantic_results = collection.query(
                query_texts=[query],
                n_results=5  # Increased from 3 to 5 for better context
            )
            
            # Combine and deduplicate results
            context_chunks = []
            seen_chunks = set()
            
            # First add exact matches
            for match in exact_matches:
                if match['chunk'] not in seen_chunks:
                    context_chunks.append(match['chunk'])
                    seen_chunks.add(match['chunk'])
            
            # Then add semantic results
            for chunk in semantic_results['documents'][0]:
                if chunk not in seen_chunks:
                    context_chunks.append(chunk)
                    seen_chunks.add(chunk)
            
            # Prepare context from combined results
            context = "\n\n".join(context_chunks)
            
            # Add exact match information to the prompt if available
            exact_match_info = ""
            if exact_matches:
                exact_match_info = "\nExact word matches found:\n" + "\n".join(
                    f"- '{match['word']}' found in transcript segment" 
                    for match in exact_matches
                )
            
            # Prepare messages including history
            messages = [
                {"role": "system", "content": self._get_system_prompt()},
                {"role": "user", "content": f"Context from transcript:\n\n{context}\n{exact_match_info}\n\nConversation history:\n{self._format_history(history)}\n\nCurrent question: {query}\n\nImportant: Base your response ONLY on the exact content provided in the context. If you're mentioning specific quotes or timestamps, they MUST be present in the provided context. Do not make assumptions or fill in missing information."}
            ]
            
            # Add conversation history to messages
            for msg in history:
                messages.append({"role": msg["role"], "content": msg["content"]})
            
            # Add current query
            messages.append({"role": "user", "content": query})
            
            logger.info(f"Sending request with {len(messages)} messages")
            
            # Make request to OpenRouter API
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers=self.headers,
                    json={
                        "model": "openai/gpt-4-turbo-preview",
                        "messages": messages,
                        "temperature": 0.3
                    },
                    timeout=30.0
                )
                
                if response.status_code != 200:
                    raise Exception(f"OpenRouter API error: {response.text}")
                
                result = response.json()
                ai_response = result['choices'][0]['message']['content']
                
                # Update conversation history
                history.append({"role": "user", "content": query})
                history.append({"role": "assistant", "content": ai_response})
                
                # Store updated history
                try:
                    logger.info(f"Updating history for conversation {conversation_id} with {len(history)} messages")
                    history_collection.upsert(
                        ids=[conversation_id],
                        documents=[json.dumps(history)],
                        metadatas=[{
                            "meeting_id": meeting_id,
                            "last_updated": datetime.now().isoformat(),
                            "message_count": len(history)
                        }]
                    )
                except Exception as e:
                    logger.error(f"Error updating history: {str(e)}")
                
                return {
                    "response": ai_response,
                    "sources": context_chunks,
                    "metadata": {
                        "meeting_id": meeting_id,
                        "conversation_id": conversation_id,
                        "confidence": result['choices'][0].get('finish_reason') == 'stop',
                        "history_length": len(history)
                    }
                }
                
        except Exception as e:
            logger.error(f"Error getting response: {str(e)}")
            raise
            
    def _get_system_prompt(self) -> str:
        """
        Get the system prompt with strict accuracy requirements
        """
        return """You are a precise and meticulous transcription analyst specializing in criminal law. Your primary focus is on accuracy and factual reporting. You have extensive experience analyzing legal audio transcripts from police interviews, courtroom proceedings, and investigations.

When answering queries, you MUST follow these strict guidelines:

1. **Absolute Accuracy:**
   - Only make statements that are directly supported by the transcript content
   - If asked about specific words, phrases, or counts, verify each instance in the provided context
   - Include exact timestamps when referencing transcript content
   - If information is ambiguous or unclear, explicitly state this

2. **Zero Assumptions:**
   - Never make assumptions about content not present in the transcript
   - If asked about something not in the provided context, state clearly that you cannot find it
   - Do not fill in gaps with probable or possible information

3. **Explicit Verification:**
   - For word counts or specific phrase searches, list each instance with its timestamp
   - When correcting previous responses, clearly acknowledge the error and provide accurate information
   - If exact matches are found, cite them directly with timestamps

4. **Context Awareness:**
   - Consider the full conversation history when answering follow-up questions
   - If a question requires context not present in the current segments, request additional context
   - Maintain consistency with previous accurate responses

5. **Error Prevention:**
   - Double-check all counts and references before responding
   - If uncertain about any detail, express that uncertainty clearly
   - Prefer saying "I don't have enough information" over making assumptions

Your responses should be precise, factual, and directly tied to the transcript content. Never speculate or infer beyond what is explicitly stated in the provided text."""
            
    def _format_history(self, history: List[Dict[str, str]]) -> str:
        """
        Format conversation history for inclusion in prompt
        """
        if not history:
            return "No previous conversation."
        
        formatted = []
        for msg in history:
            role = msg["role"].capitalize()
            content = msg["content"]
            formatted.append(f"{role}: {content}")
        return "\n".join(formatted)
            
    def _chunk_transcript(self, transcript: str, chunk_size: int = 500, overlap: int = 100) -> List[str]:
        """
        Split transcript into smaller, overlapping chunks to preserve context
        
        Args:
            transcript: The text to chunk
            chunk_size: Target size of each chunk in characters
            overlap: Number of characters to overlap between chunks
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

    def _extract_search_words(self, query: str, history: List[Dict[str, str]]) -> List[str]:
        """
        Extract specific words to search for based on the query and conversation history
        """
        # If the query is asking about specific words
        word_patterns = [
            r'word ["\'](.*?)["\']',  # matches: word "example" or word 'example'
            r'words? (.*?) (?:is|are|was|were) mentioned',  # matches: word X is mentioned
            r'how many times (?:is|was) (.*?) mentioned',  # matches: how many times is X mentioned
            r'how many times does (.*?) appear',  # matches: how many times does X appear
        ]
        
        words = set()
        
        # Check current query
        for pattern in word_patterns:
            matches = re.findall(pattern, query.lower())
            words.update(matches)
        
        # Check conversation history for context
        if history:
            # Get the last query that might contain the word we're looking for
            for msg in reversed(history):
                if msg['role'] == 'user':
                    for pattern in word_patterns:
                        matches = re.findall(pattern, msg['content'].lower())
                        words.update(matches)
                    break
        
        return list(words) 