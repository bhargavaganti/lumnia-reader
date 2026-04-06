/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import * as pdfjs from 'pdfjs-dist';
import { 
  Play, 
  Pause, 
  Square, 
  Upload, 
  FileText, 
  Settings, 
  Volume2, 
  VolumeX, 
  ChevronLeft, 
  ChevronRight,
  FastForward,
  Rewind,
  Maximize2,
  Minimize2,
  Type
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Word {
  text: string;
  index: number;
}

// --- PDF Worker Setup ---
// In a real environment, we'd use a CDN for the worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

export default function App() {
  const [content, setContent] = useState<string>('');
  const [words, setWords] = useState<Word[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState(18);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const synth = window.speechSynthesis;
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // Initialize voices
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = synth.getVoices();
      setVoices(availableVoices);
      if (availableVoices.length > 0 && !selectedVoice) {
        setSelectedVoice(availableVoices[0].name);
      }
    };
    loadVoices();
    synth.onvoiceschanged = loadVoices;
    return () => { synth.onvoiceschanged = null; };
  }, [selectedVoice, synth]);

  // Process text into words
  useEffect(() => {
    if (content) {
      const splitWords = content.split(/\s+/).map((text, index) => ({ text, index }));
      setWords(splitWords);
      wordRefs.current = new Array(splitWords.length).fill(null);
    } else {
      setWords([]);
    }
  }, [content]);

  // Auto-scroll to current word
  useEffect(() => {
    if (currentWordIndex >= 0 && wordRefs.current[currentWordIndex]) {
      wordRefs.current[currentWordIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [currentWordIndex]);

  const stopReading = useCallback(() => {
    synth.cancel();
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentWordIndex(-1);
  }, [synth]);

  const startReading = useCallback((startIndex = 0) => {
    if (!content) return;

    stopReading();

    const textToRead = words.slice(startIndex).map(w => w.text).join(' ');
    const utterance = new SpeechSynthesisUtterance(textToRead);
    
    utterance.rate = playbackRate;
    utterance.volume = isMuted ? 0 : volume;
    
    if (selectedVoice) {
      const voice = voices.find(v => v.name === selectedVoice);
      if (voice) utterance.voice = voice;
    }

    let wordOffset = startIndex;

    utterance.onboundary = (event) => {
      if (event.name === 'word') {
        // Find the word index based on character offset
        // This is tricky because event.charIndex is relative to the *utterance* text
        // We can approximate by counting spaces or using a more robust mapping
        // For simplicity, we'll increment based on boundaries if possible, 
        // but SpeechSynthesis is notoriously inconsistent across browsers.
        // A better way is to read word by word, but that sounds choppy.
        // Let's try to map charIndex to our word array.
        
        let charCount = 0;
        for (let i = startIndex; i < words.length; i++) {
          const wordLength = words[i].text.length + 1; // +1 for space
          if (charCount <= event.charIndex && event.charIndex < charCount + wordLength) {
            setCurrentWordIndex(i);
            break;
          }
          charCount += wordLength;
        }
      }
    };

    utterance.onend = () => {
      setIsPlaying(false);
      setIsPaused(false);
      setCurrentWordIndex(-1);
    };

    utteranceRef.current = utterance;
    setIsPlaying(true);
    setIsPaused(false);
    synth.speak(utterance);
  }, [content, words, playbackRate, volume, isMuted, selectedVoice, voices, stopReading, synth]);

  const togglePlayPause = () => {
    if (!isPlaying) {
      startReading(currentWordIndex >= 0 ? currentWordIndex : 0);
    } else if (isPaused) {
      synth.resume();
      setIsPaused(false);
    } else {
      synth.pause();
      setIsPaused(true);
    }
  };

  const handleFileUpload = async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setIsLoading(true);
    setFileName(file.name);
    stopReading();

    try {
      if (file.type === 'application/pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => item.str).join(' ');
          fullText += pageText + '\n';
        }
        setContent(fullText);
      } else {
        const text = await file.text();
        setContent(text);
      }
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Failed to read file. Please try a different one.');
    } finally {
      setIsLoading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileUpload,
    accept: {
      'text/plain': ['.txt'],
      'application/pdf': ['.pdf'],
      'text/markdown': ['.md']
    },
    multiple: false
  });

  return (
    <div className={cn(
      "min-h-screen flex flex-col transition-colors duration-500",
      isDarkMode ? "bg-[#0a0a0a] text-white" : "bg-[#f5f5f0] text-[#1a1a1a]"
    )}>
      {/* Header */}
      <header className="p-6 flex justify-between items-center border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center">
            <FileText className="text-white" size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Lumina Reader</h1>
            {fileName && <p className="text-xs opacity-50 truncate max-w-[200px]">{fileName}</p>}
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
          >
            {isDarkMode ? <Settings size={20} /> : <Settings size={20} />}
          </button>
          {!content && (
            <div {...getRootProps()} className="cursor-pointer">
              <input {...getInputProps()} />
              <button className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition-all">
                <Upload size={16} />
                Upload File
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 relative flex flex-col overflow-hidden">
        {!content ? (
          <div className="flex-1 flex flex-col items-center justify-center p-10">
            <div 
              {...getRootProps()}
              className={cn(
                "w-full max-w-2xl aspect-video border-2 border-dashed rounded-3xl flex flex-col items-center justify-center gap-4 transition-all cursor-pointer",
                isDragActive ? "border-orange-500 bg-orange-500/10" : "border-white/10 hover:border-white/20 hover:bg-white/5",
                isDarkMode ? "bg-white/5" : "bg-black/5 border-black/10"
              )}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center gap-4"
              >
                <input {...getInputProps()} />
                <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center pointer-events-none">
                  <Upload className="text-orange-500" size={32} />
                </div>
                <div className="text-center pointer-events-none">
                  <h2 className="text-2xl font-semibold mb-2">Drop your file here</h2>
                  <p className="opacity-50">Supports PDF, TXT, and Markdown</p>
                </div>
              </motion.div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-6 py-10 md:px-20 lg:px-40" ref={scrollRef}>
            <div 
              className="max-w-3xl mx-auto leading-relaxed"
              style={{ fontSize: `${fontSize}px` }}
            >
              {words.map((word, i) => (
                <span
                  key={i}
                  ref={(el) => { wordRefs.current[i] = el; }}
                  onClick={() => {
                    setCurrentWordIndex(i);
                    startReading(i);
                  }}
                  className={cn(
                    "inline-block mr-1.5 px-0.5 rounded transition-all cursor-pointer",
                    currentWordIndex === i 
                      ? "bg-orange-500 text-white scale-110 shadow-lg shadow-orange-500/20" 
                      : "hover:bg-white/10"
                  )}
                >
                  {word.text}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        <AnimatePresence>
          {isLoading && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50"
            >
              <div className="text-center">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-orange-500 font-medium">Processing your content...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Controls Bar */}
      {content && (
        <footer className={cn(
          "p-6 border-t backdrop-blur-xl sticky bottom-0 z-40",
          isDarkMode ? "bg-black/80 border-white/10" : "bg-white/80 border-black/10"
        )}>
          <div className="max-w-5xl mx-auto flex flex-col gap-6">
            {/* Progress Bar */}
            <div className="relative w-full h-1.5 bg-white/10 rounded-full overflow-hidden group cursor-pointer">
              <div 
                className="absolute top-0 left-0 h-full bg-orange-500 transition-all duration-300"
                style={{ width: `${(currentWordIndex + 1) / words.length * 100}%` }}
              />
              <input 
                type="range" 
                min="0" 
                max={words.length - 1} 
                value={currentWordIndex}
                onChange={(e) => {
                  const idx = parseInt(e.target.value);
                  setCurrentWordIndex(idx);
                  startReading(idx);
                }}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-6">
              {/* Left: Playback Controls */}
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => {
                    const next = Math.max(0, currentWordIndex - 10);
                    setCurrentWordIndex(next);
                    startReading(next);
                  }}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <Rewind size={20} />
                </button>
                
                <button 
                  onClick={togglePlayPause}
                  className="w-14 h-14 bg-orange-500 hover:bg-orange-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-orange-500/30 transition-all active:scale-95"
                >
                  {isPlaying && !isPaused ? <Pause size={28} fill="white" /> : <Play size={28} fill="white" className="ml-1" />}
                </button>

                <button 
                  onClick={stopReading}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <Square size={20} fill={isDarkMode ? "white" : "black"} />
                </button>

                <button 
                  onClick={() => {
                    const next = Math.min(words.length - 1, currentWordIndex + 10);
                    setCurrentWordIndex(next);
                    startReading(next);
                  }}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <FastForward size={20} />
                </button>
              </div>

              {/* Center: Voice & Speed */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                  <Volume2 size={16} className="opacity-50" />
                  <select 
                    value={selectedVoice || ''} 
                    onChange={(e) => setSelectedVoice(e.target.value)}
                    className="bg-transparent text-sm focus:outline-none max-w-[150px] truncate"
                  >
                    {voices.map(voice => (
                      <option key={voice.name} value={voice.name} className="bg-[#1a1a1a]">
                        {voice.name} ({voice.lang})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold opacity-50 uppercase tracking-widest">Speed</span>
                  <select 
                    value={playbackRate} 
                    onChange={(e) => {
                      const rate = parseFloat(e.target.value);
                      setPlaybackRate(rate);
                      if (isPlaying) startReading(currentWordIndex);
                    }}
                    className="bg-white/5 border border-white/10 rounded-full px-3 py-1 text-sm focus:outline-none"
                  >
                    {[0.5, 0.75, 1, 1.25, 1.5, 2].map(rate => (
                      <option key={rate} value={rate} className="bg-[#1a1a1a]">{rate}x</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Right: Appearance */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Type size={16} className="opacity-50" />
                  <input 
                    type="range" 
                    min="12" 
                    max="48" 
                    value={fontSize}
                    onChange={(e) => setFontSize(parseInt(e.target.value))}
                    className="w-24 accent-orange-500"
                  />
                </div>
                
                <button 
                  onClick={() => setContent('')}
                  className="text-xs font-bold uppercase tracking-widest opacity-50 hover:opacity-100 transition-opacity"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}
