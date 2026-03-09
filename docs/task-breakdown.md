# 产品需求工程任务清单

> **架构:** Rust WASM (核心逻辑) + Next.js (UI)

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Browser                                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    Next.js UI Layer                   │   │
│  │              (React + Tailwind CSS)                   │   │
│  │  • 用户输入                                            │   │
│  │  • 进度显示                                            │   │
│  │  • 结果展示                                            │   │
│  │  • 调用 Rust WASM                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                           │                                  │
│                           │ JavaScript FFI                   │
│                           ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                    Rust WASM                          │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │              Database Layer                     │  │   │
│  │  │  • SQLite (rusqlite + wasi-kv 替代)            │  │   │
│  │  │  • 或使用: sqlc + wasi-kv/IndexedDB            │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                                                       │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │              Core Logic                         │  │   │
│  │  │  • 字幕解析 (已有)                              │  │   │
│  │  │  • 文本处理 (已有)                              │  │   │
│  │  │  • 章节分析 (新增)                              │  │   │
│  │  │  • 任务管理 (新增)                              │  │   │
│  │  │  • 数据持久化 (新增)                            │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  │                                                       │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │              PPT Generation                     │  │   │
│  │  │  • PPTX 结构生成                                │  │   │
│  │  │  • 或调用 JS PptxGenJS                          │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              External APIs                            │   │
│  │     OpenAI / Anthropic (浏览器直连)                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 架构分层

```
┌─────────────────────────────────────────────────────────────┐
│  Next.js / React (UI Layer)                                │
│  职责: 用户交互、状态展示、调用 WASM                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ wasm-bindgen FFI
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  Rust WASM (Core Layer)                                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Database Layer                                       │   │
│  │  • SQLite (用 indexeddb 后端存储)                     │   │
│  │  • CRUD 操作                                          │   │
│  │  • 迁移管理                                           │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Business Logic                                       │   │
│  │  • 字幕解析                                           │   │
│  │  • 章节分析                                           │   │
│  │  • 任务管理                                           │   │
│  │  • AI 调用协调                                        │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Storage                                              │   │
│  │  • 大数据存储 (截图、PPT)                             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Rust 技术选型

### 数据库方案

| 方案 | 说明 | 推荐度 |
|------|------|--------|
| **sqlite-wasm** | rusqlite + wasi-kv | ⭐️⭐️⭐️⭐️⭐️ |
| **refinery** | Rust 数据库迁移工具 | ⭐️⭐️⭐️⭐️ |
| **sea-orm** | ORM 框架 | ⭐️⭐️⭐️ (偏重) |

**推荐:** 直接使用 `rusqlite` + IndexedDB 后端

```toml
# Cargo.toml
[dependencies]
wasm-bindgen = "0.2"
wasm-bindgen-futures = "0.4"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
serde-wasm-bindgen = "0.6"

# 数据库
rusqlite = { version = "0.32", features = ["bundled"] }

# PPT 生成 (可选)
pptx = "0.1"  # 或通过 JS 调用 PptxGenJS
```

---

## 文件结构

```
wasm/src/
├── lib.rs                        # WASM 入口，导出 FFI 函数
│
├── db/                           # 数据库层
│   ├── mod.rs
│   ├── connection.rs             # SQLite 连接管理
│   ├── models.rs                 # 数据模型
│   ├── schema.rs                 # 表结构定义
│   └── queries.rs                # CRUD 操作
│
├── core/                         # 核心业务逻辑
│   ├── mod.rs
│   ├── subtitle.rs               # 字幕处理 (已有)
│   ├── chapter.rs                # 章节分析 (新增)
│   ├── task.rs                   # 任务管理 (新增)
│   └── ai.rs                     # AI 调用协调 (新增)
│
├── parser/                       # 解析器 (已有)
│   ├── mod.rs
│   ├── vtt.rs
│   ├── ttml.rs
│   └── srt.rs
│
├── processor/                    # 处理器 (已有)
│   └── mod.rs
│
├── storage/                      # 存储层
│   ├── mod.rs
│   ├── indexeddb.rs              # IndexedDB 封装 (Rust 侧)
│   └── frames.rs                 # 截图存储
│
└── types/                        # 类型定义
    └── mod.rs

