use serde::{Deserialize, Serialize};
use std::f64;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Caption {
    pub start: f64,
    pub end: f64,
    pub text: String,
}

#[derive(Debug)]
pub enum VttParseError {
    InvalidFormat(String),
    InvalidTimestamp(String),
}

impl std::fmt::Display for VttParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            VttParseError::InvalidFormat(msg) => write!(f, "Invalid VTT format: {}", msg),
            VttParseError::InvalidTimestamp(msg) => write!(f, "Invalid timestamp: {}", msg),
        }
    }
}

impl std::error::Error for VttParseError {}

/// Parse WebVTT format
/// - Parse header (WEBVTT)
/// - Parse cue blocks with timestamps (00:00:00.000 --> 00:00:05.000)
/// - Handle multi-line text content
pub fn parse_vtt(input: &str) -> Result<Vec<Caption>, VttParseError> {
    let mut captions = Vec::new();
    let lines: Vec<&str> = input.lines().collect();

    if lines.is_empty() || !lines[0].starts_with("WEBVTT") {
        return Err(VttParseError::InvalidFormat(
            "Missing WEBVTT header".to_string(),
        ));
    }

    let mut i = 1;
    // Skip empty lines and header metadata
    while i < lines.len() && lines[i].trim().is_empty() {
        i += 1;
    }

    while i < lines.len() {
        let line = lines[i].trim();

        // Skip empty lines
        if line.is_empty() {
            i += 1;
            continue;
        }

        // Check if this is a cue identifier (optional) or timestamp
        if line.contains("-->") {
            // This is a timestamp line
            let (start, end) = parse_timestamp_line(line)?;

            // Collect text content
            i += 1;
            let mut text_lines = Vec::new();

            while i < lines.len() {
                let text_line = lines[i].trim();
                if text_line.is_empty() {
                    break;
                }
                // Skip VTT cue settings (like align, position, etc.)
                if !text_line.contains(':')
                    || text_line
                        .chars()
                        .next()
                        .map(|c| c.is_alphabetic())
                        .unwrap_or(false)
                {
                    text_lines.push(text_line);
                }
                i += 1;
            }

            let text = text_lines.join("\n").trim().to_string();
            if !text.is_empty() {
                captions.push(Caption { start, end, text });
            }
        } else {
            // This might be a cue identifier or metadata, skip to next line
            i += 1;
        }
    }

    Ok(captions)
}

/// Parse a WebVTT timestamp line
/// Format: HH:MM:SS.mmm --> HH:MM:SS.mmm [optional settings]
fn parse_timestamp_line(line: &str) -> Result<(f64, f64), VttParseError> {
    let parts: Vec<&str> = line.split("-->").collect();
    if parts.len() != 2 {
        return Err(VttParseError::InvalidTimestamp(
            "Missing timestamp separator".to_string(),
        ));
    }

    let start = parse_webvtt_timestamp(parts[0].trim())?;
    let end_part = parts[1].trim();
    // Remove any cue settings after the end timestamp
    let end_timestamp = end_part
        .split_whitespace()
        .next()
        .ok_or_else(|| VttParseError::InvalidTimestamp("Missing end timestamp".to_string()))?;
    let end = parse_webvtt_timestamp(end_timestamp)?;

    Ok((start, end))
}

/// Parse a WebVTT timestamp
/// Format: HH:MM:SS.mmm or MM:SS.mmm or SS.mmm
fn parse_webvtt_timestamp(input: &str) -> Result<f64, VttParseError> {
    let parts: Vec<&str> = input.split(':').collect();

    let seconds = match parts.len() {
        1 => {
            // SS.mmm or SSS.mmm
            parts[0]
                .parse::<f64>()
                .map_err(|_| VttParseError::InvalidTimestamp(input.to_string()))?
        }
        2 => {
            // MM:SS.mmm
            let minutes: f64 = parts[0]
                .parse()
                .map_err(|_| VttParseError::InvalidTimestamp(input.to_string()))?;
            let secs: f64 = parts[1]
                .parse()
                .map_err(|_| VttParseError::InvalidTimestamp(input.to_string()))?;
            minutes * 60.0 + secs
        }
        3 => {
            // HH:MM:SS.mmm
            let hours: f64 = parts[0]
                .parse()
                .map_err(|_| VttParseError::InvalidTimestamp(input.to_string()))?;
            let minutes: f64 = parts[1]
                .parse()
                .map_err(|_| VttParseError::InvalidTimestamp(input.to_string()))?;
            let secs: f64 = parts[2]
                .parse()
                .map_err(|_| VttParseError::InvalidTimestamp(input.to_string()))?;
            hours * 3600.0 + minutes * 60.0 + secs
        }
        _ => {
            return Err(VttParseError::InvalidTimestamp(input.to_string()));
        }
    };

    Ok(seconds)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_webvtt_timestamp() {
        assert_eq!(parse_webvtt_timestamp("0.000").unwrap(), 0.0);
        assert_eq!(parse_webvtt_timestamp("1.500").unwrap(), 1.5);
        assert_eq!(parse_webvtt_timestamp("01:30.500").unwrap(), 90.5);
        assert_eq!(parse_webvtt_timestamp("01:00:00.000").unwrap(), 3600.0);
        assert_eq!(parse_webvtt_timestamp("00:00:01.500").unwrap(), 1.5);
    }

    #[test]
    fn test_parse_vtt() {
        let input = r#"WEBVTT

00:00:00.000 --> 00:00:02.500
Hello world

00:00:02.500 --> 00:00:05.500
This is a test
With multiple lines
"#;

        let result = parse_vtt(input).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].text, "Hello world");
        assert_eq!(result[0].start, 0.0);
        assert_eq!(result[0].end, 2.5);
        assert_eq!(result[1].text, "This is a test\nWith multiple lines");
        assert_eq!(result[1].start, 2.5);
        assert_eq!(result[1].end, 5.5);
    }

    #[test]
    fn test_parse_vtt_with_cue_id() {
        let input = r#"WEBVTT

1
00:00:00.000 --> 00:00:02.500
Hello world

2
00:00:02.500 --> 00:00:05.500
This is a test
"#;

        let result = parse_vtt(input).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].text, "Hello world");
        assert_eq!(result[1].text, "This is a test");
    }
}
