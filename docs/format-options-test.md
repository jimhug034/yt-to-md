# 格式选项功能测试指南

## 功能说明

新增的字幕格式选项功能允许用户自定义 Markdown 输出格式：

1. **紧凑模式 (Compact Mode)**: 将离散的字幕片段合并成连贯的段落
2. **时间戳开关 (Include Timestamps)**: 选择是否在输出中包含时间戳链接

## 浏览器手动测试步骤

### 1. 启动应用
```bash
npm run dev
```
访问 http://localhost:3000

### 2. 测试紧凑模式

#### 步骤:
1. 输入一个 YouTube 视频 URL（建议使用有中文字幕的视频）
   - 示例: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`

2. 选择字幕语言

3. 在预览页面，找到格式选项面板

4. 观察紧凑模式开启时的输出:
   - 应该看到连贯的段落，而不是每行一个时间戳

5. 取消紧凑模式:
   - 应该恢复到原始格式（每行一个片段）

### 3. 测试时间戳开关

#### 步骤:
1. 在紧凑模式关闭的状态下，开启时间戳
   - 每行应该有 `[00:00]` 格式的时间戳链接

2. 在紧凑模式开启的状态下，开启时间戳
   - 每个段落开头应该有一个时间戳

## 输出示例对比

### 原始格式 (Compact Mode OFF, Timestamps ON)
```markdown
[00:00](url) 大家好

[00:02](url) 今天我们来讨论

[00:05](url) 一个有趣的话题

[00:07](url) 关于人工智能的发展
```

### 紧凑格式 (Compact Mode ON, Timestamps OFF)
```markdown
大家好，今天我们来讨论一个有趣的话题，关于人工智能的发展。这个领域最近取得了很大的进步，特别是在深度学习和自然语言处理方面。让我们一起探讨这些技术是如何改变我们的生活的。
```

### 紧凑格式 + 时间戳 (Compact Mode ON, Timestamps ON)
```markdown
[00:00](url) 大家好，今天我们来讨论一个有趣的话题，关于人工智能的发展。

[00:30](url) 这个领域最近取得了很大的进步，特别是在深度学习和自然语言处理方面。
```

## 自动化测试

运行 E2E 测试:
```bash
npx playwright test e2e/suite-07-format-options.spec.ts
```

查看测试报告:
```bash
npx playwright show-report
```

## API 测试

直接测试字幕处理 API:
```bash
# 获取字幕
curl "http://localhost:3000/api/subtitles?videoId=VIDEO_ID&lang=zh"
```

## 单元测试

测试字幕处理逻辑:
```bash
node -e "
const { processSubtitles } = require('./app/lib/subtitle-processor');

const entries = [
  { index: 1, startTime: 0, endTime: 2500, text: '大家好' },
  { index: 2, startTime: 2500, endTime: 5500, text: '今天我们来讨论' },
  { index: 3, startTime: 5500, endTime: 7500, text: '一个有趣的话题' },
  { index: 4, startTime: 7500, endTime: 11500, text: '关于人工智能的发展。' },
];

console.log('紧凑模式输出:');
console.log(processSubtitles(entries, { compactMode: true, includeTimestamps: false }));
"
```
