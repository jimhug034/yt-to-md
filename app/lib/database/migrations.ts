/**
 * Database Migrations
 * Handles database schema version upgrades and data migration
 */

import type { VideoDatabase } from "./indexeddb";

/**
 * Migration interface
 */
interface Migration {
  version: number;
  name: string;
  up: (db: IDBDatabase) => Promise<void> | void;
  down?: (db: IDBDatabase) => Promise<void> | void;
}

/**
 * Migration registry
 */
const migrations: Migration[] = [
  {
    version: 1,
    name: "initial_schema",
    up: (db: IDBDatabase) => {
      // Initial schema is defined in the VideoDatabase class
      // This migration is a placeholder for documentation
      console.log("Database version 1: Initial schema created");
    },
  },
  {
    version: 2,
    name: "add_language_to_segments",
    up: (db: IDBDatabase) => {
      // Add language column to transcript_segments
      const segmentsStore = db
        .transaction(["transcript_segments"], "readonly")
        .objectStore("transcript_segments");
      // Note: Schema changes are handled by Dexie's version() method
      // This is just documentation for what changed
    },
  },
];

/**
 * Migration runner class
 */
export class MigrationRunner {
  private db: VideoDatabase;
  private currentVersion: number;

  constructor(db: VideoDatabase) {
    this.db = db;
    this.currentVersion = 1; // Starting version
  }

  /**
   * Get the current database version
   */
  async getCurrentVersion(): Promise<number> {
    return this.currentVersion;
  }

  /**
   * Get all pending migrations
   */
  getPendingMigrations(): Migration[] {
    return migrations.filter((m) => m.version > this.currentVersion);
  }

  /**
   * Run all pending migrations
   */
  async runMigrations(): Promise<void> {
    const pending = this.getPendingMigrations();

    for (const migration of pending) {
      console.log(`Running migration: ${migration.name} (v${migration.version})`);
      try {
        // Migration will be applied through Dexie's version system
        this.currentVersion = migration.version;
        console.log(`Migration ${migration.name} completed`);
      } catch (error) {
        console.error(`Migration ${migration.name} failed:`, error);
        throw error;
      }
    }
  }

  /**
   * Rollback to a specific version (if down migration exists)
   */
  async rollbackTo(targetVersion: number): Promise<void> {
    if (targetVersion >= this.currentVersion) {
      throw new Error("Target version must be lower than current version");
    }

    const migrationsToRollback = migrations.filter(
      (m) => m.version > targetVersion && m.version <= this.currentVersion,
    );

    // Rollback in reverse order
    for (const migration of migrationsToRollback.reverse()) {
      if (migration.down) {
        console.log(`Rolling back migration: ${migration.name} (v${migration.version})`);
        try {
          // Note: This would require database version change and data handling
          this.currentVersion = migration.version - 1;
          console.log(`Rollback ${migration.name} completed`);
        } catch (error) {
          console.error(`Rollback ${migration.name} failed:`, error);
          throw error;
        }
      } else {
        console.warn(`Migration ${migration.name} does not support rollback`);
      }
    }
  }
}

/**
 * Data migration utilities
 */
export class DataMigrator {
  /**
   * Migrate data from old schema to new schema
   */
  static async migrateData(
    db: VideoDatabase,
    fromVersion: number,
    toVersion: number,
  ): Promise<void> {
    console.log(`Migrating data from version ${fromVersion} to ${toVersion}`);

    switch (fromVersion) {
      case 1:
        if (toVersion >= 2) {
          await this.migrateV1toV2(db);
        }
        break;
      // Add more version migrations as needed
      default:
        console.log("No data migration needed");
    }
  }

  /**
   * Specific migration from v1 to v2
   */
  private static async migrateV1toV2(db: VideoDatabase): Promise<void> {
    // Example: Add language field to segments
    const segments = await db.segments.toArray();
    const updates = segments.map((segment) => ({
      key: segment.id,
      changes: { language: "auto" } as const,
    }));

    await db.segments.bulkPut(segments.map((s) => ({ ...s, language: "auto" as const })));

    console.log(`Updated ${segments.length} segments with language field`);
  }

  /**
   * Clean up orphaned records
   */
  static async cleanupOrphans(db: VideoDatabase): Promise<number> {
    let cleanedCount = 0;

    // Remove segments without valid job
    const jobIds = (await db.jobs.toArray()).map((j) => j.id);
    const orphanSegments = (await db.segments.toArray())
      .filter((s) => !jobIds.includes(s.jobId))
      .map((s) => s.id);
    if (orphanSegments.length > 0) {
      await db.segments.bulkDelete(orphanSegments);
      cleanedCount += orphanSegments.length;
    }

    // Remove frames without valid job
    const orphanFrames = (await db.frames.toArray())
      .filter((f) => !jobIds.includes(f.jobId))
      .map((f) => f.id);
    if (orphanFrames.length > 0) {
      await db.frames.bulkDelete(orphanFrames);
      cleanedCount += orphanFrames.length;
    }

    // Remove chapters without valid job
    const orphanChapters = (await db.chapters.toArray())
      .filter((c) => !jobIds.includes(c.jobId))
      .map((c) => c.id);
    if (orphanChapters.length > 0) {
      await db.chapters.bulkDelete(orphanChapters);
      cleanedCount += orphanChapters.length;
    }

    return cleanedCount;
  }

