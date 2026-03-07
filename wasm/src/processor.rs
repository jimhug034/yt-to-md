use crate::parser::ttml::Caption;
use serde::{Deserialize, Serialize};
use std::f64;

/// 处理选项
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessorOptions {
    /// 是否包含时间戳链接
    pub include_timestamps: bool,
    /// 是否使用紧凑模式（合并片段）
    pub compact_mode: bool,
    /// 每个段落的句子数量
    pub sentences_per_paragraph: usize,
    /// 视频URL（用于生成时间戳链接）
    pub video_url: String,
}

impl Default for ProcessorOptions {
    fn default() -> Self {
        Self {
            include_timestamps: false,
            compact_mode: true,
            sentences_per_paragraph: 4,
            video_url: String::new(),
        }
    }
}

/// 处理结果统计
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessorStats {
    pub total_entries: usize,
    pub merged_sentences: usize,
    pub final_paragraphs: usize,
    pub total_duration_ms: f64,
}

/// 处理字幕条目，生成格式化的 Markdown
pub fn process_subtitles(captions: &[Caption], options: &ProcessorOptions) -> String {
    if captions.is_empty() {
        return String::new();
    }

    if options.compact_mode {
        // 紧凑模式：合并片段成段落
        let sentences = merge_segments(captions);
        let paragraphs = group_paragraphs(&sentences, options.sentences_per_paragraph);
        format_paragraphs(&paragraphs, captions, options)
    } else {
        // 原始模式：每个片段一行
        format_original(captions, options)
    }
}

/// 原始格式输出（每个片段一行）
fn format_original(captions: &[Caption], options: &ProcessorOptions) -> String {
    let mut output = String::with_capacity(captions.len() * 100);

    for caption in captions {
        let text = clean_text(&caption.text);
        if text.is_empty() {
            continue;
        }

        if options.include_timestamps && !options.video_url.is_empty() {
            let timestamp = format_timestamp_link(caption.start, &options.video_url);
            output.push_str(&timestamp);
            output.push(' ');
        }
        output.push_str(&text);
        output.push_str("\n\n");
    }

    output
}

/// 格式化段落输出
fn format_paragraphs(paragraphs: &[String], captions: &[Caption], options: &ProcessorOptions) -> String {
    let mut output = String::with_capacity(paragraphs.len() * 200);
    let mut caption_index = 0;

    for paragraph in paragraphs {
        if paragraph.is_empty() {
            continue;
        }

        // 添加时间戳（如果启用）
        if options.include_timestamps && !options.video_url.is_empty() {
            // 找到当前段落对应的第一条字幕
            while caption_index < captions.len()
                && !paragraph.contains(&captions[caption_index].text[..captions[caption_index].text.len().min(20)])
            {
                caption_index += 1;
            }

            if caption_index < captions.len() {
                let timestamp = format_timestamp_link(captions[caption_index].start, &options.video_url);
                output.push_str(&timestamp);
                output.push(' ');
                caption_index += 1;
            }
        }

        output.push_str(paragraph);
        output.push_str("\n\n");
    }

    output
}

/// 格式化时间戳为 Markdown 链接
fn format_timestamp_link(seconds: f64, video_url: &str) -> String {
    let mins = (seconds / 60.0) as u32;
    let secs = (seconds % 60.0) as u32;
    let timestamp = format!("{:02}:{:02}", mins, secs);
    let time_param = seconds as u32;
    format!("[{}]({}&t={})", timestamp, video_url, time_param)
}

