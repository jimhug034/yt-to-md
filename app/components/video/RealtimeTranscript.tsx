'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { TranscriptSegment } from '@/app/lib/wasm';
import { MessageSquare, Volume2, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface RealtimeTranscriptProps {
  segments: TranscriptSegment[];
  isProcessing?: boolean;
  currentTime?: number;
}

export function RealtimeTranscript({ segments, isProcessing = false, currentTime = 0 }: RealtimeTranscriptProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [expanded, setExpanded] = useState(true);

  const formatTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const getConfidenceColor = useCallback((confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 dark:text-green-400';
    if (confidence >= 0.7) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  }, []);

  useEffect(() => {
    if (containerRef.current && autoScroll && segments.length > 0) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [segments, autoScroll]);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setAutoScroll(isAtBottom);
    }
  }, []);

  const activeSegmentIndex = segments.findIndex(
    (seg) => currentTime >= seg.start_time && currentTime <= seg.end_time
  );

  const totalDuration = segments.length > 0
    ? segments[segments.length - 1].end_time
    : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              isProcessing
                ? 'bg-blue-100 dark:bg-blue-900/30'
                : 'bg-gray-100 dark:bg-gray-700'
            }`}>
              <MessageSquare className={`w-5 h-5 ${
                isProcessing ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'
              }`} />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-gray-100">
                Realtime Transcript
              </h2>
              <div className="flex items-center gap-3 text-xs md:text-sm text-gray-500 dark:text-gray-400">
                <span>{segments.length} segments</span>
                {totalDuration > 0 && (
                  <>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatTime(totalDuration)}
                    </span>
                  </>
                )}
                {isProcessing && (
                  <>
                    <span>&bull;</span>
                    <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                      <span className="animate-pulse">●</span>
                      Processing
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-gray-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-500" />
            )}
          </button>
        </div>
      </div>

      {/* Transcript Content */}
      {expanded && (
        <>
          {/* Auto-scroll indicator */}
          {autoScroll && segments.length > 5 && (
            <div className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-900/30">
              <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400">
                <span className="flex items-center gap-1">
                  <Volume2 className="w-3 h-3" />
                  Auto-scrolling to latest
                </span>
                <button
                  onClick={() => setAutoScroll(false)}
                  className="hover:underline"
                >
                  Disable
                </button>
              </div>
            </div>
          )}

          {/* Segments List */}
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="h-64 md:h-80 overflow-y-auto px-4 md:px-6 py-4 space-y-2 scroll-smooth"
          >
            {segments.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center py-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                  {isProcessing ? (
                    <MessageSquare className="w-8 h-8 text-gray-400 animate-pulse" />
                  ) : (
                    <MessageSquare className="w-8 h-8 text-gray-400" />
                  )}
                </div>
                <p className="text-gray-500 dark:text-gray-400 font-medium">
                  {isProcessing ? 'Waiting for transcription...' : 'No transcript segments yet'}
                </p>
                {isProcessing && (
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                    This may take a few moments
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {segments.map((segment, index) => {
                  const isActive = index === activeSegmentIndex;
                  const isLatest = index === segments.length - 1;

                  return (
                    <div
                      key={segment.id || index}
                      className={`group flex gap-3 p-3 rounded-lg transition-all duration-200 ${
                        isActive
                          ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
                          : isLatest && isProcessing
                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800/50 animate-in slide-in-from-bottom-2 fade-in duration-300'
                          : 'bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-800/50'
                      }`}
                    >
                      {/* Timestamp */}
                      <div className="flex flex-col items-center gap-1 flex-shrink-0">
                        <span className="text-xs font-mono font-medium text-blue-600 dark:text-blue-400 whitespace-nowrap">
                          {formatTime(segment.start_time)}
                        </span>
                        {segment.confidence && (
                          <span className={`text-xs font-medium ${getConfidenceColor(segment.confidence)}`}>
                            {Math.round(segment.confidence * 100)}%
                          </span>
                        )}
                      </div>

                      {/* Text */}
                      <p className={`text-sm flex-1 leading-relaxed ${
                        isActive
                          ? 'text-gray-900 dark:text-gray-100 font-medium'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {segment.text}
                      </p>

                      {/* Duration badge (visible on hover for desktop) */}
                      <span className="hidden md:group-hover:inline-flex items-center text-xs text-gray-400 dark:text-gray-500 bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded">
                        +{Math.round(segment.end_time - segment.start_time)}s
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer with auto-scroll toggle */}
          {segments.length > 5 && !autoScroll && (
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setAutoScroll(true)}
                className="w-full text-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
              >
                Resume auto-scroll
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