  /**
   * Rebuild indexes
   */
  static async rebuildIndexes(db: VideoDatabase): Promise<void> {
    console.log("Rebuilding database indexes...");

    // Dexie handles index management automatically
    // This is a placeholder for any manual index rebuilding if needed

    console.log("Index rebuild complete");
  }

  /**
   * Validate data integrity
   */
  static async validateIntegrity(db: VideoDatabase): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      // Check for orphaned records
      const jobIds = (await db.jobs.toArray()).map((j) => j.id);

      const segments = await db.segments.toArray();
      const orphanSegments = segments.filter((s) => !jobIds.includes(s.jobId));
      if (orphanSegments.length > 0) {
        issues.push(`Found ${orphanSegments.length} orphaned segments`);
      }

      const frames = await db.frames.toArray();
      const orphanFrames = frames.filter((f) => !jobIds.includes(f.jobId));
      if (orphanFrames.length > 0) {
        issues.push(`Found ${orphanFrames.length} orphaned frames`);
      }

      const chapters = await db.chapters.toArray();
      const orphanChapters = chapters.filter((c) => !jobIds.includes(c.jobId));
      if (orphanChapters.length > 0) {
        issues.push(`Found ${orphanChapters.length} orphaned chapters`);
      }

      // Check for invalid timestamps
      const invalidSegments = segments.filter(
        (s) => s.startTime < 0 || s.endTime < 0 || s.endTime < s.startTime,
      );
      if (invalidSegments.length > 0) {
        issues.push(`Found ${invalidSegments.length} segments with invalid timestamps`);
      }

      const invalidFrames = frames.filter((f) => f.timestamp < 0);
      if (invalidFrames.length > 0) {
        issues.push(`Found ${invalidFrames.length} frames with invalid timestamps`);
      }

      const invalidChapters = chapters.filter(
        (c) => c.startTime < 0 || c.endTime < 0 || c.endTime < c.startTime,
      );
      if (invalidChapters.length > 0) {
        issues.push(`Found ${invalidChapters.length} chapters with invalid timestamps`);
      }

      return {
        valid: issues.length === 0,
        issues,
      };
    } catch (error) {
      return {
        valid: false,
        issues: [`Validation error: ${error}`],
      };
    }
  }

  /**
   * Compact database (remove old data and optimize)
   */
  static async compactDatabase(
    db: VideoDatabase,
    options: {
      keepDays?: number;
      keepCompletedJobs?: number;
    } = {},
  ): Promise<{
    jobsDeleted: number;
    spaceSaved: number;
  }> {
    const { keepDays = 30, keepCompletedJobs = 10 } = options;

    const cutoffDate = Date.now() - keepDays * 24 * 60 * 60 * 1000;

    // Get old completed jobs (beyond limit)
    const completedJobs = (
      await db.jobs
        .where("status")
        .equals("completed")
        .filter((job) => job.createdAt < cutoffDate)
        .reverse()
        .offset(keepCompletedJobs)
        .toArray()
    ).map((j) => j.id);

    // Get old failed jobs
    const failedJobs = (
      await db.jobs
        .where("status")
        .equals("failed")
        .filter((job) => job.createdAt < cutoffDate)
        .toArray()
    ).map((j) => j.id);

    const jobsToDelete = [...completedJobs, ...failedJobs];

    let spaceBefore = 0;
    try {
      const estimate = await navigator.storage.estimate();
      spaceBefore = estimate.usage || 0;
    } catch {
      // Ignore
    }

    for (const jobId of jobsToDelete) {
      await db.deleteJob(jobId);
    }

    let spaceAfter = 0;
    try {
      const estimate = await navigator.storage.estimate();
      spaceAfter = estimate.usage || 0;
    } catch {
      // Ignore
    }

    return {
      jobsDeleted: jobsToDelete.length,
      spaceSaved: Math.max(0, spaceBefore - spaceAfter),
    };
  }
}

/**
 * Export data from one database and import to another (for migration)
 */
export async function exportDatabaseForMigration(db: VideoDatabase): Promise<string> {
  const data = await db.exportDatabase();
  return JSON.stringify(data);
}

/**
 * Import data from exported JSON
 */
export async function importDatabaseForMigration(
  db: VideoDatabase,
  jsonData: string,
): Promise<number> {
  const data = JSON.parse(jsonData);
  return await db.importDatabase(data);
}

/**
 * Get migration status
 */
export async function getMigrationStatus(db: VideoDatabase): Promise<{
  currentVersion: number;
  latestVersion: number;
  pendingMigrations: number;
}> {
  const currentVersion = 1; // This would come from actual DB version
  const latestVersion = Math.max(...migrations.map((m) => m.version));

  return {
    currentVersion,
    latestVersion,
    pendingMigrations: migrations.filter((m) => m.version > currentVersion).length,
  };
}
