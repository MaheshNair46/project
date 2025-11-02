import React from 'react';
import { Song } from '../shared/types';

interface PlayerBarProps {
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  volume: number;
  isMuted: boolean;
  onPlayPause: () => void;
  onVolumeChange: (volume: number) => void;
  onMuteToggle: () => void;
}

const PlayerBar: React.FC<PlayerBarProps> = ({
  currentSong,
  isPlaying,
  currentTime,
  volume,
  isMuted,
  onPlayPause,
  onVolumeChange,
  onMuteToggle,
}) => {
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentSong) {
    return (
      <div className="h-16 bg-gray-900 border-t border-border flex items-center justify-center">
        <p className="text-gray-400 text-sm">No song selected</p>
      </div>
    );
  }

  return (
    <div className="h-16 bg-gray-900 border-t border-border flex items-center px-4">
      {/* Song Info */}
      <div className="w-80 flex items-center space-x-3 flex-shrink-0">
        <div className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center">
          ♫
        </div>
        <div className="min-w-0">
          <div className="text-white text-sm font-medium truncate">
            {currentSong.title}
          </div>
          <div className="text-gray-400 text-xs truncate">
            {currentSong.artist}
          </div>
        </div>
      </div>

      {/* Player Controls */}
      <div className="flex-1 flex flex-col items-center justify-center">
        {/* Controls */}
        <div className="flex items-center space-x-4 mb-2">
          <button className="text-gray-400 hover:text-white transition-colors">
            ⏮
          </button>
          <button
            onClick={onPlayPause}
            className="w-10 h-10 bg-accent hover:bg-green-600 text-white rounded-full flex items-center justify-center transition-colors"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button className="text-gray-400 hover:text-white transition-colors">
            ⏭
          </button>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center space-x-2 w-full max-w-md">
          <span className="text-xs text-gray-400 w-10 text-right">
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 bg-gray-700 rounded-full h-1 cursor-pointer">
            <div
              className="bg-accent h-1 rounded-full transition-all duration-100"
              style={{ width: '0%' }}
            />
          </div>
          <span className="text-xs text-gray-400 w-10">
            {formatTime(currentSong.duration)}
          </span>
        </div>
      </div>

      {/* Volume Controls */}
      <div className="w-80 flex items-center justify-end space-x-3 flex-shrink-0">
        <button
          onClick={onMuteToggle}
          className="text-gray-400 hover:text-white transition-colors"
        >
          {isMuted || volume === 0 ? '🔇' : '🔊'}
        </button>
        <div className="w-24 bg-gray-700 rounded-full h-1">
          <div
            className="bg-accent h-1 rounded-full transition-all duration-100"
            style={{ width: `${isMuted ? 0 : volume * 100}%` }}
          />
        </div>
        <button className="text-gray-400 hover:text-white transition-colors">
          ⚙
        </button>
      </div>
    </div>
  );
};

export default PlayerBar;