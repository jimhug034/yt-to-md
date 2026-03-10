/**
 * Settings Dialog
 *
 * 用户设置对话框：API Key 配置、语言偏好、模型选择
 */

'use client';

import { useState, useCallback } from 'react';
import {
  X,
  Settings as SettingsIcon,
  Save,
  RotateCcw,
  Key,
  Languages,
  Cpu,
  Volume2,
} from 'lucide-react';

export interface Settings {
  // OpenAI API
  openaiApiKey?: string;
  // Whisper 设置
  whisperModel: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  whisperLanguage: string;
  // OCR 设置
  ocrLanguage: 'ch' | 'en' | 'korean' | 'japan' | 'auto';
  ocrEnabled: boolean;
  // PPTX 设置
  pptxTemplate: 'default' | 'minimal' | 'professional';
  pptxIncludeFrames: boolean;
  // 存储设置
  storageBackend: 'rust-sqlite' | 'indexed-db';
}

const DEFAULT_SETTINGS: Settings = {
  whisperModel: 'tiny',
  whisperLanguage: 'auto',
  ocrLanguage: 'auto',
  ocrEnabled: true,
  pptxTemplate: 'default',
  pptxIncludeFrames: true,
  storageBackend: 'rust-sqlite',
};

interface SettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: Settings) => void;
  currentSettings?: Partial<Settings>;
}

export function SettingsDialog({
  isOpen,
  onClose,
  onSave,
  currentSettings = {},
}: SettingsDialogProps) {
  const [settings, setSettings] = useState<Settings>({
    ...DEFAULT_SETTINGS,
    ...currentSettings,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'whisper' | 'ocr' | 'pptx'>('general');

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      // 保存到 LocalStorage
      localStorage.setItem('video-processor-settings', JSON.stringify(settings));
      onSave(settings);
      onClose();
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  }, [settings, onSave, onClose]);

  const handleReset = useCallback(() => {
    setSettings({ ...DEFAULT_SETTINGS, ...currentSettings });
  }, [currentSettings]);

  const handleResetToDefaults = useCallback(() => {
    if (confirm('确定要重置所有设置为默认值吗？')) {
      setSettings(DEFAULT_SETTINGS);
      localStorage.removeItem('video-processor-settings');
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
              <SettingsIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                设置
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                配置处理选项和偏好
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'general', label: '通用', icon: SettingsIcon },
            { id: 'whisper', label: 'Whisper', icon: Volume2 },
            { id: 'ocr', label: 'OCR', icon: Languages },
            { id: 'pptx', label: 'PPTX', icon: Cpu },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* 存储后端 */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Cpu className="w-4 h-4" />
                  存储后端
                </label>
                <select
                  value={settings.storageBackend}
                  onChange={(e) => setSettings({ ...settings, storageBackend: e.target.value as Settings['storageBackend'] })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="rust-sqlite">Rust SQLite (LocalStorage)</option>
                  <option value="indexed-db">IndexedDB (更大容量)</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  选择数据持久化方案。IndexedDB 适合大量帧数据存储。
                </p>
              </div>

              {/* API Keys */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  <Key className="w-4 h-4" />
                  API Keys（可选）
                </label>
                <input
                  type="password"
                  value={settings.openaiApiKey || ''}
                  onChange={(e) => setSettings({ ...settings, openaiApiKey: e.target.value })}
                  placeholder="sk-..."
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  用于 AI 增强功能（可选）。密钥仅存储在本地浏览器中。
                </p>
              </div>
            </div>
          )}

          {activeTab === 'whisper' && (
            <div className="space-y-6">
              {/* 模型选择 */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Whisper 模型
                </label>
                <select
                  value={settings.whisperModel}
                  onChange={(e) => setSettings({ ...settings, whisperModel: e.target.value as Settings['whisperModel'] })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="tiny">Tiny（最快，精度较低）</option>
                  <option value="base">Base（平衡）</option>
                  <option value="small">Small（较好精度）</option>
                  <option value="medium">Medium（高精度）</option>
                  <option value="large">Large（最高精度，最慢）</option>
                </select>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span>推荐使用 Tiny 模型以获得最佳性能</span>
                </div>
              </div>

              {/* 语言选择 */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  识别语言
                </label>
                <select
                  value={settings.whisperLanguage}
                  onChange={(e) => setSettings({ ...settings, whisperLanguage: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="auto">自动检测</option>
                  <option value="zh">中文</option>
                  <option value="en">英语</option>
                  <option value="zh+en">中英混合</option>
                  <option value="es">西班牙语</option>
                  <option value="fr">法语</option>
                  <option value="de">德语</option>
                  <option value="ja">日语</option>
                  <option value="ko">韩语</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'ocr' && (
            <div className="space-y-6">
              {/* 启用 OCR */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    启用文字识别 (OCR)
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    从视频帧中提取文字内容
                  </p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, ocrEnabled: !settings.ocrEnabled })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    settings.ocrEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      settings.ocrEnabled ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>

              {/* OCR 语言 */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  OCR 语言
                </label>
                <select
                  value={settings.ocrLanguage}
                  onChange={(e) => setSettings({ ...settings, ocrLanguage: e.target.value as Settings['ocrLanguage'] })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!settings.ocrEnabled}
                >
                  <option value="auto">自动检测</option>
                  <option value="ch">中文 (简体)</option>
                  <option value="en">英语</option>
                  <option value="korean">韩语</option>
                  <option value="japan">日语</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'pptx' && (
            <div className="space-y-6">
              {/* 模板选择 */}
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  PPTX 模板
                </label>
                <select
                  value={settings.pptxTemplate}
                  onChange={(e) => setSettings({ ...settings, pptxTemplate: e.target.value as Settings['pptxTemplate'] })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="default">默认模板</option>
                  <option value="minimal">简约模板</option>
                  <option value="professional">专业模板</option>
                </select>
              </div>

              {/* 包含帧 */}
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    导出时包含关键帧
                  </label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    在幻灯片中包含视频截图
                  </p>
                </div>
                <button
                  onClick={() => setSettings({ ...settings, pptxIncludeFrames: !settings.pptxIncludeFrames })}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    settings.pptxIncludeFrames ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      settings.pptxIncludeFrames ? 'translate-x-6' : ''
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 rounded-b-2xl">
          <button
            onClick={handleResetToDefaults}
            className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            重置为默认值
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {isSaving ? '保存中...' : '保存设置'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Settings Button - 触发设置对话框
 */

interface SettingsButtonProps {
  onSettingsChange?: (settings: Partial<Settings>) => void;
  settings?: Partial<Settings>;
}

export function SettingsButton({ onSettingsChange, settings }: SettingsButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  // 加载已保存的设置
  const [currentSettings, setCurrentSettings] = useState<Partial<Settings>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('video-processor-settings');
        return saved ? JSON.parse(saved) : {};
      } catch {
        return {};
      }
    }
    return {};
  });

  const handleSave = (newSettings: Settings) => {
    setCurrentSettings(newSettings);
    onSettingsChange?.(newSettings);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        title="设置"
      >
        <SettingsIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
      </button>

      <SettingsDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSave={handleSave}
        currentSettings={{ ...currentSettings, ...settings }}
      />
    </>
  );
}
