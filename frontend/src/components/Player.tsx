import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Users, Copy, Check, Shuffle, Heart, MoreHorizontal } from 'lucide-react';
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
  roomId?: string | null;
  isJoined?: boolean;
  userId?: string;
  userName?: string;
  onRoomStateChange?: (room: Room) => void;
}

export function Player({
  currentSong: propSong,
  roomId = null,
  isJoined = false,
  userId = '',
  userName = '',
  onRoomStateChange
}: PlayerProps) {
  const playerRef = useRef<any>(null);
  const playerReadyRef = useRef(false);
  const pendingSongRef = useRef<Song | null>(null);
  const pendingPlayRef = useRef(false);

  const [currentSong, setCurrentSong] = useState<Song | null>(propSong);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [roomData, setRoomData] = useState<Room | null>(null);
  const [socket, setSocket] = useState<RoomSocket | null>(null);
  const [copied, setCopied] = useState(false);
  const [showUsers, setShowUsers] = useState(false);

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
      setIsPlaying(false);
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
            e.target.setVolume(100);
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

    // If YT API is already loaded (e.g. hot reload), initialize immediately
    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      // Otherwise inject the script and wait for the callback
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

    // Progress ticker
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

  // ─── Sync propSong → currentSong (non-room mode) ─────────────────────────
  useEffect(() => {
    if (!roomId) setCurrentSong(propSong);
  }, [propSong, roomId]);

  // ─── Load video when currentSong changes ─────────────────────────────────
  useEffect(() => {
    if (!currentSong) return;
    console.log('[Player] currentSong changed:', currentSong.videoId);
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
        if (room.currentSong) setCurrentSong(room.currentSong);
        else setCurrentSong(null);
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

  // ─── Sync propSong to room ────────────────────────────────────────────────
  useEffect(() => {
    if (roomId && isJoined && socket && propSong && (!currentSong || propSong.videoId !== currentSong.videoId)) {
      socket.send({ type: 'ROOM_TRACK_CHANGED', song: propSong });
    }
  }, [propSong, roomId, isJoined, socket]);

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
    if (roomId && isJoined && socket) socket.send({ type: 'ROOM_NEXT' });
    else setIsPlaying(false);
  }, [roomId, isJoined, socket]);
  handleEndedRef.current = handleEnded;

  const handlePlayPause = () => {
    if (roomId && isJoined && socket) {
      socket.send({ type: isPlaying ? 'ROOM_PAUSE' : 'ROOM_PLAY' });
    } else {
      if (!isPlaying) {
        playerRef.current?.playVideo?.();
        setIsPlaying(true);
      } else {
        playerRef.current?.pauseVideo?.();
        setIsPlaying(false);
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (roomId && isJoined && socket) socket.send({ type: 'ROOM_SEEK', position: time });
    else { playerRef.current?.seekTo?.(time, true); setProgress(time); }
  };

  const handleNext = () => { if (roomId && isJoined && socket) socket.send({ type: 'ROOM_NEXT' }); };
  const handlePrev = () => { if (roomId && isJoined && socket) socket.send({ type: 'ROOM_PREVIOUS' }); };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    playerRef.current?.setVolume?.(val);
    if (val === 0) setIsMuted(true);
    else if (isMuted) { setIsMuted(false); playerRef.current?.unMute?.(); }
  };

  const toggleMute = () => {
    if (isMuted) { playerRef.current?.unMute?.(); setIsMuted(false); }
    else { playerRef.current?.mute?.(); setIsMuted(true); }
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

      {/* Musfluent-style player bar */}
      {currentSong && (
        <div
          className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-between px-6"
          style={{
            height: 80,
            background: 'rgba(10, 4, 30, 0.97)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            backdropFilter: 'blur(20px)',
          }}
        >
          {/* Left: Song Info */}
          <div className="flex items-center gap-3 w-72 min-w-0">
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-white/10 flex-shrink-0 shadow-lg">
              {currentSong.thumbnails?.[0]?.url && (
                <img src={currentSong.thumbnails[0].url} alt="Cover" className="w-full h-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white font-bold truncate text-sm leading-tight">{currentSong.title}</p>
              <p className="text-white/40 text-xs truncate mt-0.5">
                {currentSong.artists?.map((a: any) => a.name).join(', ')}
              </p>
            </div>
            <button className="text-white/30 hover:text-[#18FF6D] transition flex-shrink-0">
              <Heart className="w-4 h-4" />
            </button>
          </div>

          {/* Center: Controls + Progress */}
          <div className="flex flex-col items-center flex-1 max-w-xl gap-1.5 px-8">
            <div className="flex items-center gap-5">
              <button className="text-white/25 hover:text-white/70 transition">
                <Shuffle className="w-4 h-4" />
              </button>
              <button onClick={handlePrev} className="text-white/50 hover:text-white transition">
                <SkipBack className="w-5 h-5 fill-current" />
              </button>
              <button
                onClick={handlePlayPause}
                className="w-11 h-11 flex items-center justify-center rounded-full transition-all hover:scale-105 active:scale-95"
                style={{ background: '#18FF6D', boxShadow: '0 0 20px rgba(24,255,109,0.4)' }}
              >
                {isPlaying
                  ? <Pause className="w-5 h-5 text-black fill-black" />
                  : <Play className="w-5 h-5 text-black fill-black ml-0.5" />}
              </button>
              <button onClick={handleNext} className="text-white/50 hover:text-white transition">
                <SkipForward className="w-5 h-5 fill-current" />
              </button>
              <button className="text-white/25 hover:text-white/70 transition">
                <MoreHorizontal className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-3 w-full">
              <span className="text-white/30 text-[10px] font-medium w-8 text-right">{formatTime(progress)}</span>
              <input
                type="range" min={0} max={duration || 0} value={progress}
                onChange={handleSeek}
                className="flex-1"
                style={{ accentColor: '#18FF6D' }}
              />
              <span className="text-white/30 text-[10px] font-medium w-8">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: Volume & Room Controls */}
          <div className="flex items-center justify-end gap-3 w-72">
            {roomId && roomData && (
              <div className="relative flex items-center gap-2">
                <button
                  onClick={copyInviteLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition text-xs font-semibold"
                >
                  {copied
                    ? <><Check className="w-3.5 h-3.5 text-[#18FF6D]" /><span className="text-[#18FF6D]">Copied</span></>
                    : <><Copy className="w-3.5 h-3.5" /><span>Invite</span></>}
                </button>
                <button
                  onClick={() => setShowUsers(!showUsers)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition text-xs font-semibold"
                >
                  <Users className="w-3.5 h-3.5 text-[#18FF6D]" />
                  <span>{roomData.users.length}</span>
                </button>
                {showUsers && (
                  <div className="absolute right-0 bottom-16 w-56 rounded-2xl p-4 flex flex-col gap-3 z-50"
                    style={{ background: '#100830', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="text-[10px] font-bold text-white/30 tracking-widest uppercase">People in Room</div>
                    <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                      {roomData.users.map((user: any) => (
                        <div key={user.id} className="flex items-center justify-between">
                          <span className="text-white/60 text-xs truncate flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#18FF6D] inline-block" />
                            {user.name}
                          </span>
                          {roomData.hostId === user.id && (
                            <span className="text-[9px] bg-[#18FF6D]/20 text-[#18FF6D] px-1.5 py-0.5 rounded font-bold">HOST</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button onClick={toggleMute} className="text-zinc-400 hover:text-white transition">
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </button>
              <input
                type="range" min={0} max={100} step={1} value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 bg-[#1e1a30] rounded-full appearance-none cursor-pointer accent-emerald-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:rounded-full"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
