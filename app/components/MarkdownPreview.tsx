'use client';

import { Download, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import { cn } from '../lib/utils';

interface MarkdownPreviewProps {
  markdown: string;
  videoId?: string;
  videoTitle?: string;
}

export function MarkdownPreview({
  markdown,
  videoId,
  videoTitle,
}: MarkdownPreviewProps) {
  const t = useTranslations('preview');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${videoTitle || videoId || 'subtitle'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {t('title')}
        </h2>
        <div className="flex gap-2">
          <button
            onClick={handleCopy}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg",
              "bg-gray-100 dark:bg-gray-800",
              "hover:bg-gray-200 dark:hover:bg-gray-700",
              "text-gray-700 dark:text-gray-300",
              "transition-colors duration-200",
              "text-sm font-medium"
            )}
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                {t('copied')}
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                {t('copy')}
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg",
              "bg-blue-600 hover:bg-blue-700",
              "text-white",
              "transition-colors duration-200",
              "text-sm font-medium"
            )}
          >
            <Download className="h-4 w-4" />
            {t('download')}
          </button>
        </div>
      </div>
      <div
        className={cn(
          "p-6 rounded-lg border",
          "bg-white dark:bg-gray-800",
          "border-gray-200 dark:border-gray-700",
          "prose dark:prose-invert max-w-none",
          "overflow-auto max-h-[600px]"
        )}
      >
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </div>
    </div>
  );
}
