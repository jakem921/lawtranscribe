'use client';

import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast"
import dynamic from 'next/dynamic';

let ffmpeg: any = null;

const initFFmpeg = async () => {
  if (typeof window === 'undefined') {
    console.log('Skipping FFmpeg initialization on server side');
    return null;
  }
  
  try {
    if (!ffmpeg) {
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { fetchFile } = await import('@ffmpeg/util');
      ffmpeg = new FFmpeg();
      await ffmpeg.load();
      return { ffmpeg, fetchFile };
    }
    
    if (!ffmpeg.loaded) {
      await ffmpeg.load();
    }
    
    const { fetchFile } = await import('@ffmpeg/util');
    return { ffmpeg, fetchFile };
  } catch (error) {
    console.error('Error initializing FFmpeg:', error);
    return null;
  }
};

interface MonitoredFile {
  name: string;
  size: number;
  lastModified: string;
}

const UploadAudio: React.FC<{ onUploadSuccess: () => void }> = ({ onUploadSuccess }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [compressedFile, setCompressedFile] = useState<File | null>(null);
  const [monitoredFiles, setMonitoredFiles] = useState<MonitoredFile[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    fetchMonitoredFiles();
    const interval = setInterval(fetchMonitoredFiles, 10000); // Poll every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchMonitoredFiles = async () => {
    try {
      const response = await fetch('/api/monitored-files');
      if (response.ok) {
        const files: MonitoredFile[] = await response.json();
        setMonitoredFiles(files);
      }
    } catch (error) {
      console.error('Error fetching monitored files:', error);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setCompressedFile(null);
    }
  };

  const handleMonitoredFileSelect = async (fileName: string) => {
    try {
      const response = await fetch(`/api/monitored-files/${encodeURIComponent(fileName)}`);
      if (response.ok) {
        const blob = await response.blob();
        const file = new File([blob], fileName, { type: blob.type });
        setSelectedFile(file);
        setCompressedFile(null);
      }
    } catch (error) {
      console.error('Error selecting monitored file:', error);
      toast({
        title: 'File Selection Failed',
        description: 'An error occurred while selecting the file.',
        variant: 'destructive',
      });
    }
  };

  const compressAudio = async () => {
    if (!selectedFile) return;
    setIsCompressing(true);
    try {
      const ffmpegInstance = await initFFmpeg();
      if (!ffmpegInstance) {
        throw new Error('FFmpeg failed to initialize');
      }
      const { ffmpeg, fetchFile } = ffmpegInstance;
      
      await ffmpeg.writeFile('input_file', await fetchFile(selectedFile));

      // Different processing for MP4 files
      if (selectedFile.type === 'video/mp4') {
        // Extract audio from MP4 and convert to MP3
        await ffmpeg.exec([
          '-i',
          'input_file',
          '-vn', // No video
          '-acodec',
          'libmp3lame',
          '-ar',
          '16000',
          '-ac',
          '1',
          '-b:a',
          '16k',
          'output_audio.mp3'
        ]);
      } else {
        // Regular audio processing
        await ffmpeg.exec([
          '-i',
          'input_file',
          '-ar',
          '16000',
          '-ac',
          '1',
          '-b:a',
          '16k',
          'output_audio.mp3'
        ]);
      }

      const data = await ffmpeg.readFile('output_audio.mp3');
      const compressedBlob = new Blob([data], { type: 'audio/mpeg' });
      const compressed = new File([compressedBlob], `compressed_${selectedFile.name.replace(/\.[^/.]+$/, '')}.mp3`, {
        type: 'audio/mpeg',
      });

      setCompressedFile(compressed);
      toast({
        title: 'Processing Successful',
        description: `File size reduced to ${(compressed.size / (1024 * 1024)).toFixed(2)} MB`,
      });
    } catch (error) {
      console.error('Processing error:', error);
      toast({
        title: 'Processing Failed',
        description: 'An error occurred while processing the file.',
        variant: 'destructive',
      });
    } finally {
      setIsCompressing(false);
    }
  };

  const handleTranscribe = async () => {
    const fileToUpload = compressedFile || selectedFile;
    if (!fileToUpload) return;

    setIsTranscribing(true);
    const formData = new FormData();
    formData.append('audio', fileToUpload);
    formData.append('fullPath', fileToUpload.name);

    try {
      console.log('=== UPLOAD DETAILS ===');
      console.log('File name:', fileToUpload.name);
      console.log('File type:', fileToUpload.type);
      console.log('File size:', fileToUpload.size, 'bytes');
      console.log('Starting upload to /api/transcribe...');
      
      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      console.log('=== API RESPONSE ===');
      console.log('Status:', response.status);
      console.log('Status Text:', response.statusText);
      
      const responseData = await response.json();
      console.log('Response data:', responseData);

      if (!response.ok) {
        throw new Error(responseData.error || responseData.details || 'Failed to transcribe');
      }

      console.log('Transcription response:', responseData);

      toast({
        title: 'Transcription Started',
        description: 'Your audio is being transcribed.',
      });
      onUploadSuccess();
    } catch (error: any) {
      console.error('Transcription error:', error);
      toast({
        title: 'Transcription Failed',
        description: error.message || 'An error occurred while transcribing the audio.',
        variant: 'destructive',
      });
    } finally {
      setIsTranscribing(false);
      setSelectedFile(null);
      setCompressedFile(null);
    }
  };

  const getFileSizeMB = (file: File | null): number => {
    return file ? file.size / (1024 ** 2) : 0;
  };

  const isCompressionNeeded = selectedFile && (
    getFileSizeMB(selectedFile) > 24 || 
    selectedFile.type === 'video/mp4'
  );

  const isTranscribeDisabled =
    (selectedFile && getFileSizeMB(selectedFile) > 24 && (!compressedFile || getFileSizeMB(compressedFile) > 24)) ||
    (selectedFile?.type === 'video/mp4' && !compressedFile) ||
    isCompressing ||
    isTranscribing;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload New Audio</CardTitle>
        <CardDescription>Select an audio or video file to transcribe</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-4">
          <Label htmlFor="audio-file">Audio/Video File</Label>
          <Input
            id="audio-file"
            type="file"
            accept="audio/*,video/mp4"
            onChange={handleFileChange}
          />
          {selectedFile && (
            <p>Selected File: {selectedFile.name} ({getFileSizeMB(selectedFile).toFixed(2)} MB)</p>
          )}
          {monitoredFiles.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-2">Monitored Files:</h3>
              <ul className="space-y-2">
                {monitoredFiles.map((file) => (
                  <li key={file.name} className="flex items-center justify-between">
                    <span>{file.name} ({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                    <Button onClick={() => handleMonitoredFileSelect(file.name)}>Select</Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {isCompressionNeeded && (
            <Button onClick={compressAudio} disabled={isCompressing}>
              {isCompressing ? 'Processing...' : selectedFile?.type === 'video/mp4' ? 'Extract Audio' : 'Compress Audio'}
            </Button>
          )}
          {compressedFile && (
            <p>Processed File: {compressedFile.name} ({getFileSizeMB(compressedFile).toFixed(2)} MB)</p>
          )}
          <Button onClick={handleTranscribe} disabled={isTranscribeDisabled}>
            {isTranscribing ? 'Transcribing...' : 'Transcribe Audio'}
          </Button>
          {isTranscribeDisabled && selectedFile && (
            <p className="text-red-500">
              {selectedFile.type === 'video/mp4' && !compressedFile
                ? 'Please extract the audio from the video file first.'
                : getFileSizeMB(compressedFile || selectedFile) > 24
                ? 'File size exceeds 24 MB, please compress the file before transcribing.'
                : ''}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default UploadAudio;
