import { useState } from 'react';
import { Search as SearchIcon, Loader2, Play, Plus, Clock } from 'lucide-react';
import { api } from '../services/api';
import type { Song } from '../types';

interface SearchProps {
  onPlay: (song: Song) => void;
  onQueue?: (song: Song) => void;
}

export function Search({ onPlay, onQueue }: SearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.search(query);
      setResults(data.results || []);
    } catch {
      setError('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full flex flex-col h-full overflow-hidden">
      {/* Search Input bar */}
      <form onSubmit={handleSearch} className="relative mb-5 flex-shrink-0">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-white/30" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search corporate directories, songs, or artists..."
          className="w-full bg-[#111622] border border-white/5 text-white rounded-xl py-3 pl-12 pr-10 text-sm focus:outline-none focus:border-[#0081c9]/40 focus:ring-1 focus:ring-[#0081c9]/20 placeholder:text-white/20 transition"
        />
        {loading && (
          <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-[#0081c9]" />
        )}
      </form>

      {error && <div className="text-red-400 text-xs text-center py-2 flex-shrink-0">{error}</div>}

      {/* Results structured table list */}
      <div className="flex-1 overflow-y-auto pr-1">
        {results.length > 0 ? (
          <div className="flex flex-col min-w-full">
            {/* Table Header */}
            <div className="flex items-center px-4 py-2 border-b border-white/5 text-[10px] font-bold text-white/30 uppercase tracking-widest flex-shrink-0">
              <span className="w-6 text-center">#</span>
              <span className="flex-1 ml-4">Title</span>
              <span className="w-40 hidden md:block">Album</span>
              <span className="w-20 text-right flex items-center justify-end"><Clock className="w-3.5 h-3.5" /></span>
            </div>

            {/* Table Rows */}
            <div className="flex flex-col gap-0.5 mt-2">
              {results.map((song, i) => (
                <div
                  key={song.videoId}
                  className="group flex items-center px-4 py-2.5 rounded-xl cursor-pointer hover:bg-white/5 border border-transparent hover:border-white/5 transition-all"
                  onClick={() => onPlay(song)}
                >
                  <span className="w-6 text-center text-xs font-semibold text-white/25 group-hover:text-[#0081c9] transition">
                    {i + 1}
                  </span>
                  
                  {/* Title & Artist */}
                  <div className="flex-1 flex items-center gap-3 ml-4 min-w-0">
                    <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 border border-white/5">
                      {song.thumbnails?.[0]?.url ? (
                        <img
                          src={song.thumbnails[song.thumbnails.length - 1].url}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs">🎵</div>
                      )}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                        <Play className="w-4 h-4 text-[#0081c9] fill-[#0081c9]" />
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-xs font-semibold truncate group-hover:text-[#0081c9] transition">
                        {song.title}
                      </p>
                      <p className="text-white/40 text-[10px] truncate mt-0.5">
                        {song.artists?.map(a => a.name).join(', ')}
                      </p>
                    </div>
                  </div>

                  {/* Album */}
                  <span className="w-40 hidden md:block text-xs text-white/40 truncate pr-4">
                    {song.album?.name || 'Single'}
                  </span>

                  {/* Actions / Time */}
                  <div className="w-20 flex items-center justify-end gap-3">
                    {onQueue && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onQueue(song);
                        }}
                        className="p-1.5 rounded-lg bg-white/5 opacity-100 lg:opacity-0 group-hover:opacity-100 hover:bg-white/10 text-white/50 hover:text-[#0081c9] transition"
                        title="Add to queue"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <span className="text-white/25 text-xs font-semibold w-8 text-right">
                      {song.duration || '--:--'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          !loading && (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-center text-white/25 py-12">
              <div className="text-3xl">💼</div>
              <p className="text-xs font-medium">Search for media files or corporate playlists</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}
