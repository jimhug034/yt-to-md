'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { VideoProcessor } from '@/app/components/video/VideoProcessor';
import { SettingsButton } from '@/app/components/settings';
import { CompactJobList } from '@/app/components/jobs';
import type { Settings } from '@/app/components/settings';
import type { VideoJob } from '@/app/lib/wasm';
import { Film, Menu, X, Home } from 'lucide-react';

export default function VideoPage() {
  const [settings, setSettings] = useState<Partial<Settings>>({});
  const [selectedJob, setSelectedJob] = useState<VideoJob | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSettingsChange = useCallback((newSettings: Partial<Settings>) => {
    setSettings(newSettings);
  }, []);

  const handleSelectJob = useCallback((job: VideoJob) => {
    setSelectedJob(job);
    // 在移动端选择后关闭侧边栏
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="切换侧边栏"
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Film className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900 dark:text-white">
                    Video to PPT & Notes
                  </h1>
                  <p className="text-xs text-gray-500 dark:text-gray-400 hidden sm:block">
                    本地视频处理与内容生成
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/"
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                title="返回首页"
              >
                <Home className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </Link>
              <SettingsButton onSettingsChange={handleSettingsChange} settings={settings} />
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex">
        {/* Sidebar - Job History */}
        <aside
          className={`fixed lg:sticky top-16 left-0 z-30 h-[calc(100vh-4rem)] w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 transform transition-transform duration-300 ease-in-out overflow-y-auto ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="p-4">
            <CompactJobList
              onSelectJob={handleSelectJob}
              currentJobId={selectedJob?.id}
            />
          </div>
        </aside>

        {/* Sidebar Overlay (mobile) */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-20 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="container mx-auto px-4 py-8">
            {/* Hero Section (only when no job selected) */}
            {!selectedJob && (
              <div className="text-center py-8 mb-8">
                <div className="inline-flex p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
                  <Film className="w-12 h-12 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                  上传视频开始处理
                </h2>
                <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
                  支持语音识别、文字提取、章节划分等功能，生成可导出的 PPT 和笔记
                </p>
              </div>
            )}

            {/* Video Processor */}
            <VideoProcessor settings={settings} />
          </div>
        </main>
      </div>
    </div>
  );
}
