/**
 * Job List Component
 *
 * 显示视频处理任务列表（历史记录）
 * 支持查看详情、删除、导出等操作
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  Film,
  Trash2,
  Download,
  Eye,
  RefreshCw,
  FileText,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import { dbManager } from '@/app/lib/database';
import type { VideoJob } from '@/app/lib/wasm';

export interface JobListProps {
  onSelectJob?: (job: VideoJob) => void;
  showViewButton?: boolean;
  limit?: number;
}

interface JobItem extends VideoJob {
  segments_count?: number;
  frames_count?: number;
  chapters_count?: number;
}

export function JobList({ onSelectJob, showViewButton = true, limit = 20 }: JobListProps) {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      await dbManager.init();
      const allJobs = await dbManager.getAllJobs();

      // 按创建时间倒序排列
      const sortedJobs = allJobs
        .sort((a, b) => b.created_at - a.created_at)
        .slice(0, limit);

      // 为每个 job 添加统计信息
      const jobsWithStats = await Promise.all(
        sortedJobs.map(async (job) => {
          const segments = await dbManager.getSegments(job.id);
          const frames = await dbManager.getFrames(job.id);
          const chapters = await dbManager.getChapters(job.id);

          return {
            ...job,
            segments_count: segments.length,
            frames_count: frames.length,
            chapters_count: chapters.length,
          };
        })
      );

      setJobs(jobsWithStats);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setIsLoading(false);
    }
  }, [limit]);

  const refreshJobs = useCallback(async () => {
    setIsRefreshing(true);
    await loadJobs();
    setIsRefreshing(false);
  }, [loadJobs]);

  const handleDeleteJob = useCallback(async (jobId: string) => {
    if (!confirm('确定要删除此任务吗？此操作不可恢复。')) {
      return;
    }

    try {
      await dbManager.deleteJob(jobId);
      setJobs(jobs.filter(j => j.id !== jobId));
    } catch (error) {
      console.error('Failed to delete job:', error);
      alert('删除失败：' + (error instanceof Error ? error.message : '未知错误'));
    }
  }, []);

  const handleExportJob = useCallback(async (jobId: string) => {
    try {
      const exportData = await dbManager.exportJob(jobId);
      if (exportData) {
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `job-${jobId}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Failed to export job:', error);
      alert('导出失败：' + (error instanceof Error ? error.message : '未知错误'));
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'Failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'Processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'Pending': return '等待中';
      case 'Processing': return '处理中';
      case 'Completed': return '已完成';
      case 'Failed': return '失败';
      default: return status;
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    return date.toLocaleDateString();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Film className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h3 className="font-semibold text-gray-900 dark:text-white">
            处理历史
          </h3>
        </div>
        <button
          onClick={refreshJobs}
          disabled={isRefreshing}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="刷新"
        >
          <RefreshCw className={`w-4 h-4 text-gray-600 dark:text-gray-400 ${isRefreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* List */}
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {isLoading ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            加载中...
          </div>
        ) : jobs.length === 0 ? (
          <div className="p-8 text-center text-gray-500 dark:text-gray-400">
            <Film className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>暂无处理记录</p>
          </div>
        ) : (
          jobs.map((job) => (
            <div key={job.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              {/* Main Row */}
              <div className="flex items-start gap-4">
                {/* Status Icon */}
                <div className="flex-shrink-0 mt-1">
                  {getStatusIcon(job.status)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Title Row */}
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h4 className="font-medium text-gray-900 dark:text-white truncate">
                      {job.file_name}
                    </h4>
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0">
                      {formatDate(job.created_at)}
                    </span>
                  </div>

                  {/* Details */}
                  <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-2">
                    {job.duration > 0 && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(job.duration)}
                      </span>
                    )}
                    {job.width > 0 && job.height > 0 && (
                      <span>
                        {job.width}x{job.height}
                      </span>
                    )}
                    {job.progress > 0 && job.progress < 100 && (
                      <span className="flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        {Math.round(job.progress)}%
                      </span>
                    )}
                  </div>

                  {/* Stats Tags */}
                  <div className="flex flex-wrap gap-2">
                    {job.segments_count !== undefined && job.segments_count > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                        <FileText className="w-3 h-3" />
                        {job.segments_count} 字幕
                      </span>
                    )}
                    {job.frames_count !== undefined && job.frames_count > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs">
                        <ImageIcon className="w-3 h-3" />
                        {job.frames_count} 帧
                      </span>
                    )}
                    {job.chapters_count !== undefined && job.chapters_count > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded text-xs">
                        章节
                      </span>
                    )}
                  </div>

                  {/* Progress Bar (for processing jobs) */}
                  {job.status === 'Processing' && job.progress > 0 && (
                    <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${job.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {showViewButton && job.status === 'Completed' && (
                    <button
                      onClick={() => onSelectJob?.(job)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      title="查看"
                    >
                      <Eye className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedJob(expandedJob === job.id ? null : job.id)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="详情"
                  >
                    <ChevronRight
                      className={`w-4 h-4 text-gray-600 dark:text-gray-400 transition-transform ${
                        expandedJob === job.id ? 'rotate-90' : ''
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => handleExportJob(job.id)}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title="导出"
                  >
                    <Download className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleDeleteJob(job.id)}
                    className="p-2 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="删除"
                  >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedJob === job.id && (
                <div className="mt-4 pl-10 space-y-3 text-sm border-t border-gray-100 dark:border-gray-700 pt-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">任务 ID</span>
                      <p className="text-gray-900 dark:text-white font-mono text-xs truncate" title={job.id}>
                        {job.id.slice(0, 8)}...
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">状态</span>
                      <p className="text-gray-900 dark:text-white">
                        {getStatusText(job.status)}
                      </p>
                    </div>
                    {job.source_url && (
                      <div className="col-span-2">
                        <span className="text-gray-500 dark:text-gray-400">来源</span>
                        <p className="text-gray-900 dark:text-white text-xs truncate" title={job.source_url}>
                          {job.source_url}
                        </p>
                      </div>
                    )}
                    {job.error_message && (
                      <div className="col-span-2">
                        <span className="text-gray-500 dark:text-gray-400">错误信息</span>
                        <p className="text-red-600 dark:text-red-400">{job.error_message}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Compact Job List - 侧边栏版本
 */

interface CompactJobListProps {
  onSelectJob: (job: VideoJob) => void;
  currentJobId?: string;
}

export function CompactJobList({ onSelectJob, currentJobId }: CompactJobListProps) {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    try {
      await dbManager.init();
      const allJobs = await dbManager.getAllJobs();
      const sortedJobs = allJobs.sort((a, b) => b.created_at - a.created_at).slice(0, 10);

      const jobsWithStats = await Promise.all(
        sortedJobs.map(async (job) => {
          const segments = await dbManager.getSegments(job.id);
          const frames = await dbManager.getFrames(job.id);
          const chapters = await dbManager.getChapters(job.id);

          return {
            ...job,
            segments_count: segments.length,
            frames_count: frames.length,
            chapters_count: chapters.length,
          };
        })
      );

      setJobs(jobsWithStats);
    } catch (error) {
      console.error('Failed to load jobs:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-2">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          最近处理
        </span>
      </div>

      {isLoading ? (
        <div className="text-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-gray-400 mx-auto" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-4 text-xs text-gray-500 dark:text-gray-400">
          暂无记录
        </div>
      ) : (
        <div className="space-y-1">
          {jobs.map((job) => {
            const isSelected = job.id === currentJobId;

            return (
              <button
                key={job.id}
                onClick={() => onSelectJob(job)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                  isSelected
                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="truncate flex-1">{job.file_name}</span>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ml-2 ${
                    job.status === 'Completed'
                      ? 'bg-green-500'
                      : job.status === 'Failed'
                      ? 'bg-red-500'
                      : 'bg-yellow-500'
                  }`} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