app/
├── lib/
│   └── wasm.ts                   # WASM 加载和 FFI 封装
│
├── components/                   # UI 组件
│   ├── UrlInput.tsx              # ✅ 已有
│   ├── LanguageSelector.tsx      # ✅ 已有
│   ├── MarkdownPreview.tsx       # ✅ 已有
│   ├── SettingsDialog.tsx        # ❌ 新增
│   ├── TaskList.tsx              # ❌ 新增 - 任务列表
│   ├── TaskDetail.tsx            # ❌ 新增 - 任务详情
│   └── ExportButton.tsx          # ❌ 新增
│
└── hooks/
    ├── useWasm.ts                # WASM 实例管理
    └── useTask.ts                # 任务状态管理
```

---

## Rust 数据模型

```rust
// wasm/src/db/models.rs

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserConfig {
    pub id: i32,
    pub ai_provider: String,
    pub api_key: String,
    pub model: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    pub id: i32,
    pub video_id: String,
    pub video_url: String,
    pub video_title: Option<String>,
    pub video_thumbnail: Option<String>,
    pub status: TaskStatus,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TaskStatus {
    Pending,
    Processing,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Chapter {
    pub id: i32,
    pub task_id: i32,
    pub title: String,
    pub start_time: f64,
    pub end_time: f64,
    pub summary: Option<String>,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Slide {
    pub id: i32,
    pub task_id: i32,
    pub chapter_id: Option<i32>,
    pub title: String,
    pub bullets: Vec<String>,
    pub image_time: Option<f64>,
    pub sort_order: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Frame {
    pub id: i32,
    pub task_id: i32,
    pub slide_id: Option<i32>,
    pub time: f64,
    pub indexeddb_key: String,
    pub description: Option<String>,
}
```

---

## Rust FFI 导出

```rust
// wasm/src/lib.rs

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WASMApp {
    db: DbConnection,
}

#[wasm_bindgen]
impl WASMApp {
    #[wasm_bindgen(constructor)]
    pub async fn new() -> Result<WASMApp, JsValue> {
        let db = DbConnection::new().await?;
        Ok(WASMApp { db })
    }

    // 用户配置
    pub async fn get_config(&self) -> Result<JsValue, JsValue>;
    pub async fn save_config(&self, config: JsValue) -> Result<(), JsValue>;

    // 任务
    pub async fn create_task(&self, video: JsValue) -> Result<i32, JsValue>;
    pub async fn get_task(&self, id: i32) -> Result<JsValue, JsValue>;
    pub async fn list_tasks(&self, limit: i32) -> Result<JsValue, JsValue>;
    pub async fn update_task_status(&self, id: i32, status: String) -> Result<(), JsValue>;

    // 字幕 (已有)
    pub async fn parse_subtitle(&self, content: &str, format: &str) -> Result<JsValue, JsValue>;

    // 章节
    pub async fn analyze_chapters(&self, subtitle: &str) -> Result<JsValue, JsValue>;
    pub async fn save_chapters(&self, task_id: i32, chapters: JsValue) -> Result<(), JsValue>;
    pub async fn get_chapters(&self, task_id: i32) -> Result<JsValue, JsValue>;

    // 幻灯片
    pub async fn save_slides(&self, task_id: i32, slides: JsValue) -> Result<(), JsValue>;
    pub async fn get_slides(&self, task_id: i32) -> Result<JsValue, JsValue>;

    // 截图
    pub async fn save_frame(&self, task_id: i32, frame: JsValue) -> Result<i32, JsValue>;
    pub async fn get_frames(&self, task_id: i32) -> Result<JsValue, JsValue>;

    // PPT 生成
    pub async fn generate_ppt(&self, task_id: i32) -> Result<JsValue, JsValue>;

    // 文本处理 (已有)
    pub async fn process_text(&self, text: &str, options: JsValue) -> Result<JsValue, JsValue>;

    // Markdown (已有)
    pub async fn generate_markdown(&self, data: JsValue) -> Result<String, JsValue>;
}
```

---

## 数据库 Schema

```rust
// wasm/src/db/schema.rs

pub const SCHEMA: &str = r#"
-- 用户配置
CREATE TABLE IF NOT EXISTS user_config (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    ai_provider TEXT NOT NULL DEFAULT 'openai',
    api_key TEXT NOT NULL,
    model TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 任务
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id TEXT NOT NULL,
    video_url TEXT NOT NULL,
    video_title TEXT,
    video_thumbnail TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 字幕
CREATE TABLE IF NOT EXISTS subtitles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    video_id TEXT NOT NULL,
    language TEXT NOT NULL,
    content TEXT NOT NULL,
    format TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- 章节
CREATE TABLE IF NOT EXISTS chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    start_time REAL NOT NULL,
    end_time REAL NOT NULL,
    summary TEXT,
    sort_order INTEGER NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id)
);

-- 幻灯片
CREATE TABLE IF NOT EXISTS slides (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    chapter_id INTEGER,
    title TEXT NOT NULL,
    bullets TEXT NOT NULL,
    image_time REAL,
    sort_order INTEGER NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (chapter_id) REFERENCES chapters(id)
);

-- 截图
CREATE TABLE IF NOT EXISTS frames (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL,
    slide_id INTEGER,
    time REAL NOT NULL,
    indexeddb_key TEXT NOT NULL,
    description TEXT,
    FOREIGN KEY (task_id) REFERENCES tasks(id),
    FOREIGN KEY (slide_id) REFERENCES slides(id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_tasks_video_id ON tasks(video_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chapters_task_id ON chapters(task_id);
CREATE INDEX IF NOT EXISTS idx_slides_task_id ON slides(task_id);
"#;
```

---

## Next.js 调用示例

```typescript
// app/lib/wasm.ts

import initWasm, { WASMApp } from '../../../wasm/pkg';

let wasmApp: WASMApp | null = null;

export async function getWasmApp(): Promise<WASMApp> {
  if (!wasmApp) {
    await initWasm();
    wasmApp = await new WASMApp();
  }
  return wasmApp;
}

// app/components/TaskList.tsx
'use client';

import { useEffect, useState } from 'react';
import { getWasmApp } from '@/lib/wasm';

export function TaskList() {
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    (async () => {
      const app = await getWasmApp();
      const result = await app.list_tasks(20);
      setTasks(JSON.parse(result));
    })();
  }, []);

  return (
    <div>
      {tasks.map(task => (
        <div key={task.id}>{task.video_title}</div>
      ))}
    </div>
  );
}
```

---

## 任务优先级

### P0 - 核心 Rust 逻辑 (2~3周)

#### Phase 1: 数据库层 (3天)
- [ ] SQLite 集成 (rusqlite)
- [ ] Schema 定义和初始化
- [ ] CRUD 操作封装
- [ ] FFI 导出

#### Phase 2: 核心业务逻辑 (4天)
- [ ] 任务管理模块
- [ ] 章节分析算法
- [ ] AI 调用协调
- [ ] 字幕处理扩展

#### Phase 3: 存储层 (2天)
- [ ] IndexedDB 封装
- [ ] 大数据存储

#### Phase 4: PPT 生成 (3天)
- [ ] PPTX 结构生成
- [ ] 或 JS PptxGenJS 集成

#### Phase 5: UI 对接 (3天)
- [ ] 设置对话框
- [ ] 任务列表
- [ ] 进度显示
- [ ] 结果展示

---

## 数据流

```
Next.js UI
    │
    │ FFI 调用
    ▼
Rust WASM
    │
    ├─► SQLite (内存中)
    │       │
    │       ▼
    │   IndexedDB (持久化)
    │
    ├─► AI API (fetch)
    │
    └─► 返回结果
            │
            ▼
        Next.js UI
```

---

## 验收标准

### P0 MVP
- [ ] Rust 实现所有核心逻辑
- [ ] Next.js 只负责 UI
- [ ] 数据持久化正常
- [ ] 历史记录可查询
