use quick_xml::events::Event;
use quick_xml::Reader;
use serde::{Deserialize, Serialize};
use std::f64;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Caption {
    pub start: f64,
    pub end: f64,
    pub text: String,
}

#[derive(Debug)]
pub enum TtmlParseError {
    InvalidXml(String),
    InvalidTimeFormat(String),
}

impl std::fmt::Display for TtmlParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TtmlParseError::InvalidXml(msg) => write!(f, "Invalid XML: {}", msg),
            TtmlParseError::InvalidTimeFormat(msg) => write!(f, "Invalid time format: {}", msg),
        }
    }
}

impl std::error::Error for TtmlParseError {}

/// Parse YouTube TTML format
/// YouTube TTML has `<transcript>` with `<text>` elements
/// Each `<text>` has `start`, `dur` attributes and text content
pub fn parse_ttml(input: &str) -> Result<Vec<Caption>, TtmlParseError> {
    let mut reader = Reader::from_str(input);
    reader.config_mut().trim_text(true);

    let mut captions = Vec::new();
    let mut current_text = String::new();
    let mut current_start: Option<f64> = None;
    let mut current_dur: Option<f64> = None;
    let mut in_text_element = false;

    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(ref e)) => {
                match e.name().as_ref() {
                    b"text" => {
                        in_text_element = true;
                        current_text = String::new();
                        current_start = None;
                        current_dur = None;

                        // Parse start and dur attributes
                        for attr in e.attributes() {
                            if let Ok(attr) = attr {
                                let key = attr.key.as_ref();
                                let value = attr.value.as_ref();

                                if key == b"start" {
                                    if let Ok(s) = std::str::from_utf8(value) {
                                        current_start = Some(parse_time_attribute(s)?);
                                    }
                                } else if key == b"dur" {
                                    if let Ok(s) = std::str::from_utf8(value) {
                                        current_dur = Some(parse_time_attribute(s)?);
                                    }
                                }
                            }
                        }
                    }
                    _ => {}
                }
            }
            Ok(Event::Text(e)) => {
                if in_text_element {
                    if let Ok(text) = e.unescape() {
                        current_text.push_str(&text);
                    }
                }
            }
            Ok(Event::End(ref e)) => {
                if e.name().as_ref() == b"text" && in_text_element {
                    in_text_element = false;

                    if let (Some(start), Some(dur)) = (current_start, current_dur) {
                        let text = current_text.trim().to_string();
                        if !text.is_empty() {
                            captions.push(Caption {
                                start,
                                end: start + dur,
                                text,
                            });
                        }
                    }
                }
            }
            Ok(Event::Eof) => break,
            Err(e) => return Err(TtmlParseError::InvalidXml(e.to_string())),
            _ => {}
        }
        buf.clear();
    }

    Ok(captions)
}

/// Parse time attribute from YouTube TTML
/// Formats: "123" (seconds), "123.456" (seconds with milliseconds)
fn parse_time_attribute(input: &str) -> Result<f64, TtmlParseError> {
    input
        .parse::<f64>()
        .map_err(|_| TtmlParseError::InvalidTimeFormat(input.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_youtube_ttml() {
        let input = r#"<transcript>
            <text start="0.0" dur="2.5">Hello world</text>
            <text start="2.5" dur="3.0">This is a test</text>
        </transcript>"#;

        let result = parse_ttml(input).unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].text, "Hello world");
        assert_eq!(result[0].start, 0.0);
        assert_eq!(result[0].end, 2.5);
        assert_eq!(result[1].text, "This is a test");
        assert_eq!(result[1].start, 2.5);
        assert_eq!(result[1].end, 5.5);
    }

    #[test]
    fn test_parse_time_attribute() {
        assert_eq!(parse_time_attribute("0").unwrap(), 0.0);
        assert_eq!(parse_time_attribute("1.5").unwrap(), 1.5);
        assert_eq!(parse_time_attribute("123.456").unwrap(), 123.456);
    }
}
