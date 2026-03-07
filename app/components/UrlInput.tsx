"use client";

import { useState } from "react";
import { Youtube } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "../lib/utils";

interface UrlInputProps {
  onSubmit: (videoId: string) => void;
  isLoading?: boolean;
}

export function UrlInput({ onSubmit, isLoading = false }: UrlInputProps) {
  const t = useTranslations("input");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const extractVideoId = (input: string): string | null => {
    // Handle various YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /^([a-zA-Z0-9_-]{11})$/, // Direct video ID
    ];

    for (const pattern of patterns) {
      const match = input.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!url.trim()) {
      setError(t("errorRequired"));
      return;
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      setError(t("errorInvalid"));
      return;
    }

    onSubmit(videoId);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-2xl mx-auto">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Youtube className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-5 w-5" />
          <input
            type="text"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError(null);
            }}
            placeholder={t("placeholder")}
            className={cn(
              "w-full pl-10 pr-4 py-3 rounded-lg border",
              "bg-white dark:bg-gray-800",
              "text-gray-900 dark:text-gray-100",
              "placeholder:text-gray-400",
              "focus:outline-none focus:ring-2 focus:ring-blue-500",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              error && "border-red-500 focus:ring-red-500",
            )}
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            "px-6 py-3 rounded-lg font-medium",
            "bg-blue-600 hover:bg-blue-700 text-white",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-colors duration-200",
            "whitespace-nowrap",
          )}
        >
          {isLoading ? t("buttonLoading") : t("button")}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
    </form>
  );
}
