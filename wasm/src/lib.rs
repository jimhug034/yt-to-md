use wasm_bindgen::prelude::*;
use serde_json::{json, Value};

mod parser;
mod processor;

use parser::{
    ttml as ttml_parser,
    vtt as vtt_parser,
    srt as srt_parser,
    markdown as markdown_parser,
    Caption,
};

use processor::{
    ProcessorOptions,
    process_subtitles as process_subtitles_internal,
    get_stats,
};

/// Parse YouTube TTML format and return JSON
/// Each caption has start (seconds), end (seconds), and text fields
#[wasm_bindgen]
pub fn parse_ttml(input: &str) -> String {
    let result = ttml_parser::parse_ttml(input);

    match result {
        Ok(captions) => {
            serde_json::to_string(&captions).unwrap_or_else(|_| json!([]).to_string())
        }
        Err(_) => {
            // Return empty array on error
            json!([]).to_string()
        }
    }
}

/// Parse WebVTT format and return JSON
/// Each caption has start (seconds), end (seconds), and text fields
#[wasm_bindgen]
pub fn parse_vtt(input: &str) -> String {
    let result = vtt_parser::parse_vtt(input);

    match result {
        Ok(captions) => {
            serde_json::to_string(&captions).unwrap_or_else(|_| json!([]).to_string())
        }
        Err(_) => {
            // Return empty array on error
            json!([]).to_string()
        }
    }
}

/// Parse SRT format and return JSON
/// Each caption has start (seconds), end (seconds), and text fields
#[wasm_bindgen]
pub fn parse_srt(input: &str) -> String {
    let result = srt_parser::parse_srt(input);

    match result {
        Ok(captions) => {
            serde_json::to_string(&captions).unwrap_or_else(|_| json!([]).to_string())
        }
        Err(_) => {
            // Return empty array on error
            json!([]).to_string()
        }
    }
}

/// Convert captions JSON to Markdown format
/// Input should be a JSON array of captions with start, end, and text fields
/// Options (as JSON string):
/// {
///   "title": "Video Title",
///   "url": "https://youtube.com/watch?v=...",
///   "duration": "10:05"
/// }
#[wasm_bindgen]
pub fn to_markdown(captions_json: &str, options_json: &str) -> String {
    // Parse captions
    let captions: Vec<Caption> = match serde_json::from_str(captions_json) {
        Ok(c) => c,
        Err(_) => return String::new(),
    };

    // Parse options
    let options: Value = match serde_json::from_str(options_json) {
        Ok(v) => v,
        Err(_) => {
            // Use default options if JSON is invalid
            return markdown_parser::to_markdown(&captions, &markdown_parser::MarkdownOptions::default());
        }
    };

    let markdown_options = markdown_parser::MarkdownOptions {
        title: options["title"].as_str().unwrap_or("").to_string(),
        url: options["url"].as_str().unwrap_or("").to_string(),
        duration: options["duration"].as_str().unwrap_or("").to_string(),
    };

    markdown_parser::to_markdown(&captions, &markdown_options)
}

/// High-performance subtitle processing in Rust
/// Input: captions JSON array + options JSON
/// Output: processed Markdown text
///
/// Options JSON format:
/// {
///   "include_timestamps": bool,
///   "compact_mode": bool,
///   "sentences_per_paragraph": number,
///   "video_url": string
/// }
#[wasm_bindgen]
pub fn process_subtitles(captions_json: &str, options_json: &str) -> String {
    // Parse captions
    let captions: Vec<Caption> = match serde_json::from_str(captions_json) {
        Ok(c) => c,
        Err(_) => return String::new(),
    };

    // Parse options
    let options_value: Value = match serde_json::from_str(options_json) {
        Ok(v) => v,
        Err(_) => {
            // Use default options
            let default_options = ProcessorOptions::default();
            return process_subtitles_internal(&captions, &default_options);
        }
    };

    let options = ProcessorOptions {
        include_timestamps: options_value["include_timestamps"].as_bool().unwrap_or_default(),
        compact_mode: options_value["compact_mode"].as_bool().unwrap_or(true),
        sentences_per_paragraph: options_value["sentences_per_paragraph"].as_u64().unwrap_or(4) as usize,
        video_url: options_value["video_url"].as_str().unwrap_or("").to_string(),
    };

    process_subtitles_internal(&captions, &options)
}

/// Get processing statistics
/// Input: captions JSON array + processed output
/// Output: stats JSON string
#[wasm_bindgen]
pub fn get_processing_stats(captions_json: &str, processed_output: &str) -> String {
    let captions: Vec<Caption> = match serde_json::from_str(captions_json) {
        Ok(c) => c,
        Err(_) => return json!({}).to_string(),
    };

    let stats = get_stats(&captions, processed_output);
    serde_json::to_string(&stats).unwrap_or_default()
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ttml() {
        let input = r#"<transcript>
            <text start="0.0" dur="2.5">Hello world</text>
            <text start="2.5" dur="3.0">This is a test</text>
        </transcript>"#;

        let result = parse_ttml(input);
        let captions: Vec<Caption> = serde_json::from_str(&result).unwrap();

        assert_eq!(captions.len(), 2);
        assert_eq!(captions[0].text, "Hello world");
        assert_eq!(captions[0].start, 0.0);
        assert_eq!(captions[0].end, 2.5);
    }

    #[test]
    fn test_parse_vtt() {
        let input = r#"WEBVTT

00:00:00.000 --> 00:00:02.500
Hello world

00:00:02.500 --> 00:00:05.500
This is a test
"#;

        let result = parse_vtt(input);
        let captions: Vec<Caption> = serde_json::from_str(&result).unwrap();

        assert_eq!(captions.len(), 2);
        assert_eq!(captions[0].text, "Hello world");
        assert_eq!(captions[1].text, "This is a test");
    }

    #[test]
    fn test_parse_srt() {
        let input = r#"1
00:00:00,000 --> 00:00:02,500
Hello world

2
00:00:02,500 --> 00:00:05,500
This is a test
"#;

        let result = parse_srt(input);
        let captions: Vec<Caption> = serde_json::from_str(&result).unwrap();

        assert_eq!(captions.len(), 2);
        assert_eq!(captions[0].text, "Hello world");
        assert_eq!(captions[1].text, "This is a test");
    }

    #[test]
    fn test_to_markdown() {
        let captions_json = r#"[
            {"start": 0.0, "end": 2.5, "text": "Hello world"},
            {"start": 90.5, "end": 95.0, "text": "This is a test"}
        ]"#;

        let options_json = r#"{
            "title": "Test Video",
            "url": "https://example.com/video",
            "duration": "10:05"
        }"#;

        let result = to_markdown(captions_json, options_json);

        assert!(result.contains("# Test Video"));
        assert!(result.contains("[00:00:00] Hello world"));
        assert!(result.contains("[00:01:30] This is a test"));
        assert!(result.contains("**Duration:** 10:05"));
        assert!(result.contains("**URL:** https://example.com/video"));
        assert!(result.contains("Generated from [Test Video](https://example.com/video)"));
    }

    #[test]
    fn test_to_markdown_no_options() {
        let captions_json = r#"[
            {"start": 0.0, "end": 2.5, "text": "Hello world"}
        ]"#;

        let options_json = "{}";

        let result = to_markdown(captions_json, options_json);

        assert!(result.contains("[00:00:00] Hello world"));
        assert!(result.contains("Generated by YouTube Subtitle Extractor"));
    }
}
