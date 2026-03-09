/**
 * Database Module Entry Point
 * Exports all database functionality
 *
 * 支持的持久化方案：
 * 1. Rust SQLite3 (推荐) - 纯 Rust WASM 实现，基于 LocalStorage
 * 2. IndexedDB - 备选方案
 */

// ============================================
// Rust SQLite3 实现 (推荐)
// 纯 Rust WASM 端实现，无需 JavaScript 依赖
// ============================================
export {
  initRustSQLite3,
  createJob,
  getJob,
  getAllJobs,
  updateJobStatus,
  updateJobProgress,
  deleteJob,
  createSegment,
  getSegments,
  createFrame,
  getFrames,
  updateFrameOcr,
  createChapter,
  getChapters,
  getStats,
  cleanupOldData,
  exportJobData,
  clearDatabase,
  saveDatabase,
  type JobRow,
  type SegmentRow,
  type FrameRow,
  type ChapterRow,
  type DatabaseStats as RustDatabaseStats,
} from './rust-sqlite-wrapper';

// ============================================
// IndexedDB 实现 (备选方案)
// ============================================
export {
  VideoDatabase,
  getDatabase,
  closeDatabase as closeIndexedDB,
  resetDatabase as resetIndexedDB,
} from './indexeddb';

// Migration utilities
export {
  MigrationRunner,
  DataMigrator,
  exportDatabaseForMigration,
  importDatabaseForMigration,
  getMigrationStatus,
} from './migrations';

// Export/import utilities
export {
  exportToFile,
  importFromFile,
  downloadExport,
  exportAsSRT,
  exportAsVTT,
  exportAsTranscript,
  createBackup,
  restoreBackup,
  type ExportResult,
  type ImportResult,
  type ExportFormat,
} from './export';

// React hooks
export {
  useJobs,
  useJob,
  useDatabaseStats,
  useDatabase,
} from './hooks';

// Re-export types
export type {
  VideoJob,
  TranscriptSegment,
  KeyFrame,
  Chapter,
  JobStatus,
  JobQueryFilters,
  DatabaseStats,
  JobExportData,
  ExportOptions,
} from '../models/types';
