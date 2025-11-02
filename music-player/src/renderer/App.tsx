import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MainContent from './components/MainContent';
import PlayerBar from './components/PlayerBar';
import { Song, AppState } from '../shared/types';
import audioService from './services/audioService';

const initialState: AppState = {
  library: {
    songs: [],
    playlists: [],
    currentPath: '',
    isScanning: false,
    scanProgress: 0,
  },
  player: {
    currentSong: null,
    isPlaying: false,
    currentTime: 0,
    volume: 0.7,
    isMuted: false,
    shuffle: false,
    repeat: 'none',
  },
  queue: {
    songs: [],
    currentIndex: -1,
  },
  ui: {
    currentView: 'library',
    selectedPlaylist: null,
    searchTerm: '',
    isMiniPlayer: false,
    sidebarCollapsed: false,
  },
};

function App() {
  const [state, setState] = useState<AppState>(initialState);

  const updateState = (updates: Partial<AppState>) => {
    setState(prev => ({
      ...prev,
      ...updates,
      library: updates.library ? { ...prev.library, ...updates.library } : prev.library,
      player: updates.player ? { ...prev.player, ...updates.player } : prev.player,
      queue: updates.queue ? { ...prev.queue, ...updates.queue } : prev.queue,
      ui: updates.ui ? { ...prev.ui, ...updates.ui } : prev.ui,
    }));
  };

  // Audio service integration
  useEffect(() => {
    // Sync audio service state with app state
    const handleTimeUpdate = (time: number) => {
      updateState({ player: { currentTime: time } });
    };

    const handleEnded = () => {
      updateState({ player: { isPlaying: false } });
    };

    audioService.addTimeUpdateListener(handleTimeUpdate);
    audioService.addEndedListener(handleEnded);

    return () => {
      audioService.removeTimeUpdateListener(handleTimeUpdate);
      audioService.removeEndedListener(handleEnded);
    };
  }, []);

  const playSong = async (song: Song) => {
    try {
      await audioService.loadSong(song);
      await audioService.play();
      updateState({
        player: {
          currentSong: song,
          isPlaying: true,
          currentTime: 0,
        }
      });
    } catch (error) {
      console.error('Error playing song:', error);
      updateState({
        player: { isPlaying: false }
      });
    }
  };

  const togglePlayPause = async () => {
    try {
      if (audioService.getIsPlaying()) {
        audioService.pause();
        updateState({ player: { isPlaying: false } });
      } else if (audioService.getCurrentSong()) {
        await audioService.play();
        updateState({ player: { isPlaying: true } });
      } else if (state.library.songs.length > 0) {
        // Play first song if no song is loaded
        await playSong(state.library.songs[0]);
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      updateState({ player: { isPlaying: false } });
    }
  };

  const changeVolume = (volume: number) => {
    audioService.setVolume(volume);
    updateState({ player: { volume } });
  };

  const toggleMute = () => {
    const newMuted = !state.player.isMuted;
    audioService.setMuted(newMuted);
    updateState({ player: { isMuted: newMuted } });
  };

  const selectMusicFolder = async () => {
    try {
      const folderPath = await window.electronAPI.selectMusicFolder();
      if (folderPath) {
        updateState({
          library: {
            currentPath: folderPath,
            isScanning: true,
            scanProgress: 0,
          },
        });

        const filePaths = await window.electronAPI.scanDirectory(folderPath);

        // Convert file paths to basic song objects
        const songs: Song[] = filePaths.map((filePath, index) => {
          const fileName = filePath.split(/[\\/]/).pop() || '';
          const title = fileName.replace(/\.[^/.]+$/, ''); // Remove file extension

          return {
            id: `song-${Date.now()}-${index}`,
            title: title || 'Unknown Title',
            artist: 'Unknown Artist',
            album: 'Unknown Album',
            duration: 0,
            filePath,
            fileName,
            fileFormat: fileName.split('.').pop() || 'unknown',
            fileSize: 0,
            addedDate: new Date(),
            playCount: 0,
            isFavorite: false,
          };
        });

        updateState({
          library: {
            songs,
            currentPath: folderPath,
            isScanning: false,
            scanProgress: 100,
          },
        });
      }
    } catch (error) {
      console.error('Error selecting music folder:', error);
      updateState({
        library: {
          isScanning: false,
          scanProgress: 0,
        },
      });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          currentView={state.ui.currentView}
          onNavigate={(view) => updateState({ ui: { currentView: view } })}
          onSelectFolder={selectMusicFolder}
          isScanning={state.library.isScanning}
          scanProgress={state.library.scanProgress}
          currentPath={state.library.currentPath}
          collapsed={state.ui.sidebarCollapsed}
          onToggleSidebar={() => updateState({
            ui: { sidebarCollapsed: !state.ui.sidebarCollapsed }
          })}
        />
        <MainContent
          currentView={state.ui.currentView}
          songs={state.library.songs}
          currentSong={state.player.currentSong}
          isPlaying={state.player.isPlaying}
          onPlaySong={playSong}
        />
      </div>
      <PlayerBar
        currentSong={state.player.currentSong}
        isPlaying={state.player.isPlaying}
        currentTime={state.player.currentTime}
        volume={state.player.volume}
        isMuted={state.player.isMuted}
        onPlayPause={togglePlayPause}
        onVolumeChange={changeVolume}
        onMuteToggle={toggleMute}
      />
    </div>
  );
}

export default App;