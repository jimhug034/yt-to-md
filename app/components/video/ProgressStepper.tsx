'use client';

import { ProcessingStep } from './VideoProcessor';
import {
  Upload,
  Music,
  MessageSquare,
  Image,
  ScanText,
  FileText,
  CheckCircle2,
  Loader2,
  ChevronRight,
} from 'lucide-react';

interface ProgressStepperProps {
  currentStep: ProcessingStep;
  progress: number;
  stepDetails?: {
    current?: string;
    total?: string;
    eta?: number;
  };
}

const STEPS: {
  key: ProcessingStep;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: 'loading', label: 'Loading', description: 'Loading video...', icon: Upload },
  { key: 'extracting_audio', label: 'Audio', description: 'Extracting audio track', icon: Music },
  { key: 'transcribing', label: 'Transcribe', description: 'Converting speech to text', icon: MessageSquare },
  { key: 'extracting_frames', label: 'Frames', description: 'Extracting key frames', icon: Image },
  { key: 'running_ocr', label: 'OCR', description: 'Reading text from frames', icon: ScanText },
  { key: 'generating_summary', label: 'Summary', description: 'Generating content summary', icon: FileText },
  { key: 'complete', label: 'Complete', description: 'Processing finished', icon: CheckCircle2 },
];

const formatEta = (seconds: number): string => {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
};

export function ProgressStepper({ currentStep, progress, stepDetails }: ProgressStepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);
  const currentStepData = STEPS[currentIndex];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header with Overall Progress */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {currentStep === 'complete' ? (
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
            ) : (
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                <Loader2 className="w-5 h-5 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
            )}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {currentStep === 'complete' ? 'Processing Complete!' : currentStepData?.label || 'Processing...'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {currentStep === 'complete' ? 'Your video is ready' : currentStepData?.description || 'Please wait...'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {Math.round(progress)}%
            </div>
            {stepDetails?.eta && currentStep !== 'complete' && (
              <div className="text-xs text-gray-500 dark:text-gray-400">
                ETA: {formatEta(stepDetails.eta)}
              </div>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-2.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ease-out ${
              currentStep === 'complete'
                ? 'bg-green-500'
                : 'bg-gradient-to-r from-blue-500 to-blue-600'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>

        {/* Step Details */}
        {stepDetails && (stepDetails.current || stepDetails.total) && (
          <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            {stepDetails.current && <span>{stepDetails.current}</span>}
            {stepDetails.total && <span>{stepDetails.total}</span>}
          </div>
        )}
      </div>

      {/* Step Timeline */}
      <div className="relative">
        {/* Progress Line */}
        <div className="absolute top-5 left-5 right-5 h-0.5 bg-gray-200 dark:bg-gray-700 -z-10" />
        <div
          className="absolute top-5 left-5 h-0.5 bg-gradient-to-r from-blue-500 to-green-500 -z-10 transition-all duration-500"
          style={{ width: `calc(${progress}% * 0.9)` }}
        />

        {/* Step Indicators */}
        <div className="flex justify-between">
          {STEPS.slice(0, -1).map((step, index) => {
            const isCompleted = index < currentIndex;
            const isCurrent = index === currentIndex;
            const Icon = step.icon;

            return (
              <div key={step.key} className="flex flex-col items-center gap-2 flex-1">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                    isCompleted
                      ? 'bg-green-500 border-green-500 text-white shadow-lg shadow-green-500/30'
                      : isCurrent
                      ? 'bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/30 scale-110'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : isCurrent ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div className="hidden md:block text-center">
                  <p
                    className={`text-xs font-medium transition-colors ${
                      isCompleted
                        ? 'text-green-600 dark:text-green-400'
                        : isCurrent
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {step.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Completion Message */}
      {currentStep === 'complete' && (
        <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 animate-in slide-in-from-bottom-2 fade-in duration-500">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            <p className="text-sm font-medium text-green-800 dark:text-green-400">
              All tasks completed successfully!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
