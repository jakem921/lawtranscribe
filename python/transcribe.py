#!/usr/bin/env python3
import asyncio
import json
import sys
from transcription import TranscriptionService

async def main():
    # Get the input file path from command line arguments
    if len(sys.argv) != 2:
        print("Error: Please provide the path to the input JSON file", file=sys.stderr)
        sys.exit(1)

    input_file = sys.argv[1]

    try:
        # Read the input data
        with open(input_file, 'r') as f:
            input_data = json.load(f)

        # Read the audio file
        with open(input_data['audio_path'], 'rb') as f:
            audio_data = f.read()

        # Initialize the transcription service
        service = TranscriptionService()

        # Process the audio
        analysis, transcript = await service.process_audio(audio_data, input_data['filename'])

        # Output the results as JSON
        result = {
            'analysis': analysis,
            'transcript': transcript
        }
        print(json.dumps(result))

    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == '__main__':
    asyncio.run(main()) 