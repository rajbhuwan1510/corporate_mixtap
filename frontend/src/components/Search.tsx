import { useState } from 'react';
import { Search as SearchIcon, Loader2, Play, Heart, Download, MoreHorizontal } from 'lucide-react';
import { api } from '../services/api';
import type { Song } from '../types';

interface SearchProps {
  onPlay: (song: Song) => void;
  compact?: boolean;
}

export function Search({ onPlay, compact = false }: SearchProps) {
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
      setError('Failed to load search results.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
      {/* Search form — only shown in non-compact mode or when no results yet */}
      {(!compact || results.length === 0) && (
        <form onSubmit={handleSearch} className={`relative ${compact ? 'mb-4' : 'mb-8'}`}>
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={compact ? 'Search songs...' : 'Search songs, artists, albums...'}
            className="w-full bg-white/5 border border-white/5 text-white rounded-full py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:border-[#18FF6D]/40 placeholder:text-white/25 transition"
          />
        </form>
      )}

      {/* Show search bar at top when compact and has results */}
      {compact && results.length > 0 && (
        <form onSubmit={handleSearch} className="relative mb-5">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search songs..."
            className="w-full bg-white/5 border border-white/5 text-white rounded-full py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:border-[#18FF6D]/40 placeholder:text-white/25 transition"
          />
        </form>
      )}

      {loading && (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-[#18FF6D]" />
        </div>
      )}

      {error && <div className="text-red-400 text-sm text-center py-4">{error}</div>}

      {results.length === 0 && !loading && (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-2xl">🎵</div>
          <p className="text-white/30 text-sm">Search to discover music</p>
        </div>
      )}

      {/* Card grid (Trendy Songs style) */}
      {results.length > 0 && compact && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4 pb-4">
          {results.slice(0, 10).map(song => (
            <div
              key={song.videoId}
              className="song-card group bg-white/5 rounded-2xl p-3 cursor-pointer border border-white/5 hover:border-[#18FF6D]/20 hover:bg-white/8"
              onClick={() => onPlay(song)}
            >
              <div className="relative aspect-square w-full rounded-xl overflow-hidden mb-3 bg-white/10">
                {song.thumbnails?.[0]?.url ? (
                  <img src={song.thumbnails[0].url} alt={song.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">🎵</div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full bg-[#18FF6D] flex items-center justify-center shadow-lg scale-90 group-hover:scale-100 transition">
                    <Play className="w-5 h-5 text-black fill-black ml-0.5" />
                  </div>
                </div>
              </div>
              <p className="text-white text-xs font-bold truncate leading-tight">{song.title}</p>
              <p className="text-white/40 text-[11px] truncate mt-0.5">{song.artists?.map(a => a.name).join(', ')}</p>
              <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition">
                <button className="p-1 hover:text-[#18FF6D] text-white/40 transition" onClick={e => e.stopPropagation()}>
                  <Heart className="w-3.5 h-3.5" />
                </button>
                <button className="p-1 hover:text-[#18FF6D] text-white/40 transition" onClick={e => e.stopPropagation()}>
                  <Download className="w-3.5 h-3.5" />
                </button>
                <button className="p-1 hover:text-[#18FF6D] text-white/40 transition ml-auto" onClick={e => e.stopPropagation()}>
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full list view (non-compact) */}
      {results.length > 0 && !compact && (
        <div className="flex flex-col gap-1 pb-24">
          {results.map((song, i) => (
            <div
              key={song.videoId}
              className="group flex items-center gap-4 px-4 py-3 rounded-xl cursor-pointer hover:bg-white/5 transition-all"
              onClick={() => onPlay(song)}
            >
              <span className="text-white/25 text-sm w-5 text-right font-medium">#{i + 1}</span>
              <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-white/10 flex-shrink-0">
                {song.thumbnails?.[0]?.url
                  ? <img src={song.thumbnails[0].url} alt={song.title} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-base">🎵</div>}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate group-hover:text-[#18FF6D] transition">{song.title}</p>
                <p className="text-white/40 text-xs truncate">{song.artists?.map(a => a.name).join(', ')}</p>
              </div>
              <span className="text-white/25 text-xs font-medium">{song.duration || '--:--'}</span>
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                <button className="p-1.5 hover:text-[#18FF6D] text-white/40 transition" onClick={e => e.stopPropagation()}>
                  <Heart className="w-4 h-4" />
                </button>
                <button className="p-1.5 hover:text-[#18FF6D] text-white/40 transition" onClick={e => e.stopPropagation()}>
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
