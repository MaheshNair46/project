import React from 'react';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: string) => void;
  onSelectFolder: () => void;
  isScanning: boolean;
  scanProgress: number;
  currentPath: string;
  collapsed: boolean;
  onToggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigate,
  onSelectFolder,
  isScanning,
  scanProgress,
  currentPath,
  collapsed,
  onToggleSidebar,
}) => {
  const navigationItems = [
    { id: 'library', label: 'Library', icon: '📚' },
    { id: 'artists', label: 'Artists', icon: '🎤' },
    { id: 'albums', label: 'Albums', icon: '💿' },
    { id: 'playlists', label: 'Playlists', icon: '📝' },
    { id: 'search', label: 'Search', icon: '🔍' },
  ];

  const width = collapsed ? 'w-16' : 'w-64';

  return (
    <div className={`${width} bg-gray-900 border-r border-border flex flex-col transition-all duration-300`}>
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          {!collapsed && <h1 className="text-xl font-bold text-white">Music Player</h1>}
          <button
            onClick={onToggleSidebar}
            className="text-gray-400 hover:text-white p-1 rounded"
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigationItems.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => onNavigate(item.id)}
                className={`w-full text-left px-3 py-2 rounded-lg flex items-center space-x-3 transition-colors ${
                  currentView === item.id
                    ? 'bg-accent text-white'
                    : 'text-gray-300 hover:bg-hover hover:text-white'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {!collapsed && <span>{item.label}</span>}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Folder Selection */}
      <div className="p-4 border-t border-border">
        {!collapsed && (
          <div className="space-y-3">
            <button
              onClick={onSelectFolder}
              disabled={isScanning}
              className="w-full bg-accent hover:bg-green-600 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
            >
              {isScanning ? 'Scanning...' : 'Select Music Folder'}
            </button>

            {isScanning && (
              <div className="space-y-2">
                <div className="text-sm text-gray-400">Scanning files...</div>
                <div className="w-full bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-accent h-2 rounded-full transition-all duration-300"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              </div>
            )}

            {currentPath && !isScanning && (
              <div className="text-xs text-gray-400 break-all">
                📁 {currentPath}
              </div>
            )}
          </div>
        )}
        {collapsed && (
          <button
            onClick={onSelectFolder}
            disabled={isScanning}
            className="w-full text-gray-300 hover:text-white p-2 rounded"
          >
            📁
          </button>
        )}
      </div>
    </div>
  );
};

export default Sidebar;