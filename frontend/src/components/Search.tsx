import { useState } from 'react';
import { Search as SearchIcon, Loader2, Play } from 'lucide-react';
import { api } from '../services/api';
import type { Song } from '../types';

interface SearchProps {
  onPlay: (song: Song) => void;
}

export function Search({ onPlay }: SearchProps) {
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
    } catch (err) {
      setError('Failed to load search results.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-8 pt-12">
      <form onSubmit={handleSearch} className="relative mb-12">
        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-zinc-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search songs, artists, albums..."
          className="w-full bg-zinc-900/50 border border-zinc-800 text-zinc-100 rounded-full py-4 pl-14 pr-6 text-lg focus:outline-none focus:ring-2 focus:ring-zinc-600 transition-all placeholder:text-zinc-500"
        />
      </form>

      {loading && (
        <div className="flex justify-center items-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
        </div>
      )}

      {error && (
        <div className="text-red-400 text-center py-8">{error}</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6 pb-24">
        {results.map((song) => (
          <div
            key={song.videoId}
            className="group bg-zinc-900/40 border border-zinc-900 rounded-2xl p-4 hover:bg-zinc-800/30 transition-all duration-300 cursor-pointer relative flex flex-col gap-3 shadow-lg hover:shadow-xl hover:-translate-y-1"
            onClick={() => onPlay(song)}
          >
            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-zinc-800 shadow-md">
              {song.thumbnails?.[0]?.url ? (
                <img src={song.thumbnails[0].url} alt={song.title} className="w-full h-full object-cover group-hover:scale-105 transition duration-500" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500">
                  🎵
                </div>
              )}
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                <div className="w-12 h-12 flex items-center justify-center bg-emerald-500 rounded-full text-zinc-950 scale-90 group-hover:scale-100 transition-all duration-300 shadow-lg">
                  <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                </div>
              </div>
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-zinc-100 font-bold truncate text-base mb-1 tracking-tight group-hover:text-emerald-400 transition">{song.title}</p>
              <p className="text-zinc-400 text-xs truncate font-medium">
                {song.artists?.map(a => a.name).join(', ')}
              </p>
            </div>
            
            <div className="flex items-center justify-between text-zinc-500 text-xs font-semibold pt-1 border-t border-zinc-900/50">
              <span className="truncate max-w-[70%]">
                {song.album?.name || 'Single'}
              </span>
              <span>
                {song.duration || '--:--'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
