import { useState, useEffect } from 'react';
import { Player } from './components/Player';
import { JoinRoom } from './components/JoinRoom';
import { Search as SearchComponent } from './components/Search';
import type { Song, Room } from './types';
import { api } from './services/api';
import {
  Search, LayoutGrid, Radio, Mic2, BookOpen, PlusCircle, Users,
  Bell, MessageSquare, ChevronRight,
  Music2, TrendingUp, Disc3, ArrowLeft
} from 'lucide-react';

const getOrCreateUserId = () => {
  let id = localStorage.getItem('tempo_user_id');
  if (!id) { id = 'user_' + Math.random().toString(36).substr(2, 9); localStorage.setItem('tempo_user_id', id); }
  return id;
};
const getOrCreateUserName = () => localStorage.getItem('tempo_user_name') || '';

type NavTab = 'discover' | 'trending' | 'latest' | 'popular';

// Mock friends list
const MOCK_FRIENDS = [
  { name: 'James Foster', avatar: 'JF', color: '#FF6B6B' },
  { name: 'Wilson Ray', avatar: 'WR', color: '#4ECDC4' },
  { name: 'Jason Mraz', avatar: 'JM', color: '#45B7D1' },
  { name: 'Tom Allen', avatar: 'TA', color: '#96CEB4' },
];

