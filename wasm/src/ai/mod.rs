// AI 处理模块 - 规则引擎

use crate::database::{Chapter, TranscriptSegment};
use wasm_bindgen::prelude::*;

/// 文本摘要规则引擎
#[wasm_bindgen]
pub struct Summarizer {
    max_sentences: usize,
}

#[wasm_bindgen]
impl Summarizer {
    #[wasm_bindgen(constructor)]
    pub fn new(max_sentences: usize) -> Self {
        Self { max_sentences }
    }

    /// 生成摘要（基于规则）
    /// 1. 提取关键句（包含关键词的句子）
    /// 2. 保留首尾句
    /// 3. 去除重复
    #[wasm_bindgen]
    pub fn summarize(&self, text: &str) -> String {
        let sentences: Vec<&str> = text
            .split_inclusive(&['.', '。', '!', '！', '?', '？'][..])
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();

        if sentences.is_empty() {
            return String::new();
        }

        if sentences.len() <= self.max_sentences {
            return sentences.join("");
        }

        let mut selected = Vec::new();

        // 总是包含第一句
        if !sentences.is_empty() {
            selected.push(sentences[0]);
        }

        // 包含最后一句
        if sentences.len() > 1 {
            selected.push(sentences[sentences.len() - 1]);
        }

        // 选择包含关键词的中间句子
        let keywords = [
            "重要",
            "关键",
            "因此",
            "所以",
            "总之",
            "结论",
            "important",
            "therefore",
            "conclusion",
        ];

        for sentence in sentences.iter().skip(1).take(sentences.len() - 2) {
            if selected.len() >= self.max_sentences {
                break;
            }

            let lower = sentence.to_lowercase();
            let has_keyword = keywords.iter().any(|kw| lower.contains(kw));

            if has_keyword && !selected.contains(sentence) {
                selected.push(sentence);
            }
        }

        // 如果还没满，填充中间句子
        if selected.len() < self.max_sentences {
            let mid = sentences.len() / 2;
            for (i, sentence) in sentences.iter().enumerate() {
                if selected.len() >= self.max_sentences {
                    break;
                }
                if i != 0 && i != sentences.len() - 1 && !selected.contains(sentence) {
                    if i >= mid - 1 && i <= mid + 1 {
                        selected.push(sentence);
                    }
                }
            }
        }

        // 按原始顺序排序
        selected.sort_by_key(|s| sentences.iter().position(|&x| x == *s));

        selected.join("")
    }

    /// 从字幕片段生成摘要
    #[wasm_bindgen]
    pub fn summarize_segments(&self, segments_json: &str) -> String {
        let segments: Vec<TranscriptSegment> =
            match serde_json::from_str(segments_json) {
                Ok(v) => v,
                Err(_) => return String::new(),
            };

        let full_text: String = segments
            .iter()
            .map(|s| s.text.as_str())
            .collect::<Vec<_>>()
            .join(" ");

        self.summarize(&full_text)
    }
}

/// 章节分割器
#[wasm_bindgen]
pub struct Chapterizer {
    min_chapter_duration: f64,
    silence_threshold: f32,
}

#[wasm_bindgen]
impl Chapterizer {
    #[wasm_bindgen(constructor)]
    pub fn new(min_duration: f64, silence_threshold: f32) -> Self {
        Self {
            min_chapter_duration: min_duration,
            silence_threshold,
        }
    }

    /// 基于规则分割章节
    /// 1. 检测长时间静音
    /// 2. 基于字幕密度变化
    /// 3. 固定时间间隔（兜底）
    #[wasm_bindgen]
    pub fn split_chapters(
        &self,
        segments_json: &str,
        total_duration: f64,
        job_id: &str,
    ) -> String {
        let segments: Vec<TranscriptSegment> =
            match serde_json::from_str(segments_json) {
                Ok(v) => v,
                Err(_) => return "[]".to_string(),
            };

        if segments.is_empty() {
            return "[]".to_string();
        }

        let mut chapters = Vec::new();
        let mut chapter_start = segments[0].start_time;
        let mut last_segment_end = segments[0].end_time;
        let mut silence_accumulator = 0.0;

        // 关键词检测
        let chapter_keywords = [
            "第一章",
            "第二章",
            "第一",
            "第二",
            "chapter",
            "part",
            "接下来",
            "然后",
            "首先",
        ];

        for (i, segment) in segments.iter().enumerate() {
            let gap = segment.start_time - last_segment_end;

            // 检测是否为新章节
            let is_new_chapter = gap > self.silence_threshold as f64 * 1000.0
                || {
                    let text_start: String = segment.text.chars().take(10).collect();
                    text_start.to_lowercase().split_whitespace().any(|word| {
                        chapter_keywords.iter().any(|kw| *kw == word)
                    })
                }
                || (segment.start_time - chapter_start >= self.min_chapter_duration
                    && i > 0
                    && i % 10 == 0);

            if is_new_chapter && segment.start_time - chapter_start >= 60.0 {
                // 创建新章节
                let title = self.generate_chapter_title(&segments, i, chapters.len());
                chapters.push(Chapter::new(
                    job_id.to_string(),
                    title,
                    chapter_start,
                    last_segment_end,
                ));
                chapter_start = segment.start_time;
            }

            last_segment_end = segment.end_time;
        }

        // 添加最后一章
        let title = self.generate_chapter_title(&segments, segments.len(), chapters.len());
        chapters.push(Chapter::new(
            job_id.to_string(),
            title,
            chapter_start,
            last_segment_end,
        ));

        serde_json::to_string(&chapters).unwrap_or_default()
    }

