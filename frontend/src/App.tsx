import { useState, useEffect } from 'react';
import { Search } from './components/Search';
import { Player } from './components/Player';
import { JoinRoom } from './components/JoinRoom';
import { Chatroom } from './components/Chatroom';
import type { Song, Room } from './types';
import { api } from './services/api';
import logoImg from './assets/logo.png';
import {
  Home, Compass, Users, PlusCircle, Layout,
  Trash2, Bell, MessageSquare, ChevronLeft, ListMusic
} from 'lucide-react';

const getOrCreateUserId = () => {
  let id = localStorage.getItem('tempo_user_id');
  if (!id) {
    id = 'user_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('tempo_user_id', id);
  }
  return id;
};
const getOrCreateUserName = () => localStorage.getItem('tempo_user_name') || '';

interface RadioStation {
  id: string;
  name: string;
  genre: string;
  description: string;
  coverUrl: string;
  playlist: Song[];
}

const RADIO_STATIONS: RadioStation[] = [
  {
    id: 'focus',
    name: 'Deep Focus Radio',
    genre: 'Lofi / Ambient',
    description: 'Perfect instrumental beats for concentration and deep work.',
    coverUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80',
    playlist: [
      {
        videoId: 'JtB6vLC3E_U',
        title: 'Boba Tea',
        artists: [{ name: 'LuKremBo' }],
        thumbnails: [{ url: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?w=400&q=80' }]
      },
      {
        videoId: '6eWIffP2M3Y',
        title: 'Bread',
        artists: [{ name: 'LuKremBo' }],
        thumbnails: [{ url: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=400&q=80' }]
      }
    ]
  },
  {
    id: 'jazz',
    name: 'Office Lounge Jazz',
    genre: 'Jazz / Bossa Nova',
    description: 'Relaxing background rhythms to keep the mood light and productive.',
    coverUrl: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=400&q=80',
    playlist: [
      {
        videoId: 'vPlgzl8cbjI',
        title: 'Jazzy Frenchy',
        artists: [{ name: 'Bensound' }],
        thumbnails: [{ url: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=400&q=80' }]
      },
      {
        videoId: 'rggOgZu5nlM',
        title: 'The Jazz Piano',
        artists: [{ name: 'Bensound' }],
        thumbnails: [{ url: 'https://images.unsplash.com/photo-1486591978090-58e619d37fe7?w=400&q=80' }]
      }
    ]
  },
  {
    id: 'energy',
    name: 'Energy Sync',
    genre: 'Synthwave / Retro',
    description: 'High-energy focus tracks to power through the afternoon slump.',
    coverUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80',
    playlist: [
      {
        videoId: '4xDzrJKXOOY',
        title: 'Retro Synthwave Focus',
        artists: [{ name: 'Synth Explorer' }],
        thumbnails: [{ url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80' }]
      },
      {
        videoId: 'MVPTGNGiI-4',
        title: 'Electronic Work rhythms',
        artists: [{ name: 'Cyber Beats' }],
        thumbnails: [{ url: 'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?w=400&q=80' }]
      }
    ]
  }
];

function App() {
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [queue, setQueue] = useState<Song[]>([]);
  const [activeTab, setActiveTab] = useState<'Discover' | 'Channels' | 'Favorites'>('Discover');
  const [volume] = useState<number>(80);
  const [activeStation, setActiveStation] = useState<RadioStation | null>(null);
  const [stationSongIndex, setStationSongIndex] = useState<number>(0);

  // Room states
  const [roomId, setRoomId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>(getOrCreateUserName());
  const [userId] = useState<string>(getOrCreateUserId());
  const [isJoined, setIsJoined] = useState<boolean>(false);
  const [roomData, setRoomData] = useState<Room | null>(null);

  // Chat states
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [sendChatMessage, setSendChatMessage] = useState<((msg: any) => void) | null>(null);

  const handleSendChatMessage = (text: string) => {
    if (sendChatMessage) {
      sendChatMessage({
        type: 'ROOM_CHAT',
        text: text,
        userName: userName
      });
    }
  };

  const handleChatMessageReceived = (chat: any) => {
    setChatMessages(prev => [...prev, chat]);
  };

  // Parse path on load
  useEffect(() => {
    const handleLocationChange = () => {
      const path = window.location.pathname;
      const match = path.match(/^\/room\/([A-Z0-9]+)$/);
      setChatMessages([]);
      if (match) {
        setRoomId(match[1]);
        if (getOrCreateUserName()) setIsJoined(true);
        else setIsJoined(false);
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
    let name = userName;
    if (!name) {
      const inputName = prompt('Enter your corporate alias to host a room:');
      if (!inputName || !inputName.trim()) return;
      name = inputName.trim();
      setUserName(name);
      localStorage.setItem('tempo_user_name', name);
    }
    try {
      const room = await api.createRoom(userId, name, currentSong, 0, false);
      window.history.pushState({}, '', `/room/${room.id}`);
      setRoomId(room.id);
      setIsJoined(true);
      setRoomData(room);
    } catch {
      alert('Failed to launch sync broadcast room.');
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

  const handleSelectSong = (song: Song) => {
    if (activeStation) return; // Disable custom selection in radio mode
    if (roomId && isJoined && sendChatMessage) {
      if (!displaySong) {
        sendChatMessage({ type: 'ROOM_TRACK_CHANGED', song });
      } else {
        sendChatMessage({ type: 'ROOM_ADD_TO_PLAYLIST', song });
      }
    } else {
      if (!currentSong) {
        setCurrentSong(song);
      } else {
        setQueue(prev => [...prev, song]);
      }
    }
  };

  const handleAddToQueue = (song: Song) => {
    if (activeStation) return; // Disable queue additions in radio mode
    if (roomId && isJoined && sendChatMessage) {
      sendChatMessage({ type: 'ROOM_ADD_TO_PLAYLIST', song });
    } else {
      setQueue(prev => [...prev, song]);
    }
  };

  const handleNextSong = () => {
    if (activeStation) {
      // Loop radio station songs continuously
      const nextIdx = (stationSongIndex + 1) % activeStation.playlist.length;
      setStationSongIndex(nextIdx);
      setCurrentSong(activeStation.playlist[nextIdx]);
    } else if (queue.length > 0) {
      const next = queue[0];
      setQueue(prev => prev.slice(1));
      setCurrentSong(next);
    } else {
      setCurrentSong(null);
    }
  };

  const handleRemoveFromQueue = (index: number) => {
    if (activeStation) return; // Disable queue modifications in radio mode
    if (roomId && isJoined && sendChatMessage && roomData) {
      const actualIndex = roomData.playlistIndex + 1 + index;
      sendChatMessage({ type: 'ROOM_REMOVE_FROM_PLAYLIST', index: actualIndex });
    } else {
      setQueue(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleClearQueue = () => {
    if (activeStation) return; // Disable clear queue in radio mode
    if (roomId && isJoined && sendChatMessage) {
      sendChatMessage({ type: 'ROOM_CLEAR_PLAYLIST' });
    } else {
      setQueue([]);
    }
  };

  const isRoomActive = roomId && isJoined && roomData && !activeStation;
  const displaySong = isRoomActive ? roomData.currentSong : currentSong;
  const displayQueue = isRoomActive ? roomData.playlist.slice(roomData.playlistIndex + 1) : queue;

  return (
    <div className="w-full max-w-[1200px] h-[720px] bg-[#0c101b] border border-white/5 rounded-3xl overflow-hidden flex flex-row relative shadow-[0_32px_96px_rgba(0,0,0,0.8)]">
      
      {/* ── Corporate Sidebar Left ──────────────────────────────────────────── */}
      <aside className="w-60 bg-[#090c15] flex-shrink-0 flex flex-col h-full border-r border-white/5 p-5 justify-between z-20">
        <div className="flex flex-col gap-6">
          
          {/* Logo Header */}
          <div className="flex items-center gap-4 cursor-pointer" onClick={navigateToHome}>
            <img src={logoImg} alt="Corporate Mixtape Logo" className="w-16 h-16 rounded-2xl object-cover shadow-lg" />
            <div className="flex flex-col">
              <span className="font-organo text-[16px] uppercase tracking-[0.12em] text-white/95 leading-none">corporate</span>
              <span className="font-organo text-[16px] uppercase tracking-[0.12em] text-white/95 leading-none mt-1.5">mixtape</span>
            </div>
          </div>

          {/* Directory tabs */}
          <nav className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-white/30">
            <span className="px-3 mb-2">DIRECTORY</span>
            <button
              onClick={() => { setActiveTab('Discover'); setActiveStation(null); navigateToHome(); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold normal-case tracking-normal w-full text-left transition ${
                activeTab === 'Discover' && !roomId
                  ? 'text-white shadow-lg'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/5'
              }`}
              style={activeTab === 'Discover' && !roomId ? { backgroundColor: '#0081c9' } : {}}
            >
              <Home className="w-4 h-4" /> Discover
            </button>
            <button
              onClick={() => { setActiveTab('Channels'); navigateToHome(); }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold normal-case tracking-normal w-full text-left transition ${
                activeTab === 'Channels' && !roomId
                  ? 'text-white shadow-lg'
                  : 'text-white/40 hover:text-white/80 hover:bg-white/5'
              }`}
              style={activeTab === 'Channels' && !roomId ? { backgroundColor: '#0081c9' } : {}}
            >
              <Compass className="w-4 h-4" /> Company Channels
            </button>
          </nav>

          <div className="border-t border-white/5 my-2" />

          {/* Sync Playback Rooms */}
          <div className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-white/30">
            <span className="px-3 mb-2">BROADCASTS</span>
            <button
              onClick={handleCreateRoom}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold hover:text-[#ed7700] hover:bg-[#ed7700]/5 transition w-full text-left normal-case tracking-normal"
              style={{ color: '#ed7700' }}
            >
              <PlusCircle className="w-4 h-4" /> Start Broadcast
            </button>
            <button
              onClick={() => {
                const code = prompt('Enter Broadcast Room Code:');
                if (code?.trim()) {
                  const clean = code.trim().toUpperCase();
                  window.history.pushState({}, '', `/room/${clean}`);
                  window.dispatchEvent(new Event('popstate'));
                }
              }}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-purple-400 hover:text-purple-350 hover:bg-purple-500/5 transition w-full text-left normal-case tracking-normal"
            >
              <Users className="w-4 h-4" /> Join Broadcast
            </button>
          </div>

        </div>

        {/* User Card */}
        <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/5 border border-white/5">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-extrabold text-white" style={{ backgroundColor: '#0081c9' }}>
            {userName ? userName[0].toUpperCase() : 'U'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-white text-xs font-bold truncate leading-tight">{userName || 'Guest User'}</p>
            <p className="text-[10px] text-white/30 truncate mt-0.5">Online Partner</p>
          </div>
        </div>

      </aside>

      {/* ── Main Dashboard Workspace ────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col h-full bg-[#0a0d15] relative overflow-hidden z-10">
        
        {/* Top Header */}
        <header className="flex-shrink-0 flex items-center justify-between px-8 py-5 border-b border-white/5">
          <div>
            <h1 className="text-base font-bold text-white leading-tight">
              {roomId ? `Broadcast Room: ${roomId}` : activeTab === 'Discover' ? 'Explore Music' : 'Company Channels'}
            </h1>
            <p className="text-[10px] text-white/40 tracking-wider mt-1 uppercase font-semibold">
              {roomId ? 'Synchronized Live Playback Session' : 'Music for the Modern Workplace'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition">
              <MessageSquare className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#0081c9' }} />
            </button>
          </div>
        </header>

        {/* Content Workspace Area */}
        <div className="flex-1 flex overflow-hidden">
          
          <div className="flex-1 flex overflow-hidden">
            {/* Room View */}
            {roomId ? (
              !isJoined ? (
                <div className="flex-1 overflow-y-auto p-8 flex items-center justify-center">
                  <JoinRoom roomId={roomId} onJoin={handleJoinRoom} />
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-6 max-w-4xl mx-auto w-full">
                  <div className="flex items-center gap-3">
                    <button onClick={navigateToHome} className="p-2 bg-white/5 hover:bg-white/10 rounded-full transition">
                      <ChevronLeft className="w-4 h-4 text-white/60" />
                    </button>
                    <h2 className="text-lg font-bold text-white">Back to workspace</h2>
                  </div>

                  {roomData && (
                    <div className="rounded-2xl p-6 flex gap-6 items-center border border-white/5 bg-gradient-to-r from-[#0081c9]/10 to-transparent">
                      {roomData.currentSong?.thumbnails?.[0]?.url ? (
                        <img src={roomData.currentSong.thumbnails[roomData.currentSong.thumbnails.length - 1].url} alt="" className="w-20 h-20 rounded-xl object-cover" />
                      ) : (
                        <div className="w-20 h-20 rounded-xl bg-white/5 flex items-center justify-center text-3xl">🎵</div>
                      )}
                      <div>
                        <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#0081c9' }}>● ROOM ACTIVE BROADCAST</span>
                        <h3 className="text-lg font-extrabold text-white mt-1 truncate max-w-md">{roomData.currentSong?.title || 'No active song'}</h3>
                        <p className="text-white/40 text-xs mt-0.5">{roomData.currentSong?.artists?.map(a => a.name).join(', ')}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex-1 flex flex-col min-h-0 bg-[#0e121d] rounded-2xl p-5 border border-white/5">
                    <h4 className="text-xs font-bold text-white/40 uppercase tracking-widest mb-3">Add playlist music</h4>
                    <Search onPlay={handleSelectSong} onQueue={handleAddToQueue} />
                  </div>
                </div>
              )
            ) : activeTab === 'Discover' ? (
              <div className="flex-1 overflow-y-auto px-8 py-6 pb-28">
                <Search onPlay={handleSelectSong} onQueue={handleAddToQueue} />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto px-8 py-6 pb-28 flex flex-col gap-6">
                <div>
                  <h2 className="text-xs font-bold text-white uppercase tracking-widest">Company Radio Stations</h2>
                  <p className="text-[10px] text-white/40 mt-1">Tune in to continuous corporate-friendly streams. Custom controls are disabled.</p>
                </div>
                
                <div className="grid grid-cols-1 gap-4 max-w-2xl">
                  {RADIO_STATIONS.map((station) => {
                    const isTunedIn = activeStation?.id === station.id;
                    return (
                      <div 
                        key={station.id}
                        className={`p-4 rounded-2xl border transition flex flex-row gap-4 items-center ${
                          isTunedIn 
                            ? 'bg-[#0081c9]/10 border-[#0081c9]/25' 
                            : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.03]'
                        }`}
                      >
                        <img src={station.coverUrl} alt="" className="w-16 h-16 rounded-xl object-cover border border-white/5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] font-bold text-[#0081c9] uppercase tracking-wider">{station.genre}</span>
                          <h3 className="text-xs font-bold text-white truncate mt-0.5">{station.name}</h3>
                          <p className="text-white/40 text-[10px] mt-1 leading-snug line-clamp-2">{station.description}</p>
                          <button
                            onClick={() => {
                              if (isTunedIn) {
                                setActiveStation(null);
                                setCurrentSong(null);
                              } else {
                                setActiveStation(station);
                                setStationSongIndex(0);
                                setCurrentSong(station.playlist[0]);
                                setQueue([]);
                              }
                            }}
                            className={`mt-2.5 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
                              isTunedIn 
                                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' 
                                : 'bg-[#0081c9] text-white hover:bg-[#33a3ef]'
                            }`}
                          >
                            {isTunedIn ? 'Stop Listening' : 'Tune In'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Queue & Chatroom Sidebar panel */}
          <aside className="w-72 flex-shrink-0 border-l border-white/5 flex flex-col overflow-hidden pb-28">
            {/* Top Half: Play Queue */}
            <div className="flex-1 flex flex-col p-6 overflow-y-auto min-h-0 border-b border-white/5 gap-4">
              <div className="flex items-between justify-between">
                <div className="flex items-center gap-2">
                  <ListMusic className="w-4 h-4" style={{ color: '#0081c9' }} />
                  <span className="text-xs font-bold text-white tracking-tight">
                    {activeStation ? 'Radio Stream' : 'Play Queue'}
                  </span>
                </div>
                {displayQueue.length > 0 && !activeStation && (
                  <button onClick={handleClearQueue} className="text-[10px] text-red-400 hover:text-red-300 font-bold uppercase tracking-wider">Clear</button>
                )}
              </div>

              <div className="flex flex-col gap-2">
                {activeStation ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-white/30 border border-dashed border-[#0081c9]/20 rounded-2xl bg-[#0081c9]/[0.02] p-4 gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <p className="text-xs font-bold text-white mt-1">Live Radio Active</p>
                    <p className="text-[10px] leading-relaxed">Queue and custom playback changes are disabled on company channels.</p>
                  </div>
                ) : displayQueue.length > 0 ? (
                  displayQueue.map((song, idx) => (
                    <div key={song.videoId + '-' + idx} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5 border border-white/5">
                      <img src={song.thumbnails[0]?.url} alt="" className="w-8 h-8 rounded-lg object-cover flex-shrink-0 border border-white/5" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold text-white truncate leading-tight">{song.title}</p>
                        <p className="text-[9px] text-white/40 truncate mt-0.5">{song.artists?.map(a => a.name).join(', ')}</p>
                      </div>
                      <button onClick={() => handleRemoveFromQueue(idx)} className="text-white/20 hover:text-red-400 transition p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-white/20 border border-dashed border-white/5 rounded-2xl bg-white/[0.01]">
                    <Layout className="w-6 h-6 mb-2" />
                    <p className="text-xs font-semibold">Queue is empty</p>
                    <p className="text-[10px] mt-0.5">Click + next to search results to add tracks</p>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Half: Chatroom */}
            <div className="flex-1 flex flex-col p-6 overflow-hidden min-h-0">
              <Chatroom
                messages={chatMessages}
                onSendMessage={handleSendChatMessage}
                isJoined={isJoined && !!roomId}
                currentUserId={userId}
              />
            </div>
          </aside>

        </div>

      </main>

      {/* ── Corporate Bottom Music Player Controller ─────────────────────────── */}
      <Player
        currentSong={displaySong}
        onNextSong={handleNextSong}
        volume={volume}
        roomId={roomId}
        isJoined={isJoined && !!roomId}
        userId={userId}
        userName={userName}
        onRoomStateChange={room => setRoomData(room)}
        onSocketReady={sendFn => setSendChatMessage(() => sendFn)}
        onChatMessageReceived={handleChatMessageReceived}
        isRadio={!!activeStation}
      />
    </div>
  );
}

export default App;
