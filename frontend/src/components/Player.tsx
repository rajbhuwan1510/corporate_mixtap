import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Users, Shuffle, Heart, Repeat } from 'lucide-react';
import { RoomSocket } from '../services/socket';
import type { SocketMessage } from '../services/socket';
import type { Song, Room } from '../types';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface PlayerProps {
  currentSong: Song | null;
  onNextSong?: () => void;
  volume?: number;
  roomId?: string | null;
  isJoined?: boolean;
  userId?: string;
  userName?: string;
  onRoomStateChange?: (room: Room) => void;
  onSocketReady?: (sendFn: ((data: any) => void) | null) => void;
  onChatMessageReceived?: (chat: { userId: string; userName: string; text: string; timestamp: number }) => void;
  isRadio?: boolean;
}

export function Player({
  currentSong,
  onNextSong,
  volume = 80,
  roomId = null,
  isJoined = false,
  userId = '',
  userName = '',
  onRoomStateChange,
  onSocketReady,
  onChatMessageReceived,
  isRadio = false
}: PlayerProps) {
  const playerRef = useRef<any>(null);
  const playerReadyRef = useRef(false);
  const pendingSongRef = useRef<Song | null>(null);
  const pendingPlayRef = useRef(false);
  const lastVideoIdRef = useRef<string | null>(null);
  const onSocketReadyRef = useRef(onSocketReady);
  useEffect(() => {
    onSocketReadyRef.current = onSocketReady;
  });

  // currentSong is now consumed directly from props
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  // Room presence UI state
  const [roomData, setRoomData] = useState<Room | null>(null);
  const [socket, setSocket] = useState<RoomSocket | null>(null);
  const [copied, setCopied] = useState(false);
  const [showUsers, setShowUsers] = useState(false);

  // Sync offsets
  const serverOffsetRef = useRef<number>(0);
  const driftCheckIntervalRef = useRef<any>(null);
  const progressIntervalRef = useRef<any>(null);
  const lastStateVersionRef = useRef<number>(-1);
  const handleEndedRef = useRef<(() => void) | undefined>(undefined);

  // ─── Load video into YT.Player ───────────────────────────────────────────
  const loadVideo = useCallback((song: Song, autoplay = true) => {
    console.log('[Player] loadVideo called:', song.videoId, 'ready:', playerReadyRef.current);
    if (!playerReadyRef.current || !playerRef.current) {
      console.log('[Player] Player not ready — queuing song');
      pendingSongRef.current = song;
      pendingPlayRef.current = autoplay;
      return;
    }
    try {
      setProgress(0);
      setDuration(0);
      setIsPlaying(autoplay);
      if (autoplay) {
        playerRef.current.loadVideoById(song.videoId);
      } else {
        playerRef.current.cueVideoById(song.videoId);
      }
      console.log('[Player] loadVideoById called for:', song.videoId);
    } catch (e) {
      console.error('[Player] loadVideoById error:', e);
    }
  }, []);

  // ─── Initialize YouTube IFrame Player (once, on mount) ───────────────────
  useEffect(() => {
    const initPlayer = () => {
      if (playerRef.current) return;
      console.log('[Player] Creating YT.Player instance');
      playerRef.current = new window.YT.Player('yt-player-container', {
        height: '1',
        width: '1',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (e: any) => {
            console.log('[Player] YT.Player ready');
            playerReadyRef.current = true;
            e.target.setVolume(volume);
            // Flush any queued song
            if (pendingSongRef.current) {
              const song = pendingSongRef.current;
              const play = pendingPlayRef.current;
              pendingSongRef.current = null;
              pendingPlayRef.current = false;
              loadVideo(song, play);
            }
          },
          onStateChange: (event: any) => {
            const YT = window.YT;
            console.log('[Player] State change:', event.data);
            if (event.data === YT.PlayerState.ENDED) {
              handleEndedRef.current?.();
            } else if (event.data === YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              const d = playerRef.current?.getDuration?.();
              if (d && !isNaN(d)) setDuration(d);
            } else if (event.data === YT.PlayerState.PAUSED) {
              setIsPlaying(false);
            }
          },
          onError: (event: any) => {
            console.error('[Player] YT.Player error code:', event.data);
          }
        },
      });
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      window.onYouTubeIframeAPIReady = () => {
        console.log('[Player] onYouTubeIframeAPIReady fired');
        initPlayer();
      };
      if (!document.getElementById('yt-iframe-api')) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.body.appendChild(tag);
        console.log('[Player] YouTube IFrame API script injected');
      }
    }

    progressIntervalRef.current = setInterval(() => {
      if (playerRef.current && playerReadyRef.current) {
        try {
          const t = playerRef.current.getCurrentTime?.();
          const d = playerRef.current.getDuration?.();
          if (t != null && !isNaN(t)) setProgress(t);
          if (d != null && !isNaN(d) && d > 0) setDuration(d);
        } catch (_) {}
      }
    }, 500);

    return () => clearInterval(progressIntervalRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync volume changes from parent
  useEffect(() => {
    if (playerReadyRef.current && playerRef.current) {
      playerRef.current.setVolume(volume);
    }
  }, [volume]);

  // propSong sync replaced by direct prop usage

  // ─── Load video when videoId changes ─────────────────────────────────
  useEffect(() => {
    if (!currentSong) {
      lastVideoIdRef.current = null;
      return;
    }
    if (currentSong.videoId === lastVideoIdRef.current) {
      return; // Do NOT reload/restart the song if it hasn't changed!
    }
    console.log('[Player] currentSong changed:', currentSong.videoId);
    lastVideoIdRef.current = currentSong.videoId;
    loadVideo(currentSong, true);
  }, [currentSong, loadVideo]);

  // ─── Room socket ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !isJoined || !userId || !userName) {
      if (socket) { socket.close(); setSocket(null); }
      setRoomData(null);
      return;
    }
    const roomSocket = new RoomSocket(roomId, userId, userName);
    setSocket(roomSocket);
    const unsubscribe = roomSocket.subscribe((msg: SocketMessage) => {
      if (msg.type === 'ROOM_CHAT') {
        onChatMessageReceived?.({
          userId: msg.userId,
          userName: msg.userName,
          text: msg.text,
          timestamp: msg.timestamp
        });
        return;
      }
      if (
        msg.type === 'ROOM_STATE' ||
        msg.type === 'ROOM_SYNC_RESPONSE' ||
        msg.type === 'ROOM_USER_JOINED' ||
        msg.type === 'ROOM_USER_LEFT'
      ) {
        const room: Room = msg.room || msg.roomState;
        if (!room) return;
        setRoomData(room);
        onRoomStateChange?.(room);
        if (msg.serverTime) serverOffsetRef.current = msg.serverTime - Date.now();
        // room.currentSong is synchronized via App.tsx props mapping
        setIsPlaying(room.playback.isPlaying);
        if (room.playback.isPlaying) playerRef.current?.playVideo?.();
        else playerRef.current?.pauseVideo?.();
        if (room.version > lastStateVersionRef.current) {
          lastStateVersionRef.current = room.version;
          let targetPos = room.playback.position;
          if (room.playback.isPlaying && room.playback.startedAt) {
            const now = (Date.now() + serverOffsetRef.current) / 1000;
            targetPos += now - room.playback.startedAt;
          }
          if (playerReadyRef.current) {
            try {
              const cur = playerRef.current?.getCurrentTime?.() || 0;
              if (Math.abs(cur - targetPos) > 0.5) playerRef.current?.seekTo?.(targetPos, true);
            } catch (_) {}
          }
        }
      }
    });
    return () => { unsubscribe(); roomSocket.close(); setSocket(null); setRoomData(null); };
  }, [roomId, isJoined, userId, userName]);

  // Expose socket sending function to the parent component
  useEffect(() => {
    if (socket) {
      onSocketReadyRef.current?.((data: any) => socket.send(data));
    } else {
      onSocketReadyRef.current?.(null);
    }
  }, [socket]);



  // ─── Play/Pause (non-room) ────────────────────────────────────────────────
  useEffect(() => {
    if (roomId || !playerReadyRef.current) return;
    if (isPlaying) playerRef.current?.playVideo?.();
    else playerRef.current?.pauseVideo?.();
  }, [isPlaying, roomId]);

  // ─── Drift Correction (room) ──────────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !isJoined || !isPlaying) {
      if (driftCheckIntervalRef.current) { clearInterval(driftCheckIntervalRef.current); driftCheckIntervalRef.current = null; }
      return;
    }
    driftCheckIntervalRef.current = setInterval(() => {
      if (!playerReadyRef.current || !roomData?.playback?.isPlaying || !roomData?.playback?.startedAt) return;
      const now = (Date.now() + serverOffsetRef.current) / 1000;
      const expected = roomData.playback.position + (now - roomData.playback.startedAt);
      try {
        const actual = playerRef.current?.getCurrentTime?.() || 0;
        if (Math.abs(expected - actual) > 0.5) playerRef.current?.seekTo?.(expected, true);
      } catch (_) {}
    }, 2000);
    return () => { if (driftCheckIntervalRef.current) clearInterval(driftCheckIntervalRef.current); };
  }, [roomId, isJoined, isPlaying, roomData]);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const handleEnded = useCallback(() => {
    if (roomId && isJoined && socket) {
      socket.send({ type: 'ROOM_NEXT' });
    } else if (onNextSong) {
      onNextSong();
    } else {
      setIsPlaying(false);
    }
  }, [roomId, isJoined, socket, onNextSong]);
  handleEndedRef.current = handleEnded;

  const handlePlayPause = () => {
    if (roomId && isJoined && socket) {
      socket.send({ type: isPlaying ? 'ROOM_PAUSE' : 'ROOM_PLAY' });
    } else {
      setIsPlaying(p => !p);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (roomId && isJoined && socket) socket.send({ type: 'ROOM_SEEK', position: time });
    else { playerRef.current?.seekTo?.(time, true); setProgress(time); }
  };

  const handleNext = () => {
    if (roomId && isJoined && socket) socket.send({ type: 'ROOM_NEXT' });
    else if (onNextSong) onNextSong();
  };

  const handlePrev = () => {
    if (roomId && isJoined && socket) socket.send({ type: 'ROOM_PREVIOUS' });
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return '0:00';
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {/* Hidden YouTube IFrame — always mounted from page load */}
      <div style={{ position: 'fixed', width: 1, height: 1, overflow: 'hidden', top: -10, left: -10, zIndex: -1, pointerEvents: 'none' }}>
        <div id="yt-player-container" />
      </div>

      {/* Sleek Premium Corporate Player Bar */}
      {currentSong && (
        <div className={`absolute bottom-0 left-0 right-0 h-20 bg-[#090c15] border-t border-white/5 px-6 flex items-center justify-between z-30 shadow-[0_-8px_32px_rgba(0,0,0,0.5)] ${isPlaying ? 'playing-active' : ''}`}>
          {/* Left: Song Info */}
          <div className="flex items-center gap-3 w-72 min-w-0">
            <div className="w-10 h-10 rounded-xl overflow-hidden bg-white/10 flex-shrink-0 shadow border border-white/5">
              {currentSong.thumbnails?.[0]?.url && (
                <img src={currentSong.thumbnails[currentSong.thumbnails.length - 1].url} alt="" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white font-bold truncate text-xs leading-snug">{currentSong.title}</p>
              <p className="text-white/40 text-[10px] truncate leading-none mt-0.5">
                {currentSong.artists?.map((a: any) => a.name).join(', ')}
              </p>
            </div>
            <button className="text-white/20 hover:text-[var(--theme-accent)] transition flex-shrink-0">
              <Heart className="w-4 h-4" />
            </button>
          </div>

          {/* Center: Playback Controls & Clean Progress Bar */}
          <div className="flex flex-col items-center flex-1 max-w-lg gap-1 px-4">
            <div className="flex items-center gap-4">
              {isRadio && (
                <span className="text-[9px] px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-black tracking-widest uppercase animate-pulse mr-1">LIVE RADIO</span>
              )}
              <button className={`transition ${isRadio ? 'opacity-10 cursor-not-allowed pointer-events-none' : 'text-white/20 hover:text-white/70'}`}>
                <Shuffle className="w-3.5 h-3.5" />
              </button>
              <button onClick={handlePrev} className={`transition ${isRadio ? 'opacity-10 cursor-not-allowed pointer-events-none' : 'text-white/50 hover:text-white'}`}>
                <SkipBack className="w-4 h-4 fill-current" />
              </button>
              <button
                onClick={handlePlayPause}
                className="w-10 h-10 flex items-center justify-center rounded-full transition-all hover:scale-105 active:scale-95 text-white shadow-lg"
                style={{ backgroundColor: 'var(--theme-accent)', boxShadow: '0 4px 12px var(--theme-accent-glow)' }}
              >
                {isPlaying ? <Pause className="w-4.5 h-4.5 text-white fill-white" /> : <Play className="w-4.5 h-4.5 text-white fill-white ml-0.5" />}
              </button>
              <button onClick={handleNext} className={`transition ${isRadio ? 'opacity-10 cursor-not-allowed pointer-events-none' : 'text-white/50 hover:text-white'}`}>
                <SkipForward className="w-4 h-4 fill-current" />
              </button>
              <button className={`transition ${isRadio ? 'opacity-10 cursor-not-allowed pointer-events-none' : 'text-white/20 hover:text-white/70'}`}>
                <Repeat className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="flex items-center gap-3 w-full mt-0.5">
              <span className="text-white text-[10px] font-bold w-8 text-right">{formatTime(progress)}</span>
              <input
                type="range" min={0} max={duration || 0} value={progress}
                onChange={handleSeek}
                className="flex-1"
                style={{ accentColor: 'var(--theme-accent)' }}
                disabled={isRadio}
              />
              <span className="text-white text-[10px] font-bold w-8">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: Invite & Room status controls */}
          <div className="flex items-center justify-end gap-3 w-72">
            {roomId && roomData && (
              <div className="relative flex items-center gap-2">
                <button
                  onClick={copyInviteLink}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition text-[10px] font-bold uppercase tracking-wider"
                >
                  {copied ? <span className="text-[var(--theme-accent)]">Copied</span> : <span>Invite</span>}
                </button>
                <button
                  onClick={() => setShowUsers(!showUsers)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition text-[10px] font-bold uppercase tracking-wider"
                >
                  <Users className="w-3.5 h-3.5 mr-1" style={{ color: 'var(--theme-accent)' }} />
                  <span>{roomData.users.length}</span>
                </button>
                {showUsers && (
                  <div className="absolute right-0 bottom-14 w-52 rounded-xl p-3.5 z-50 bg-[#090c15] border border-white/5 shadow-2xl">
                    <div className="text-[9px] font-bold text-white/25 tracking-widest uppercase mb-2">People listening</div>
                    <div className="flex flex-col gap-1.5 max-h-36 overflow-y-auto">
                      {roomData.users.map((user: any) => (
                        <div key={user.id} className="flex items-center justify-between text-[11px] font-medium">
                          <span className="text-white/60 truncate flex items-center gap-2">
                            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--theme-accent)' }} />
                            {user.name}
                          </span>
                          {roomData.hostId === user.id && (
                            <span className="text-[8px] px-1 py-0.5 rounded font-black text-white" style={{ backgroundColor: 'var(--theme-accent-glow)' }}>HOST</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
