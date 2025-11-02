import React from 'react';
import SongList from './SongList';
import { Song } from '../shared/types';

interface MainContentProps {
  currentView: string;
  songs: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  onPlaySong: (song: Song) => void;
}

const MainContent: React.FC<MainContentProps> = ({
  currentView,
  songs,
  currentSong,
  isPlaying,
  onPlaySong,
}) => {
  const renderContent = () => {
    switch (currentView) {
      case 'library':
        return <SongList songs={songs} currentSong={currentSong} isPlaying={isPlaying} onPlaySong={onPlaySong} />;
      case 'artists':
        return (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Artists</h2>
              <p>Artist view coming soon</p>
            </div>
          </div>
        );
      case 'albums':
        return (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Albums</h2>
              <p>Album view coming soon</p>
            </div>
          </div>
        );
      case 'playlists':
        return (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Playlists</h2>
              <p>Playlist view coming soon</p>
            </div>
          </div>
        );
      case 'search':
        return (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Search</h2>
              <p>Search functionality coming soon</p>
            </div>
          </div>
        );
      default:
        return (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <h2 className="text-2xl font-semibold mb-2">Welcome to Music Player</h2>
              <p>Select a music folder to get started</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="flex-1 bg-background overflow-hidden">
      {/* Header */}
      <div className="bg-gray-900 border-b border-border px-6 py-4">
        <h2 className="text-xl font-semibold text-white capitalize">
          {currentView === 'library' && 'Library'}
          {currentView === 'artists' && 'Artists'}
          {currentView === 'albums' && 'Albums'}
          {currentView === 'playlists' && 'Playlists'}
          {currentView === 'search' && 'Search'}
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
};

export default MainContent;