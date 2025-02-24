#!/usr/bin/env python3
import asyncio
import json
import sys
import logging
from service import ChatService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('chat.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

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
            
        logger.info(f"Processing request with data: {json.dumps(input_data, indent=2)}")

        # Initialize the chat service
        service = ChatService()

        # Initialize knowledge base with transcript if not already done
        logger.info(f"Initializing knowledge base for meeting {input_data['meeting_id']}")
        await service.initialize_knowledge(
            transcript=input_data['transcript'],
            meeting_id=input_data['meeting_id']
        )

        # Get response for the query with conversation history
        logger.info(f"Getting response for query with conversation_id: {input_data.get('conversation_id')}")
        response = await service.get_response(
            query=input_data['query'],
            meeting_id=input_data['meeting_id'],
            conversation_id=input_data.get('conversation_id')  # Optional conversation ID
        )
        
        logger.info(f"Got response with metadata: {response.get('metadata', {})}")

        # Output the results as JSON
        print(json.dumps(response))

    except Exception as e:
        logger.error(f"Error in chat.py: {str(e)}", exc_info=True)
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main()) 