/// 合并连续的字幕片段成句子
fn merge_segments(captions: &[Caption]) -> Vec<String> {
    if captions.is_empty() {
        return Vec::new();
    }

    let mut sentences = Vec::with_capacity(captions.len() / 3); // 预分配空间
    let mut current_sentence = String::with_capacity(200);

    for (i, caption) in captions.iter().enumerate() {
        let text = caption.text.trim();
        if text.is_empty() {
            continue;
        }

        // 添加当前文本
        if !current_sentence.is_empty() {
            // 检查是否需要空格
            let last_char = current_sentence.chars().last().unwrap_or(' ');
            let first_char = text.chars().next().unwrap_or(' ');

            // 英文单词之间需要空格
            let needs_space = last_char.is_alphanumeric()
                && first_char.is_alphanumeric()
                && (last_char.is_ascii() || first_char.is_ascii());

            if needs_space {
                current_sentence.push(' ');
            }
            current_sentence.push_str(text);
        } else {
            current_sentence.push_str(text);
        }

        // 检测句子结束
        let trimmed = text.trim();
        if is_sentence_end(trimmed.chars().last()) {
            sentences.push(clean_text(&current_sentence));
            current_sentence = String::with_capacity(200);
        } else if i + 1 < captions.len() {
            // 检查时间间隔（超过2秒可能是新句子）
            let next = &captions[i + 1];
            let gap = next.start - caption.end;
            if gap > 2000.0 && !current_sentence.is_empty() {
                sentences.push(clean_text(&current_sentence));
                current_sentence = String::with_capacity(200);
            }
        }
    }

    // 处理最后一个未完成的句子
    if !current_sentence.is_empty() {
        sentences.push(clean_text(&current_sentence));
    }

    // 去除重复句子
    remove_duplicates(&mut sentences);

    sentences.retain(|s| !s.is_empty());
    sentences
}

/// 将句子组合成段落
fn group_paragraphs(sentences: &[String], sentences_per_paragraph: usize) -> Vec<String> {
    if sentences.is_empty() {
        return Vec::new();
    }

    let mut paragraphs = Vec::with_capacity(sentences.len() / sentences_per_paragraph);
    let mut current_paragraph = Vec::with_capacity(sentences_per_paragraph);

    for (i, sentence) in sentences.iter().enumerate() {
        current_paragraph.push(sentence.clone());

        // 检查是否应该结束当前段落
        let should_end = current_paragraph.len() >= sentences_per_paragraph
            || is_paragraph_end(sentence.chars().last())
            || (i + 1 < sentences.len()
                && current_paragraph.len() >= 2
                && sentences[i + 1].chars().next().map_or(false, |c| c.is_uppercase()));

        if should_end && current_paragraph.len() >= 2 {
            paragraphs.push(current_paragraph.join(" "));
            current_paragraph = Vec::with_capacity(sentences_per_paragraph);
        }
    }

    // 处理剩余的句子
    if !current_paragraph.is_empty() {
        paragraphs.push(current_paragraph.join(" "));
    }

    paragraphs
}

/// 去除重复句子
fn remove_duplicates(sentences: &mut Vec<String>) {
    if sentences.len() <= 1 {
        return;
    }

    let mut unique = Vec::with_capacity(sentences.len());
    let mut seen: Vec<String> = Vec::new();

    for sentence in sentences.iter() {
        let normalized = sentence.to_lowercase();
        let is_duplicate = seen.iter()
            .any(|s: &String| calculate_similarity(s, &normalized) > 0.8);

        if !is_duplicate {
            unique.push(sentence.clone());
            seen.push(normalized);
        }
    }

    *sentences = unique;
}

/// 计算两个字符串的相似度（使用 Jaccard 相似度）
fn calculate_similarity(a: &str, b: &str) -> f64 {
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
        intersection as f64 / union as f64
    }
}

/// 检测字符是否是句子结束符
fn is_sentence_end(c: Option<char>) -> bool {
    match c {
        Some('。') | Some('！') | Some('？') | Some('.') | Some('!') | Some('?') => true,
        _ => false,
    }
}

/// 检测字符是否是段落结束符（更强的结束信号）
fn is_paragraph_end(c: Option<char>) -> bool {
    match c {
        Some('。') | Some('！') | Some('？') => true,
        _ => false,
    }
}

