'use client';

import { useEffect, useState } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';

interface WASMLoaderProps {
  onLoad: () => void;
  onError: (error: Error) => void;
}

export function WASMLoader({ onLoad, onError }: WASMLoaderProps) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('Initializing WASM module...');

  useEffect(() => {
    // This will be replaced with actual WASM loading logic
    const loadWASM = async () => {
      try {
        setMessage('Loading WebAssembly module...');
        // Simulate WASM loading - replace with actual implementation
        await new Promise((resolve) => setTimeout(resolve, 1000));

        setMessage('WASM module loaded successfully!');
        setStatus('ready');
        onLoad();
      } catch (error) {
        setStatus('error');
        setMessage('Failed to load WASM module');
        onError(error instanceof Error ? error : new Error('Unknown error'));
      }
    };

    loadWASM();
  }, [onLoad, onError]);

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 p-8",
        "rounded-lg border",
        status === 'loading' && "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
        status === 'ready' && "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
        status === 'error' && "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
      )}
    >
      {status === 'loading' && (
        <>
          <Loader2 className="h-8 w-8 text-blue-600 dark:text-blue-400 animate-spin" />
          <p className="text-sm text-blue-700 dark:text-blue-300">{message}</p>
        </>
      )}
      {status === 'ready' && (
        <p className="text-sm text-green-700 dark:text-green-300">{message}</p>
      )}
      {status === 'error' && (
        <>
          <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
          <p className="text-sm text-red-700 dark:text-red-300">{message}</p>
        </>
      )}
    </div>
  );
}
