import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Users, Copy, Check } from 'lucide-react';
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

let ytApiLoaded = false;
let ytApiResolvers: Array<() => void> = [];

function loadYouTubeAPI(): Promise<void> {
  return new Promise((resolve) => {
    if (ytApiLoaded) { resolve(); return; }
    ytApiResolvers.push(resolve);
    if (!document.getElementById('yt-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }
    window.onYouTubeIframeAPIReady = () => {
      ytApiLoaded = true;
      ytApiResolvers.forEach(r => r());
      ytApiResolvers = [];
    };
  });
}

export function Player({
  currentSong: propSong,
  roomId = null,
  isJoined = false,
  userId = '',
  userName = '',
  onRoomStateChange
}: PlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const playerReadyRef = useRef(false);

  // Player state
  const [currentSong, setCurrentSong] = useState<Song | null>(propSong);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);

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

  // Initialize YouTube IFrame Player once
  useEffect(() => {
    const containerId = 'yt-player-container';
    loadYouTubeAPI().then(() => {
      if (playerRef.current) return;
      playerRef.current = new window.YT.Player(containerId, {
        height: '0',
        width: '0',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            playerReadyRef.current = true;
            playerRef.current.setVolume(volume);
          },
          onStateChange: (event: any) => {
            const YT = window.YT;
            if (event.data === YT.PlayerState.ENDED) {
              handleEnded();
            } else if (event.data === YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              setDuration(playerRef.current?.getDuration?.() || 0);
            } else if (event.data === YT.PlayerState.PAUSED) {
              setIsPlaying(false);
            }
          },
        },
      });
    });
    // Progress ticker
    progressIntervalRef.current = setInterval(() => {
      if (playerRef.current && playerReadyRef.current) {
        try {
          const t = playerRef.current.getCurrentTime?.();
          const d = playerRef.current.getDuration?.();
          if (t != null) setProgress(t);
          if (d != null && d > 0) setDuration(d);
        } catch (_) {}
      }
    }, 500);

    return () => {
      clearInterval(progressIntervalRef.current);
    };
  }, []);

  // Reset current song when prop changes (for global mode)
  useEffect(() => {
    if (!roomId) {
      setCurrentSong(propSong);
    }
  }, [propSong, roomId]);

  // Load new video when currentSong changes
  useEffect(() => {
    if (!currentSong || !playerReadyRef.current) return;
    try {
      playerRef.current?.loadVideoById({
        videoId: currentSong.videoId,
        startSeconds: 0,
      });
      setProgress(0);
    } catch (e) {
      console.error('Failed to load video:', e);
    }
  }, [currentSong]);

  // Connect to room socket
  useEffect(() => {
    if (!roomId || !isJoined || !userId || !userName) {
      if (socket) {
        socket.close();
        setSocket(null);
      }
      setRoomData(null);
      return;
    }

    const roomSocket = new RoomSocket(roomId, userId, userName);
    setSocket(roomSocket);

    const unsubscribe = roomSocket.subscribe((msg: SocketMessage) => {
      console.log('WS Message received:', msg);
      if (msg.type === 'ROOM_STATE' || msg.type === 'ROOM_SYNC_RESPONSE' || msg.type === 'ROOM_USER_JOINED' || msg.type === 'ROOM_USER_LEFT') {
        const room: Room = msg.room || msg.roomState;
        if (!room) return;

        setRoomData(room);
        onRoomStateChange?.(room);

        if (msg.serverTime) {
          serverOffsetRef.current = msg.serverTime - Date.now();
        }

        if (room.currentSong) {
          setCurrentSong(room.currentSong);
        } else {
          setCurrentSong(null);
        }

        setIsPlaying(room.playback.isPlaying);
        if (room.playback.isPlaying && playerReadyRef.current) {
          playerRef.current?.playVideo?.();
        } else if (!room.playback.isPlaying && playerReadyRef.current) {
          playerRef.current?.pauseVideo?.();
        }

        if (room.version > lastStateVersionRef.current) {
          lastStateVersionRef.current = room.version;

          let targetPos = room.playback.position;
          if (room.playback.isPlaying && room.playback.startedAt) {
            const currentServerTime = (Date.now() + serverOffsetRef.current) / 1000;
            const elapsed = currentServerTime - room.playback.startedAt;
            targetPos += elapsed;
          }

          if (playerReadyRef.current) {
            try {
              const current = playerRef.current?.getCurrentTime?.() || 0;
              if (Math.abs(current - targetPos) > 0.5) {
                playerRef.current?.seekTo?.(targetPos, true);
              }
            } catch (_) {}
          }
        }
      }
    });

    return () => {
      unsubscribe();
      roomSocket.close();
      setSocket(null);
      setRoomData(null);
    };
  }, [roomId, isJoined, userId, userName]);

  // Sync propSong changes inside room to server
  useEffect(() => {
    if (roomId && isJoined && socket && propSong && (!currentSong || propSong.videoId !== currentSong.videoId)) {
      socket.send({
        type: 'ROOM_TRACK_CHANGED',
        song: propSong
      });
    }
  }, [propSong, roomId, isJoined, socket]);

  // Play/Pause based on isPlaying state (non-room mode)
  useEffect(() => {
    if (roomId) return; // rooms control playback directly via socket events
    if (!playerReadyRef.current) return;
    if (isPlaying) {
      playerRef.current?.playVideo?.();
    } else {
      playerRef.current?.pauseVideo?.();
    }
  }, [isPlaying, roomId]);

  // Drift Correction Protocol (Runs every 2s in room mode)
  useEffect(() => {
    if (!roomId || !isJoined || !isPlaying) {
      if (driftCheckIntervalRef.current) {
        clearInterval(driftCheckIntervalRef.current);
        driftCheckIntervalRef.current = null;
      }
      return;
    }

    driftCheckIntervalRef.current = setInterval(() => {
      if (!playerReadyRef.current || !roomData?.playback?.isPlaying || !roomData?.playback?.startedAt) return;

      const currentServerTime = (Date.now() + serverOffsetRef.current) / 1000;
      const expectedPosition = roomData.playback.position + (currentServerTime - roomData.playback.startedAt);
      try {
        const actualPosition = playerRef.current?.getCurrentTime?.() || 0;
        const diff = Math.abs(expectedPosition - actualPosition);
        if (diff > 0.5) {
          playerRef.current?.seekTo?.(expectedPosition, true);
        }
      } catch (_) {}
    }, 2000);

    return () => {
      if (driftCheckIntervalRef.current) {
        clearInterval(driftCheckIntervalRef.current);
      }
    };
  }, [roomId, isJoined, isPlaying, roomData]);

  const handleEnded = useCallback(() => {
    if (roomId && isJoined && socket) {
      socket.send({ type: 'ROOM_NEXT' });
    } else {
      setIsPlaying(false);
    }
  }, [roomId, isJoined, socket]);

  const handlePlayPause = () => {
    if (roomId && isJoined && socket) {
      if (isPlaying) {
        socket.send({ type: 'ROOM_PAUSE' });
      } else {
        socket.send({ type: 'ROOM_PLAY' });
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = Number(e.target.value);
    if (roomId && isJoined && socket) {
      socket.send({ type: 'ROOM_SEEK', position: time });
    } else {
      playerRef.current?.seekTo?.(time, true);
      setProgress(time);
    }
  };

  const handleNext = () => {
    if (roomId && isJoined && socket) {
      socket.send({ type: 'ROOM_NEXT' });
    }
  };

  const handlePrev = () => {
    if (roomId && isJoined && socket) {
      socket.send({ type: 'ROOM_PREVIOUS' });
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    playerRef.current?.setVolume?.(val);
    if (val === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
      playerRef.current?.unMute?.();
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      playerRef.current?.unMute?.();
      setIsMuted(false);
    } else {
      playerRef.current?.mute?.();
      setIsMuted(true);
    }
  };

  const copyInviteLink = () => {
    const url = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!currentSong) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 bg-[#0a0810]/95 border-t border-[#1d1930] px-8 flex items-center justify-between z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
      {/* Hidden YouTube IFrame Player */}
      <div ref={containerRef} style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <div id="yt-player-container" />
      </div>

      {/* Left: Song Info */}
      <div className="flex items-center gap-4 w-1/3 min-w-0">
        <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#161224] border border-[#2d264a] flex-shrink-0 shadow-md">
          {currentSong.thumbnails?.[0]?.url && (
            <img src={currentSong.thumbnails[0].url} alt="Cover" className="w-full h-full object-cover" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold truncate text-sm">{currentSong.title}</p>
          <p className="text-zinc-400 text-xs truncate font-medium">
            {currentSong.artists?.map(a => a.name).join(', ')}
          </p>
        </div>
      </div>

      {/* Center: Controls */}
      <div className="flex flex-col items-center w-1/3 max-w-lg gap-2">
        <div className="flex items-center gap-6">
          <button onClick={handlePrev} className="text-zinc-400 hover:text-white transition">
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          <button
            className="w-10 h-10 flex items-center justify-center bg-emerald-500 rounded-full text-zinc-950 hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)]"
            onClick={handlePlayPause}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 text-zinc-950 fill-zinc-950" />
            ) : (
              <Play className="w-5 h-5 text-zinc-950 fill-zinc-950 ml-0.5" />
            )}
          </button>

          <button onClick={handleNext} className="text-zinc-400 hover:text-white transition">
            <SkipForward className="w-5 h-5 fill-current" />
          </button>
        </div>

        <div className="flex items-center gap-2 w-full text-[10px] font-bold text-zinc-500">
          <span className="w-10 text-right">{formatTime(progress)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={progress}
            onChange={handleSeek}
            className="flex-1 h-1 bg-[#1e1a30] rounded-full appearance-none cursor-pointer accent-emerald-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
          />
          <span className="w-10">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right: Volume & Room Controls */}
      <div className="flex items-center justify-end w-1/3 gap-4">
        {roomId && roomData && (
          <div className="relative flex items-center gap-2">
            {/* Invite Button */}
            <button
              onClick={copyInviteLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b172e] border border-[#2b244d] text-zinc-300 hover:bg-[#25203f] hover:text-white transition text-xs font-bold"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Link copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>COPY INVITE LINK</span>
                </>
              )}
            </button>

            {/* Listeners Info */}
            <button
              onClick={() => setShowUsers(!showUsers)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#1b172e] border border-[#2b244d] text-zinc-300 hover:bg-[#25203f] hover:text-white transition text-xs font-bold"
            >
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>{roomData.users.length} listening</span>
            </button>

            {/* Listener list Popup */}
            {showUsers && (
              <div className="absolute right-0 bottom-14 w-64 bg-[#0e0c15] border border-[#231e3d] rounded-2xl shadow-2xl p-4 flex flex-col gap-3 z-50">
                <div className="text-[10px] font-bold text-zinc-500 tracking-wider uppercase">PEOPLE IN ROOM</div>
                <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                  {roomData.users.map((user) => (
                    <div key={user.id} className="flex items-center justify-between text-sm">
                      <span className="text-zinc-200 truncate flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                        {user.name}
                      </span>
                      {roomData.hostId === user.id && (
                        <span className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 rounded-md font-bold tracking-wider">
                          HOST
                        </span>
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
            {isMuted || volume === 0 ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </button>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 h-1 bg-[#1e1a30] rounded-full appearance-none cursor-pointer accent-emerald-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
      </div>
    </div>
  );
}
