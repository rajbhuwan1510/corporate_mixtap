import { useState, useEffect } from 'react';
import { Search } from './components/Search';
import { Player } from './components/Player';
import { JoinRoom } from './components/JoinRoom';
import type { Song, Room } from './types';
import { api } from './services/api';
import { Search as SearchIcon, LayoutGrid, Disc, Mic2, PlusCircle, ArrowLeft, Users } from 'lucide-react';

// Help generate a simple unique temporary anonymous user ID
const getOrCreateUserId = () => {
  let id = localStorage.getItem('tempo_user_id');
  if (!id) {
    id = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('tempo_user_id', id);
  }
  return id;
};

const getOrCreateUserName = () => {
  return localStorage.getItem('tempo_user_name') || '';
};

function App() {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  
  // Room routing states
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>(getOrCreateUserName());
  const [userId] = useState<string>(getOrCreateUserId());
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [roomData, setRoomData] = useState<Room | null>(null);

  // Parse path on load and window popstate
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const match = path.match(/^\/room\/([A-Z0-9]+)$/);
      if (match) {
        setRoomId(match[1]);
        const storedName = getOrCreateUserName();
        if (storedName) {
          setIsJoined(true);
        } else {
          setIsJoined(false);
        }
      } else {
        setRoomId(null);
        setIsJoined(false);
        setRoomData(null);
      }
    };

    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const handleCreateRoom = async () => {
    // If user name is empty, ask for name first before creating room
    let name = userName;
    if (!name) {
      const inputName = prompt('Enter your name to host a room:');
      if (!inputName || !inputName.trim()) return;
      name = inputName.trim();
      setUserName(name);
      localStorage.setItem('tempo_user_name', name);
    }

    try {
      // Get current playback state if playing locally
      const isPlaying = false; // We can snapshot local playing state if needed, or default
      const position = 0;
      const room = await api.createRoom(userId, name, currentSong, position, isPlaying);
      
      // Update browser URL
      window.history.pushState({}, '', `/room/${room.id}`);
      setRoomId(room.id);
      setIsJoined(true);
      setRoomData(room);
    } catch (err) {
      console.error('Failed to create room:', err);
      alert('Failed to create room.');
    }
  };

  const handleJoinRoom = (name: string) => {
    setUserName(name);
    localStorage.setItem('tempo_user_name', name);
    setIsJoined(true);
  };

  const navigateToHome = () => {
    window.history.pushState({}, '', '/');
    setRoomId(null);
    setIsJoined(false);
    setRoomData(null);
  };

  return (
    <div className="min-h-screen bg-[#0e0c15] text-[#e2e8f0] flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <nav className="w-64 bg-[#0e0c15] p-6 flex flex-col gap-8 hidden md:flex border-r border-[#1f1b2e]/50">
        <div className="flex items-center gap-3 text-zinc-100 cursor-pointer" onClick={navigateToHome}>
          <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-lg object-cover" />
          <span className="text-lg font-bold tracking-tight text-white">corporate mixtape</span>
        </div>

        <div className="flex flex-col gap-1 text-sm font-medium">
          <p className="text-zinc-500 text-xs mb-2 tracking-wider uppercase">Menu</p>
          <button onClick={navigateToHome} className={`flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left transition ${!roomId ? 'bg-[#1a162b] text-emerald-400 border-l-2 border-emerald-400 rounded-l-none' : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#1a162b]/50'}`}>
            <SearchIcon className="w-4 h-4" /> Discover
          </button>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-[#1a162b]/50 transition">
            <LayoutGrid className="w-4 h-4" /> Trends
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-[#1a162b]/50 transition">
            <Disc className="w-4 h-4" /> Genres
          </a>
          <a href="#" className="flex items-center gap-3 px-3 py-2 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-[#1a162b]/50 transition">
            <Mic2 className="w-4 h-4" /> Artists
          </a>
        </div>

        <div className="flex flex-col gap-1 text-sm font-medium mt-4">
          <p className="text-zinc-500 text-xs mb-2 tracking-wider uppercase">Rooms</p>
          <button
            onClick={handleCreateRoom}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/20 transition w-full text-left"
          >
            <PlusCircle className="w-4 h-4" /> Create Room
          </button>
          <button
            onClick={() => {
              const code = prompt('Enter Room Code:');
              if (code && code.trim()) {
                const cleanCode = code.trim().toUpperCase();
                window.history.pushState({}, '', `/room/${cleanCode}`);
                window.dispatchEvent(new Event('popstate'));
              }
            }}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-indigo-400 hover:text-indigo-300 hover:bg-indigo-950/20 transition w-full text-left"
          >
            <Users className="w-4 h-4" /> Join Room
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto bg-gradient-to-b from-[#141221] to-[#0c0a12] relative min-h-screen pb-24">
        {roomId ? (
          !isJoined ? (
            <div className="pt-12">
              <JoinRoom roomId={roomId} onJoin={handleJoinRoom} />
            </div>
          ) : (
            <div className="p-8 text-zinc-100 max-w-6xl mx-auto flex flex-col gap-8">
              <div className="flex items-center gap-4">
                <button onClick={navigateToHome} className="p-2 bg-[#1b172e] hover:bg-[#25203f] rounded-full transition">
                  <ArrowLeft className="w-5 h-5 text-zinc-300" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-3">
                    Room {roomId}
                  </h1>
                </div>
              </div>

              {roomData && (
                <div className="relative overflow-hidden bg-gradient-to-r from-[#211a3d] to-[#120f21] border border-[#2b244d]/50 rounded-3xl p-8 flex flex-col md:flex-row gap-8 items-center shadow-2xl">
                  {/* Decorative glow */}
                  <div className="absolute -left-12 -top-12 w-48 h-48 rounded-full bg-emerald-500/10 blur-3xl"></div>
                  
                  {roomData.currentSong?.thumbnails?.[0]?.url ? (
                    <img
                      src={roomData.currentSong.thumbnails[0].url}
                      alt="Cover"
                      className="w-48 h-48 rounded-2xl object-cover shadow-2xl z-10 border border-[#3e346d]"
                    />
                  ) : (
                    <div className="w-48 h-48 rounded-2xl bg-[#1b172e] border border-[#2e274f] flex items-center justify-center text-4xl shadow-2xl z-10 text-emerald-400">
                      🎵
                    </div>
                  )}
                  
                  <div className="flex-1 flex flex-col gap-3 text-center md:text-left z-10">
                    <div className="flex items-center justify-center md:justify-start gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      <p className="text-emerald-400 text-xs font-bold tracking-widest uppercase">NOW PLAYING IN ROOM</p>
                    </div>
                    <h2 className="text-4xl font-extrabold text-white tracking-tight leading-none truncate max-w-xl">
                      {roomData.currentSong?.title || 'No track playing'}
                    </h2>
                    <p className="text-zinc-300 text-lg font-medium truncate max-w-xl">
                      {roomData.currentSong?.artists?.map(a => a.name).join(', ') || 'Select a song below to broadcast'}
                    </p>
                  </div>
                </div>
              )}

              {/* Search list as additions */}
              <div className="border-t border-[#1e1a30] pt-8">
                <h3 className="text-lg font-bold text-white mb-6 tracking-tight">Add to Room Playlist</h3>
                <Search onPlay={(song) => {
                  setCurrentSong(song);
                }} />
              </div>
            </div>
          )
        ) : (
          <div className="p-8 max-w-6xl mx-auto flex flex-col gap-8">
            <div className="md:hidden p-4 border-b border-[#1f1b2e]/50 flex justify-between items-center bg-[#0e0c15]">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="Logo" className="w-6 h-6 rounded-md object-cover" />
                <span className="text-base font-bold tracking-tight text-white">corporate mixtape</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateRoom}
                  className="bg-emerald-500 text-zinc-950 font-bold px-3 py-1.5 rounded-lg text-xs hover:bg-emerald-400 transition"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    const code = prompt('Enter Room Code:');
                    if (code && code.trim()) {
                      const cleanCode = code.trim().toUpperCase();
                      window.history.pushState({}, '', `/room/${cleanCode}`);
                      window.dispatchEvent(new Event('popstate'));
                    }
                  }}
                  className="bg-[#1b172e] border border-[#2e284f] text-indigo-400 px-3 py-1.5 rounded-lg text-xs font-semibold hover:text-indigo-300 hover:bg-[#25203f] transition"
                >
                  Join
                </button>
              </div>
            </div>

            {/* Mock Artist Banner (Mocking Billie Eilish element) */}
            <div className="relative w-full h-64 rounded-3xl overflow-hidden bg-gradient-to-r from-[#211a3d] to-[#120f21] border border-[#2b244d]/50 shadow-2xl flex items-center px-12 gap-8">
              <div className="absolute right-0 bottom-0 top-0 w-1/2 opacity-30 md:opacity-100 flex justify-end items-end overflow-hidden">
                {currentSong?.thumbnails?.[0]?.url ? (
                  <img src={currentSong.thumbnails[0].url} alt="Cover" className="w-[300px] h-[300px] object-cover rounded-full translate-x-12 translate-y-12 blur-sm" />
                ) : (
                  <div className="w-[200px] h-[200px] bg-gradient-to-br from-emerald-400 to-indigo-500 rounded-full translate-x-12 translate-y-12 opacity-40 blur-xl"></div>
                )}
              </div>
              <div className="flex flex-col gap-3 max-w-md z-10">
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold tracking-widest uppercase">
                  <span className="bg-emerald-500/20 px-2 py-0.5 rounded text-[10px] border border-emerald-500/30">VERIFIED ARTIST</span>
                </div>
                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-none">
                  {currentSong ? currentSong.title : 'Explore Corporate Mixtape'}
                </h1>
                <p className="text-zinc-400 text-sm font-medium">
                  {currentSong ? `By ${currentSong.artists?.map(a => a.name).join(', ')}` : 'Create or join a listening room to synchronize audio in real-time.'}
                </p>
              </div>
            </div>

            {/* Search list */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-6 tracking-tight">Trendy Songs</h2>
              <Search onPlay={(song) => setCurrentSong(song)} />
            </div>
          </div>
        )}
      </main>

      {/* Global & Room Player */}
      <Player
        currentSong={currentSong}
        roomId={roomId}
        isJoined={isJoined && !!roomId}
        userId={userId}
        userName={userName}
        onRoomStateChange={(room) => setRoomData(room)}
      />
    </div>
  );
}

export default App;
