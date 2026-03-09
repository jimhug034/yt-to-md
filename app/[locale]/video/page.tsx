import { VideoProcessor } from '@/app/components/video/VideoProcessor';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Video to PPT & Notes',
  description: 'Convert local videos to PowerPoint presentations and structured notes',
};

export default function VideoPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Video to PPT & Notes
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Upload a video to generate presentations and structured notes
          </p>
        </header>

        <VideoProcessor />
      </div>
    </main>
  );
}