    /// 生成章节标题
    fn generate_chapter_title(
        &self,
        segments: &[TranscriptSegment],
        end_index: usize,
        chapter_num: usize,
    ) -> String {
        let start_idx = if chapter_num == 0 {
            0
        } else {
            end_index.saturating_sub(20)
        };

        let title_text: String = segments[start_idx..end_index.min(segments.len())]
            .iter()
            .take(5)
            .map(|s| s.text.as_str())
            .collect::<Vec<_>>()
            .join(" ");

        // 截取前 20 个字符
        let short_title: String = title_text.chars().take(20).collect();

        if short_title.is_empty() {
            format!("Chapter {}", chapter_num + 1)
        } else {
            format!("Chapter {}: {}...", chapter_num + 1, short_title)
        }
    }

    /// 为章节生成摘要
    #[wasm_bindgen]
    pub fn generate_chapter_summary(
        &self,
        segments_json: &str,
        start_time: f64,
        end_time: f32,
    ) -> String {
        let segments: Vec<TranscriptSegment> =
            match serde_json::from_str(segments_json) {
                Ok(v) => v,
                Err(_) => return String::new(),
            };

        let chapter_segments: Vec<_> = segments
            .iter()
            .filter(|s| s.start_time >= start_time && s.end_time <= end_time as f64)
            .collect();

        let text: String = chapter_segments
            .iter()
            .map(|s| s.text.as_str())
            .collect::<Vec<_>>()
            .join(" ");

        let summarizer = Summarizer::new(3);
        summarizer.summarize(&text)
    }
}

/// 文本处理工具
#[wasm_bindgen]
pub struct TextProcessor;

#[wasm_bindgen]
impl TextProcessor {
    /// 移除重复文本
    #[wasm_bindgen]
    pub fn remove_duplicates(text: &str, threshold: f32) -> String {
        let sentences: Vec<&str> = text
            .split(&['.', '。', '!', '！', '?', '？'][..])
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .collect();

        if sentences.is_empty() {
            return String::new();
        }

        let mut unique = Vec::new();
        let mut normalized_seen: Vec<String> = Vec::new();

        for sentence in &sentences {
            let normalized = sentence.to_lowercase().replace(" ", "");

            let is_duplicate = normalized_seen.iter().any(|seen| {
                Self::similarity(&normalized, seen) > threshold
            });

            if !is_duplicate {
                unique.push(*sentence);
                normalized_seen.push(normalized);
            }
        }

        unique.join(". ")
    }

    /// 计算相似度（Jaccard）
    fn similarity(a: &str, b: &str) -> f32 {
        if a.is_empty() && b.is_empty() {
            return 1.0;
        }
        if a.is_empty() || b.is_empty() {
            return 0.0;
        }

        let a_chars: std::collections::HashSet<char> = a.chars().collect();
        let b_chars: std::collections::HashSet<char> = b.chars().collect();

        let intersection = a_chars.intersection(&b_chars).count();
        let union = a_chars.union(&b_chars).count();

        if union == 0 {
            0.0
        } else {
            intersection as f32 / union as f32
        }
    }

    /// 提取关键词
    #[wasm_bindgen]
    pub fn extract_keywords(text: &str, top_n: usize) -> String {
        let words: Vec<&str> = text.split_whitespace().collect();

        let mut freq = std::collections::HashMap::new();
        for word in words {
            if word.len() > 2 {
                *freq.entry(word).or_insert(0) += 1;
            }
        }

        let mut keywords: Vec<_> = freq.into_iter().collect();
        keywords.sort_by(|a, b| b.1.cmp(&a.1));

        let result: Vec<_> = keywords
            .into_iter()
            .take(top_n)
            .map(|(k, _)| k)
            .collect();

        serde_json::to_string(&result).unwrap_or_default()
    }
}