function App() {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('discover');
  const [activeNav, setActiveNav] = useState('Discover');

  // Room states
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>(getOrCreateUserName());
  const [userId] = useState<string>(getOrCreateUserId());
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [roomData, setRoomData] = useState<Room | null>(null);

  // Parse path on load
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const match = path.match(/^\/room\/([A-Z0-9]+)$/);
      if (match) {
        setRoomId(match[1]);
        if (getOrCreateUserName()) setIsJoined(true);
        else setIsJoined(false);
      } else {
        setRoomId(null); setIsJoined(false); setRoomData(null);
      }
    };
    handleLocationChange();
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const handleCreateRoom = async () => {
    let name = userName;
    if (!name) {
      const inputName = prompt('Enter your name to host a room:');
      if (!inputName?.trim()) return;
      name = inputName.trim();
      setUserName(name);
      localStorage.setItem('tempo_user_name', name);
    }
    try {
      const room = await api.createRoom(userId, name, currentSong, 0, false);
      window.history.pushState({}, '', `/room/${room.id}`);
      setRoomId(room.id); setIsJoined(true); setRoomData(room);
    } catch { alert('Failed to create room.'); }
  };

  const handleJoinRoom = (name: string) => {
    setUserName(name);
    localStorage.setItem('tempo_user_name', name);
    setIsJoined(true);
  };

  const navigateToHome = () => {
    window.history.pushState({}, '', '/');
    setRoomId(null); setIsJoined(false); setRoomData(null);
  };

  const navItems = [
    { icon: <LayoutGrid className="w-4 h-4" />, label: 'Discover' },
    { icon: <TrendingUp className="w-4 h-4" />, label: 'Trends' },
    { icon: <Disc3 className="w-4 h-4" />, label: 'Genres' },
    { icon: <Radio className="w-4 h-4" />, label: 'Radio' },
    { icon: <Mic2 className="w-4 h-4" />, label: 'Artist' },
    { icon: <BookOpen className="w-4 h-4" />, label: 'Albums' },
  ];

  const navTabs: NavTab[] = ['discover', 'popular', 'latest', 'trending'];

  return (
    <div className="h-screen bg-[#0D0225] text-white flex overflow-hidden" style={{ fontFamily: "'Jost', sans-serif" }}>

      {/* ── Left Sidebar ──────────────────────────────────────────── */}
      <aside className="w-56 bg-[#100830] flex-shrink-0 flex flex-col h-full border-r border-white/5 hidden md:flex">
        {/* Logo */}
        <div className="px-5 pt-6 pb-4">
          <div className="flex items-center gap-2.5 cursor-pointer" onClick={navigateToHome}>
            <div className="w-8 h-8 bg-[#18FF6D] rounded-lg flex items-center justify-center">
              <Music2 className="w-4 h-4 text-black" />
            </div>
            <span className="font-bold text-sm text-white tracking-wide">corporate mixtape</span>
          </div>
        </div>

        {/* Main Nav */}
        <nav className="flex flex-col gap-0.5 px-3 mt-2">
          {navItems.map(({ icon, label }) => (
            <button
              key={label}
              onClick={() => { setActiveNav(label); if (label === 'Discover') navigateToHome(); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium w-full text-left transition-all ${
                activeNav === label
                  ? 'nav-active text-[#18FF6D]'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/5'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </nav>

        {/* Divider */}
        <div className="mx-4 my-4 border-t border-white/5" />

        {/* My Library */}
        <div className="px-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-white/30 text-[11px] font-semibold tracking-widest uppercase">My Library</span>
            <PlusCircle className="w-3.5 h-3.5 text-white/30 cursor-pointer hover:text-[#18FF6D] transition" />
          </div>
          <div className="flex flex-col gap-1">
            {['Best of year', 'Best of month', 'Folk diary'].map(item => (
              <button key={item} className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-white/40 hover:text-white/70 text-xs font-medium w-full text-left transition hover:bg-white/5">
                <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 my-4 border-t border-white/5" />

        {/* Rooms */}
        <div className="px-4 flex flex-col gap-1">
          <button
            onClick={handleCreateRoom}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-[#18FF6D] hover:bg-[#18FF6D]/10 transition text-sm font-medium w-full text-left"
          >
            <PlusCircle className="w-4 h-4" />
            Create Room
          </button>
          <button
            onClick={() => {
              const code = prompt('Enter Room Code:');
              if (code?.trim()) {
                const clean = code.trim().toUpperCase();
                window.history.pushState({}, '', `/room/${clean}`);
                window.dispatchEvent(new Event('popstate'));
              }
            }}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-purple-400 hover:bg-purple-500/10 transition text-sm font-medium w-full text-left"
          >
            <Users className="w-4 h-4" />
            Join Room
          </button>
        </div>

        <div className="flex-1" />
      </aside>

      {/* ── Main Content ──────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">

        {/* Room view */}
        {roomId ? (
          !isJoined ? (
            <div className="flex-1 overflow-y-auto p-8">
              <JoinRoom roomId={roomId} onJoin={handleJoinRoom} />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-8 max-w-5xl mx-auto w-full flex flex-col gap-8">
              <div className="flex items-center gap-4 mt-4">
                <button onClick={navigateToHome} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition">
                  <ArrowLeft className="w-5 h-5 text-white/60" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-white">Room {roomId}</h1>
                  <p className="text-white/40 text-sm">{roomData?.users?.length || 0} listeners</p>
                </div>
              </div>

              {roomData && (
                <div className="relative overflow-hidden rounded-3xl p-8 flex gap-8 items-center"
                  style={{ background: 'linear-gradient(135deg, #1a0f3c 0%, #0f1a2e 100%)' }}>
                  <div className="absolute -left-8 -top-8 w-48 h-48 rounded-full bg-[#18FF6D]/10 blur-3xl" />
                  {roomData.currentSong?.thumbnails?.[0]?.url
                    ? <img src={roomData.currentSong.thumbnails[roomData.currentSong.thumbnails.length - 1].url} alt="Cover" className="w-40 h-40 rounded-2xl object-cover shadow-2xl z-10" />
                    : <div className="w-40 h-40 rounded-2xl bg-white/5 flex items-center justify-center text-4xl z-10">🎵</div>
                  }
                  <div className="z-10">
                    <p className="text-[#18FF6D] text-xs font-bold tracking-widest uppercase mb-2">● NOW PLAYING IN ROOM</p>
                    <h2 className="text-3xl font-black text-white">{roomData.currentSong?.title || 'No track playing'}</h2>
                    <p className="text-white/50 mt-1">{roomData.currentSong?.artists?.map(a => a.name).join(', ') || 'Search and play a song'}</p>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold text-white mb-4">Add to Room</h3>
                <SearchComponent onPlay={song => setCurrentSong(song)} compact />
              </div>
            </div>
          )
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">

            {/* Top Bar */}
            <header className="flex-shrink-0 flex items-center gap-6 px-8 pt-6 pb-4">
              {/* Tab nav */}
              <nav className="flex items-center gap-6">
                {navTabs.map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`text-sm font-semibold capitalize transition-all pb-1 ${
                      activeTab === tab
                        ? 'text-white border-b-2 border-[#18FF6D]'
                        : 'text-white/40 hover:text-white/70'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </nav>

              {/* Search bar */}
              <div className="flex-1 max-w-xs relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <input
                  type="text"
                  placeholder="Search anything here..."
                  className="w-full bg-white/5 border border-white/5 rounded-full py-2 pl-9 pr-4 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:border-[#18FF6D]/40 transition"
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      const q = (e.target as HTMLInputElement).value.trim();
                      if (q) {
                        // Trigger search by dispatching to a search state
                        setActiveTab('discover');
                      }
                    }
                  }}
                />
              </div>

              <div className="flex items-center gap-3 ml-auto">
                <button className="relative w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition">
                  <MessageSquare className="w-4 h-4 text-white/50" />
                </button>
                <button className="relative w-9 h-9 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 transition">
                  <Bell className="w-4 h-4 text-white/50" />
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#18FF6D]" />
                </button>
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 border-2 border-[#18FF6D] cursor-pointer overflow-hidden">
                  <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                    {userName ? userName[0].toUpperCase() : 'U'}
                  </div>
                </div>
              </div>
            </header>

            {/* Content area + right panel */}
            <div className="flex-1 flex overflow-hidden">

              {/* Scrollable main */}
              <div className="flex-1 overflow-y-auto px-8 pb-32">

                {/* Hero Banner */}
                <div className="relative w-full rounded-2xl overflow-hidden mb-8 h-52"
                  style={{ background: 'linear-gradient(135deg, #1a0b35 0%, #0e1a30 100%)' }}>
                  <div className="absolute inset-0 bg-gradient-to-r from-[#1a0b35] via-[#1a0b35]/80 to-transparent z-10" />

                  {/* Background art */}
                  {currentSong?.thumbnails?.[1]?.url || currentSong?.thumbnails?.[0]?.url ? (
                    <img
                      src={currentSong.thumbnails[currentSong.thumbnails.length - 1]?.url}
                      alt=""
                      className="absolute right-0 top-0 h-full w-auto object-cover opacity-60"
                    />
                  ) : (
                    <div className="absolute right-0 top-0 h-full w-64 bg-gradient-to-l from-purple-900/40 to-transparent" />
                  )}

                  <div className="relative z-20 p-8 h-full flex flex-col justify-center">
                    <span className="text-[#18FF6D] text-[10px] font-bold tracking-widest uppercase mb-2 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-[#18FF6D] inline-block" />
                      {currentSong ? 'Now Playing' : 'Verified Artist'}
                    </span>
                    <h1 className="text-4xl font-black text-white leading-none mb-2 tracking-tight">
                      {currentSong ? currentSong.title : 'corporate mixtape'}
                    </h1>
                    <p className="text-white/50 text-sm font-medium">
                      {currentSong
                        ? currentSong.artists?.map(a => a.name).join(', ')
                        : 'Search a song to start listening'}
                    </p>
                  </div>

                  {/* Nav arrows */}
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex gap-2">
                    <button className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
                      <ChevronRight className="w-4 h-4 rotate-180 text-white/70" />
                    </button>
                    <button className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
                      <ChevronRight className="w-4 h-4 text-white/70" />
                    </button>
                  </div>
                </div>

                {/* Trendy Songs section */}
                <section className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-white">Trendy Songs</h2>
                    <div className="flex gap-2">
                      <button className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
                        <ChevronRight className="w-3.5 h-3.5 rotate-180 text-white/70" />
                      </button>
                      <button className="w-6 h-6 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
                        <ChevronRight className="w-3.5 h-3.5 text-white/70" />
                      </button>
                    </div>
                  </div>
                  <SearchComponent onPlay={song => setCurrentSong(song)} compact />
                </section>

              </div>

              {/* ── Right Panel ──────────────────────────────────────── */}
              <aside className="w-64 flex-shrink-0 overflow-y-auto px-4 pt-2 pb-32 hidden lg:flex flex-col gap-6 border-l border-white/5">

                {/* Friends */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-white">Friends</h3>
                    <button className="text-[#18FF6D] text-xs font-semibold hover:underline">Show all</button>
                  </div>
                  <div className="flex flex-col gap-3">
                    {MOCK_FRIENDS.map(friend => (
                      <div key={friend.name} className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                          style={{ background: friend.color }}>
                          {friend.avatar}
                        </div>
                        <span className="text-white/60 text-xs font-medium flex-1 truncate">{friend.name}</span>
                        <button className="text-[10px] text-[#18FF6D] border border-[#18FF6D]/30 px-2 py-0.5 rounded-full hover:bg-[#18FF6D]/10 transition font-semibold">
                          Follow
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Premium Card */}
                <div className="rounded-2xl p-4 relative overflow-hidden"
                  style={{ background: 'linear-gradient(135deg, #18FF6D 0%, #00C851 100%)' }}>
                  <div className="absolute -right-4 -top-4 w-24 h-24 rounded-full bg-white/10" />
                  <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Now</span>
                  <h4 className="text-black font-black text-base mt-2 leading-tight">Get Your Premium Now!</h4>
                  <p className="text-black/60 text-[11px] mt-1 leading-snug">Let's upgrade your music to premium and listen to songs without ads</p>
                  <button className="mt-3 w-full bg-white text-black text-xs font-bold py-2 rounded-xl hover:bg-white/90 transition">
                    Get Premium
                  </button>
                </div>

                {/* Currently in room */}
                {roomId && roomData && (
                  <div className="rounded-2xl p-4 bg-white/5 border border-white/10">
                    <p className="text-white/40 text-[10px] uppercase tracking-widest mb-2">Room</p>
                    <p className="text-white font-bold text-sm truncate">{roomId}</p>
                    <p className="text-[#18FF6D] text-xs mt-1">{roomData.users.length} listening</p>
                    <div className="flex flex-col gap-1.5 mt-3">
                      {roomData.users.slice(0, 4).map(u => (
                        <div key={u.id} className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#18FF6D]" />
                          <span className="text-white/60 text-xs truncate">{u.name}</span>
                          {u.id === roomData.hostId && <span className="text-[9px] bg-[#18FF6D]/20 text-[#18FF6D] px-1.5 rounded font-bold">HOST</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </div>
        )}

      </main>

      {/* ── Bottom Player ────────────────────────────────────────────── */}
      <Player
        currentSong={currentSong}
        roomId={roomId}
        isJoined={isJoined && !!roomId}
        userId={userId}
        userName={userName}
        onRoomStateChange={room => setRoomData(room)}
      />
    </div>
  );
}

export default App;
