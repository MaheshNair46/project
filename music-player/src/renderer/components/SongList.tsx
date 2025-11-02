import React from 'react';
import { Song } from '../shared/types';

interface SongListProps {
  songs: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  onPlaySong: (song: Song) => void;
}

const SongList: React.FC<SongListProps> = ({
  songs,
  currentSong,
  isPlaying,
  onPlaySong,
}) => {
  const formatDuration = (seconds: number): string => {
    if (seconds === 0) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (songs.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <div className="text-center">
          <h3 className="text-xl font-semibold mb-2">No songs found</h3>
          <p>Select a music folder to add songs to your library</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-white">
          All Songs ({songs.length})
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-border">
              <th className="pb-3 font-medium">#</th>
              <th className="pb-3 font-medium">Title</th>
              <th className="pb-3 font-medium">Artist</th>
              <th className="pb-3 font-medium">Album</th>
              <th className="pb-3 font-medium">Duration</th>
              <th className="pb-3 font-medium">Size</th>
              <th className="pb-3 font-medium">Format</th>
            </tr>
          </thead>
          <tbody>
            {songs.map((song, index) => {
              const isCurrentSong = currentSong?.id === song.id;
              return (
                <tr
                  key={song.id}
                  className={`border-b border-gray-800 hover:bg-hover cursor-pointer transition-colors ${
                    isCurrentSong ? 'bg-hover' : ''
                  }`}
                  onClick={() => onPlaySong(song)}
                >
                  <td className="py-3 text-gray-400">
                    <div className="w-6">
                      {isCurrentSong && isPlaying ? (
                        <span className="text-accent">♫</span>
                      ) : (
                        <span>{index + 1}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 text-white font-medium">
                    <div className="flex items-center space-x-2">
                      {isCurrentSong && isPlaying && (
                        <div className="flex space-x-1">
                          <div className="w-1 h-3 bg-accent animate-pulse"></div>
                          <div className="w-1 h-3 bg-accent animate-pulse delay-75"></div>
                          <div className="w-1 h-3 bg-accent animate-pulse delay-150"></div>
                        </div>
                      )}
                      <span>{song.title}</span>
                    </div>
                  </td>
                  <td className="py-3 text-gray-300">{song.artist}</td>
                  <td className="py-3 text-gray-300">{song.album}</td>
                  <td className="py-3 text-gray-400">
                    {formatDuration(song.duration)}
                  </td>
                  <td className="py-3 text-gray-400">
                    {formatFileSize(song.fileSize)}
                  </td>
                  <td className="py-3 text-gray-400 uppercase">
                    {song.fileFormat}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SongList;