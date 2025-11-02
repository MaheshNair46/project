export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  filePath: string;
  fileName: string;
  fileFormat: string;
  fileSize: number;
  albumArt?: string;
  trackNumber?: number;
  year?: number;
  genre?: string;
  addedDate: Date;
  lastPlayed?: Date;
  playCount: number;
  isFavorite: boolean;
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  songs: string[];
  createdDate: Date;
  modifiedDate: Date;
  isDefault: boolean;
}

export interface AppState {
  library: {
    songs: Song[];
    playlists: Playlist[];
    currentPath: string;
    isScanning: boolean;
    scanProgress: number;
  };
  player: {
    currentSong: Song | null;
    isPlaying: boolean;
    currentTime: number;
    volume: number;
    isMuted: boolean;
    shuffle: boolean;
    repeat: 'none' | 'one' | 'all';
  };
  queue: {
    songs: Song[];
    currentIndex: number;
  };
  ui: {
    currentView: 'library' | 'artists' | 'albums' | 'playlists' | 'search';
    selectedPlaylist: string | null;
    searchTerm: string;
    isMiniPlayer: boolean;
    sidebarCollapsed: boolean;
  };
}

export interface ElectronAPI {
  selectMusicFolder: () => Promise<string | null>;
  scanDirectory: (dirPath: string) => Promise<string[]>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}