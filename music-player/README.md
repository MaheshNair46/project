# Music Player

A desktop music player built with Electron, React, and TypeScript that allows you to browse, play, and manage music files stored on your local computer.

## Features

### ✅ Implemented (MVP)
- **Local File System Browsing**: Select music folders and scan for audio files
- **Audio Playback**: Play, pause, stop functionality with HTML5 Audio
- **File Format Support**: MP3, FLAC, WAV, M4A, OGG
- **Two-panel Layout**: Sidebar navigation + main content area
- **Song Library**: Display all songs with metadata (title, artist, album, duration)
- **Player Controls**: Play/pause, volume control, mute functionality
- **Real-time Updates**: Current time display and playback status
- **Dark Theme**: Modern dark interface with green accent colors

### 🚧 Planned Features
- Metadata extraction (ID3 tags)
- Album artwork display
- Search functionality
- Playlist management
- Queue management
- Keyboard shortcuts
- Mini-player mode
- Equalizer
- Crossfade between tracks

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the application:
```bash
npm run build
```

## Development

Start the development server:
```bash
npm run dev
```

This will start both the Vite development server and Electron in watch mode.

## Building

Build for production:
```bash
npm run build
```

Build and package for distribution:
```bash
npm run build:all
```

## Usage

1. **Select Music Folder**: Click "Select Music Folder" in the sidebar to choose a directory containing audio files
2. **Browse Library**: The app will scan the directory and display all found audio files
3. **Play Music**: Click on any song in the list to start playback
4. **Control Playback**: Use the player controls at the bottom to play/pause, adjust volume, or mute

## File Structure

```
music-player/
├── src/
│   ├── main/           # Electron main process
│   │   └── main.ts     # Main application entry point
│   ├── preload/        # Preload script
│   │   └── preload.ts  # Bridge between main and renderer
│   ├── renderer/       # React frontend
│   │   ├── components/ # React components
│   │   ├── services/   # Audio and other services
│   │   ├── App.tsx     # Main React component
│   │   └── main.tsx    # React entry point
│   └── shared/         # Shared types and utilities
│       └── types.ts    # TypeScript interfaces
├── public/             # Static assets
├── dist/               # Built application
└── package.json        # Dependencies and scripts
```

## Technology Stack

- **Frontend**: React 18 with TypeScript
- **Desktop Framework**: Electron
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Audio Engine**: HTML5 Audio API
- **State Management**: React hooks and state

## Requirements

- Node.js 18+
- npm or yarn
- For playback: Local audio files in supported formats

## License

MIT