/// 清理文本中的口语化表达
fn clean_text(text: &str) -> String {
    // 中文口语词
    let chinese_fillers = [
        ("嗯", ""), ("啊", ""), ("噢", ""), ("呃", ""), ("额", ""),
        ("那个", ""), ("这个", ""), ("然后呢", ""), ("就是", ""),
        ("那就是", ""), ("对不对", ""), ("是不是", ""), ("好吧", ""),
    ];

    let mut result = text.to_string();

    // 移除中文口语词
    for (filler, _) in &chinese_fillers {
        result = result.replace(filler, " ");
    }

    // 移除连续的空格
    while result.contains("  ") {
        result = result.replace("  ", " ");
    }

    // 移除开头的空格和标点
    result = result.trim()
        .trim_start_matches(|c: char| c.is_whitespace() || "，,。.!！?？".contains(c))
        .to_string();

    // 移除重复的标点
    let mut chars = result.chars().collect::<Vec<_>>();
    let mut i = 1;
    while i < chars.len() {
        if chars[i] == chars[i - 1] && "。！？.!?".contains(chars[i]) {
            chars.remove(i);
        } else {
            i += 1;
        }
    }

    chars.into_iter().collect()
}

/// 获取处理统计信息
pub fn get_stats(captions: &[Caption], processed_output: &str) -> ProcessorStats {
    let total_entries = captions.len();
    let total_duration_ms = if !captions.is_empty() {
        captions.last().unwrap().end - captions.first().unwrap().start
    } else {
        0.0
    };

    let merged_sentences = processed_output.split('\n')
        .filter(|l| !l.trim().is_empty())
        .count();

    let final_paragraphs = if captions.len() > 0 {
        merged_sentences / 4
    } else {
        0
    };

    ProcessorStats {
        total_entries,
        merged_sentences,
        final_paragraphs,
        total_duration_ms,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_clean_text() {
        assert_eq!(clean_text("嗯大家好"), "大家好");
        assert_eq!(clean_text("那个今天我们来讨论"), "今天我们来讨论");
        assert_eq!(clean_text("  Hello world  "), "Hello world");
    }

    #[test]
    fn test_merge_segments() {
        let captions = vec![
            Caption { start: 0.0, end: 2.5, text: "大家好".to_string() },
            Caption { start: 2.5, end: 5.5, text: "今天我们来讨论".to_string() },
            Caption { start: 5.5, end: 7.5, text: "一个有趣的话题".to_string() },
            Caption { start: 7.5, end: 11.5, text: "关于人工智能的发展。".to_string() },
        ];

        let result = merge_segments(&captions);
        assert!(!result.is_empty());
        assert!(result[0].contains("大家好"));
        assert!(result[0].contains("人工智能"));
    }

    #[test]
    fn test_group_paragraphs() {
        let sentences = vec![
            "第一句话。".to_string(),
            "第二句话。".to_string(),
            "第三句话。".to_string(),
            "第四句话。".to_string(),
            "第五句话。".to_string(),
        ];

        let result = group_paragraphs(&sentences, 3);
        assert_eq!(result.len(), 2);
    }

    #[test]
    fn test_calculate_similarity() {
        assert!(calculate_similarity("hello", "hello") > 0.9);
        assert!(calculate_similarity("hello world", "hello world") > 0.9);
        assert!(calculate_similarity("hello", "hi") < 0.5);
    }

    #[test]
    fn test_process_subtitles_compact() {
        let captions = vec![
            Caption { start: 0.0, end: 2.5, text: "Hello".to_string() },
            Caption { start: 2.5, end: 5.5, text: "world".to_string() },
            Caption { start: 5.5, end: 8.5, text: "This is a test".to_string() },
        ];

        let options = ProcessorOptions {
            compact_mode: true,
            include_timestamps: false,
            ..Default::default()
        };

        let result = process_subtitles(&captions, &options);
        assert!(!result.is_empty());
        assert!(result.contains("Hello"));
        assert!(result.contains("world"));
    }

    #[test]
    fn test_process_subtitles_original() {
        let captions = vec![
            Caption { start: 0.0, end: 2.5, text: "Hello".to_string() },
            Caption { start: 2.5, end: 5.5, text: "world".to_string() },
        ];

        let options = ProcessorOptions {
            compact_mode: false,
            include_timestamps: true,
            video_url: "https://youtube.com/watch?v=test".to_string(),
            ..Default::default()
        };

        let result = process_subtitles(&captions, &options);
        assert!(!result.is_empty());
        assert!(result.contains("[00:00]"));
    }
}
