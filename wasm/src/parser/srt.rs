use serde::{Deserialize, Serialize};
use std::f64;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Caption {
    pub start: f64,
    pub end: f64,
    pub text: String,
}

#[derive(Debug)]
pub enum SrtParseError {
    InvalidFormat(String),
    InvalidTimestamp(String),
    InvalidNumber(String),
}

impl std::fmt::Display for SrtParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SrtParseError::InvalidFormat(msg) => write!(f, "Invalid SRT format: {}", msg),
            SrtParseError::InvalidTimestamp(msg) => write!(f, "Invalid timestamp: {}", msg),
            SrtParseError::InvalidNumber(msg) => write!(f, "Invalid number: {}", msg),
        }
    }
}

impl std::error::Error for SrtParseError {}

/// Parse SRT (SubRip) format
/// - Parse sequence numbers
/// - Parse timestamps (00:00:00,000 --> 00:00:05,000)
/// - Handle multi-line text content
pub fn parse_srt(input: &str) -> Result<Vec<Caption>, SrtParseError> {
    let mut captions = Vec::new();
    let blocks = split_srt_blocks(input);

    for block in &blocks {
        if let Ok(caption) = parse_srt_block(block) {
            captions.push(caption);
        }
    }

    Ok(captions)
}

/// Split SRT input into blocks separated by blank lines
/// Handles both Unix (\n\n) and Windows (\r\n\r\n) line endings
fn split_srt_blocks(input: &str) -> Vec<String> {
    // Normalize line endings first
    let normalized = input.replace("\r\n", "\n");

    normalized
        .split("\n\n")
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.to_string())
        .collect()
}

/// Parse a single SRT block
/// Format:
/// sequence_number
/// HH:MM:SS,mmm --> HH:MM:SS,mmm
/// text_line_1
/// text_line_2
/// ...
fn parse_srt_block(block: &str) -> Result<Caption, SrtParseError> {
    let lines: Vec<&str> = block.lines().collect();

    if lines.len() < 3 {
        return Err(SrtParseError::InvalidFormat(
            "Block has too few lines".to_string(),
        ));
    }

    // First line is sequence number (we can validate but don't need it)
    let _seq: u32 = lines[0]
        .trim()
        .parse()
        .map_err(|_| SrtParseError::InvalidNumber(lines[0].to_string()))?;

    // Second line is timestamp
    let (start, end) = parse_srt_timestamp_line(lines[1].trim())?;

    // Remaining lines are text content
    let text: String = lines[2..]
        .iter()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
        .map(|s| s.to_string())
        .collect::<Vec<_>>()
        .join("\n");

    Ok(Caption { start, end, text })
}

/// Parse an SRT timestamp line
/// Format: HH:MM:SS,mmm --> HH:MM:SS,mmm
fn parse_srt_timestamp_line(line: &str) -> Result<(f64, f64), SrtParseError> {
    let parts: Vec<&str> = line.split("-->").collect();
    if parts.len() != 2 {
        return Err(SrtParseError::InvalidTimestamp(
            "Missing timestamp separator".to_string(),
        ));
    }

    let start = parse_srt_timestamp(parts[0].trim())?;
    let end = parse_srt_timestamp(parts[1].trim())?;

    Ok((start, end))
}

/// Parse an SRT timestamp
/// Format: HH:MM:SS,mmm
fn parse_srt_timestamp(input: &str) -> Result<f64, SrtParseError> {
    // Replace comma with dot for decimal parsing
    let normalized = input.replace(',', ".");

    let parts: Vec<&str> = normalized.split(':').collect();

    let seconds = match parts.len() {
        1 => {
            // SS.mmm or SSS.mmm
            parts[0]
                .parse::<f64>()
                .map_err(|_| SrtParseError::InvalidTimestamp(input.to_string()))?
        }
        2 => {
            // MM:SS.mmm
            let minutes: f64 = parts[0]
                .parse()
                .map_err(|_| SrtParseError::InvalidTimestamp(input.to_string()))?;
            let secs: f64 = parts[1]
                .parse()
                .map_err(|_| SrtParseError::InvalidTimestamp(input.to_string()))?;
            minutes * 60.0 + secs
        }
        3 => {
            // HH:MM:SS.mmm
            let hours: f64 = parts[0]
                .parse()
                .map_err(|_| SrtParseError::InvalidTimestamp(input.to_string()))?;
            let minutes: f64 = parts[1]
                .parse()
                .map_err(|_| SrtParseError::InvalidTimestamp(input.to_string()))?;
            let secs: f64 = parts[2]
                .parse()
                .map_err(|_| SrtParseError::InvalidTimestamp(input.to_string()))?;
            hours * 3600.0 + minutes * 60.0 + secs
        }
        _ => {
            return Err(SrtParseError::InvalidTimestamp(input.to_string()));
        }
    };

    Ok(seconds)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_srt_timestamp() {
        assert_eq!(parse_srt_timestamp("00:00:00,000").unwrap(), 0.0);
        assert_eq!(parse_srt_timestamp("00:00:01,500").unwrap(), 1.5);
        assert_eq!(parse_srt_timestamp("00:01:30,500").unwrap(), 90.5);
        assert_eq!(parse_srt_timestamp("01:00:00,000").unwrap(), 3600.0);
    }

    #[test]
    fn test_parse_srt() {
        let input = r#"1
00:00:00,000 --> 00:00:02,500
Hello world

2
00:00:02,500 --> 00:00:05,500
This is a test
With multiple lines
"#;

        let result = parse_srt(input).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].text, "Hello world");
        assert_eq!(result[0].start, 0.0);
        assert_eq!(result[0].end, 2.5);
        assert_eq!(result[1].text, "This is a test\nWith multiple lines");
        assert_eq!(result[1].start, 2.5);
        assert_eq!(result[1].end, 5.5);
    }

    #[test]
    fn test_parse_srt_windows_line_endings() {
        let input = "1\r\n00:00:00,000 --> 00:00:02,500\r\nHello world\r\n\r\n2\r\n00:00:02,500 --> 00:00:05,500\r\nThis is a test\r\n";

        let result = parse_srt(input).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].text, "Hello world");
        assert_eq!(result[1].text, "This is a test");
    }
}
