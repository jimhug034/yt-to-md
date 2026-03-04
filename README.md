# YouTube Subtitle to Markdown

A Next.js web application that converts YouTube video subtitles to formatted Markdown documents with clickable timestamps and video metadata.

## Features

- **YouTube URL Parsing**: Supports various YouTube URL formats (youtube.com, youtu.be, embed URLs, and direct video IDs)
- **Multi-language Support**: Choose from available subtitle languages including auto-generated captions
- **WASM-Powered Parsing**: Rust-based WebAssembly module for fast subtitle parsing (TTML, WebVTT, SRT)
- **Markdown Output**: Clean, formatted Markdown with:
  - Video title as heading
  - Metadata block (duration, language)
  - Clickable timestamp links that jump to the exact moment in the video
  - Transcript text
- **Live Preview**: Preview the generated Markdown with copy and download options
- **Dark Mode Support**: Automatically adapts to system color scheme preferences
- **CORS Proxy Support**: Uses multiple CORS proxies to fetch subtitles from YouTube
- **Fast & Lightweight**: Built with Next.js 16, React 19, Tailwind CSS 4, and Rust/WASM

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd yt-subtitle-md
```

2. Install Rust toolchain (for WASM builds):
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
cargo install wasm-pack
```

3. Install dependencies:
```bash
npm install
# or
pnpm install
# or
yarn install
```

4. Build WASM module:
```bash
npm run build:wasm
# or
node build-wasm.js
```

3. Run the development server:
```bash
npm run dev
# or
pnpm dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

1. Paste a YouTube video URL or video ID into the input field
2. Click "Convert" to fetch video information and available subtitle languages
3. Select your preferred subtitle language
4. View and preview the generated Markdown
5. Copy to clipboard or download as a `.md` file

### Supported URL Formats

- Full URL: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- Short URL: `https://youtu.be/dQw4w9WgXcQ`
- Embed URL: `https://www.youtube.com/embed/dQw4w9WgXcQ`
- Video ID: `dQw4w9WgXcQ`

## Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) - React framework with App Router
- **React**: [React 19](https://react.dev/) - UI library
- **Styling**: [Tailwind CSS 4](https://tailwindcss.com/) - Utility-first CSS framework
- **Icons**: [Lucide React](https://lucide.dev/) - Beautiful icon library
- **Markdown**: [React Markdown](https://github.com/remarkjs/react-markdown) - Markdown renderer
- **WASM**: [Rust](https://www.rust-lang.org/) + [wasm-bindgen](https://github.com/rustwasm/wasm-bindgen) - Fast subtitle parsing
- **Utilities**: [clsx](https://github.com/lukeed/clsx) & [tailwind-merge](https://github.com/dcastil/tailwind-merge) - Class name utilities

## Development Notes

### Project Structure

```
yt-subtitle-md/
├── app/
│   ├── components/       # React components
│   │   ├── UrlInput.tsx           # URL input form
│   │   ├── LanguageSelector.tsx   # Language selection dropdown
│   │   ├── MarkdownPreview.tsx    # Preview and download component
│   │   ├── WASMLoader.tsx         # WASM module loader
│   │   └── index.ts               # Component exports
│   ├── lib/             # Utility libraries
│   │   ├── youtube.ts             # YouTube API integration
│   │   ├── wasm.ts                # WASM module interface
│   │   ├── wasm_loader.js         # WASM loader (auto-generated)
│   │   ├── utils.ts               # General utilities
│   │   └── index.ts               # Library exports
│   ├── globals.css      # Global styles
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Main page component
├── wasm/                # Rust WASM module
│   ├── src/
│   │   ├── lib.rs               # WASM entry point
│   │   └── parser/
│   │       ├── mod.rs           # Parser module
│   │       ├── ttml.rs          # TTML parser
│   │       ├── vtt.rs           # WebVTT parser
│   │       ├── srt.rs           # SRT parser
│   │       └── markdown.rs      # Markdown converter
│   ├── Cargo.toml       # Rust dependencies
│   └── pkg/             # wasm-pack output (gitignored)
├── public/              # Static assets
│   └── yt_subtitle_wasm_bg.wasm  # WASM binary (auto-generated)
├── build-wasm.js        # WASM build script
├── package.json
├── tsconfig.json
├── tailwind.config.ts
└── next.config.ts
```

### How It Works

1. **Video Info Fetching**: Uses the noembed.com API to fetch video metadata (title, thumbnail)
2. **Subtitle Language Discovery**: Queries YouTube's timedtext API with type=list to get available languages
3. **Subtitle Fetching**: Fetches subtitle content using CORS proxies
4. **WASM Parsing**: Rust-based WASM module parses TTML/WebVTT/SRT formats
5. **Markdown Generation**: Formats the data into Markdown with clickable timestamp links

### CORS Proxies

The app uses multiple CORS proxies to work around YouTube's CORS policy:
- Primary: `corsproxy.io`
- Fallback: `api.allorigins.win`

### Browser Compatibility

- Modern browsers with ES2018+ support
- WebAssembly support (for future WASM optimization)

## Build for Production

```bash
npm run build
npm start
```

## Environment Variables

No environment variables are required for this project. The app uses public APIs and CORS proxies.

## Known Limitations

- YouTube duration is not available via the noembed.com API (shows as 0)
- Some videos may not have subtitles available
- Auto-generated captions may have formatting issues
- CORS proxies may be rate-limited or unavailable

## Future Enhancements

- Batch processing for multiple videos
- Export to other formats (PDF, DOCX)
- Custom timestamp formatting options
- Direct YouTube API integration with OAuth

## License

This project is open source and available under the MIT License.
