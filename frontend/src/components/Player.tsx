import { useState, useEffect, useRef } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Users, Copy, Check } from 'lucide-react';
import { API_URL } from '../services/api';
import { RoomSocket } from '../services/socket';
import type { SocketMessage } from '../services/socket';
import type { Song, Room } from '../types';

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
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Player state
  const [currentSong, setCurrentSong] = useState<Song | null>(propSong);
  const [isPlaying, setIsPlaying] = useState(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Room presence UI state
  const [roomData, setRoomData] = useState<Room | null>(null);
  const [socket, setSocket] = useState<RoomSocket | null>(null);
  const [copied, setCopied] = useState(false);
  const [showUsers, setShowUsers] = useState(false);

  // Sync offsets
  const serverOffsetRef = useRef<number>(0);
  const driftCheckIntervalRef = useRef<any>(null);
  const lastStateVersionRef = useRef<number>(-1);

  // Reset current song when prop changes (for global mode)
  useEffect(() => {
    if (!roomId) {
      setCurrentSong(propSong);
    }
  }, [propSong, roomId]);

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

        // Calculate server offset: serverTime - localTime
        if (msg.serverTime) {
          serverOffsetRef.current = msg.serverTime - Date.now();
        }

        // Apply track updates
        if (room.currentSong) {
          setCurrentSong(room.currentSong);
        } else {
          setCurrentSong(null);
        }

        // Apply playback updates
        setIsPlaying(room.playback.isPlaying);

        // Apply seek / position sync
        if (room.version > lastStateVersionRef.current) {
          lastStateVersionRef.current = room.version;
          
          let targetPos = room.playback.position;
          if (room.playback.isPlaying && room.playback.startedAt) {
            // startedAt is in seconds, serverTime is in ms, offset is in ms
            const currentServerTime = (Date.now() + serverOffsetRef.current) / 1000;
            const elapsed = currentServerTime - room.playback.startedAt;
            targetPos += elapsed;
          }

          if (audioRef.current) {
            const diff = Math.abs(audioRef.current.currentTime - targetPos);
            if (diff > 0.5) { // seek directly if difference is > 500ms
              audioRef.current.currentTime = targetPos;
            }
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

  useEffect(() => {
    if (!currentSong) {
      setStreamUrl(null);
      return;
    }
    setStreamUrl(`${API_URL}/api/stream/play/${currentSong.videoId}`);
  }, [currentSong]);

  // Play/Pause effect
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying && streamUrl) {
        audioRef.current.play().catch(e => console.error('Audio play error:', e));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, streamUrl]);

  // Drift Correction Protocol (Runs every 2s)
  useEffect(() => {
    if (!roomId || !isJoined || !isPlaying) {
      if (driftCheckIntervalRef.current) {
        clearInterval(driftCheckIntervalRef.current);
        driftCheckIntervalRef.current = null;
      }
      return;
    }

    driftCheckIntervalRef.current = setInterval(() => {
      if (!audioRef.current || !roomData || !roomData.playback.isPlaying || !roomData.playback.startedAt) return;

      const currentServerTime = (Date.now() + serverOffsetRef.current) / 1000;
      const expectedPosition = roomData.playback.position + (currentServerTime - roomData.playback.startedAt);
      const actualPosition = audioRef.current.currentTime;
      const diff = Math.abs(expectedPosition - actualPosition);

      // Drift correction thresholding:
      // < 100ms: do nothing
      // 100ms - 500ms: gentle correction (adjust playbackRate slightly)
      // > 500ms: hard seek
      if (diff >= 0.1 && diff <= 0.5) {
        if (actualPosition < expectedPosition) {
          audioRef.current.playbackRate = 1.05; // speed up slightly
        } else {
          audioRef.current.playbackRate = 0.95; // slow down slightly
        }
      } else if (diff > 0.5) {
        audioRef.current.playbackRate = 1.0;
        audioRef.current.currentTime = expectedPosition;
      } else {
        audioRef.current.playbackRate = 1.0; // normal speed
      }
    }, 2000);

    return () => {
      if (driftCheckIntervalRef.current) {
        clearInterval(driftCheckIntervalRef.current);
      }
    };
  }, [roomId, isJoined, isPlaying, roomData]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setProgress(audioRef.current.currentTime);
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    if (roomId && isJoined && socket) {
      // In room mode, when track ends, tell server to advance track.
      // To prevent multiple clients from advancing, the backend handle_next or next_track already increments playlist index.
      // We can emit next track request, backend will check if version increases and ignores duplicate next calls
      socket.send({ type: 'ROOM_NEXT' });
    } else {
      setIsPlaying(false);
    }
  };

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
      socket.send({
        type: 'ROOM_SEEK',
        position: time
      });
    } else {
      if (audioRef.current) {
        audioRef.current.currentTime = time;
        setProgress(time);
      }
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
    if (audioRef.current) {
      audioRef.current.volume = val;
    }
    if (val === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      audioRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
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
      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        src={streamUrl || undefined}
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        autoPlay={true}
      />

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
            max={1}
            step={0.01}
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="w-20 h-1 bg-[#1e1a30] rounded-full appearance-none cursor-pointer accent-emerald-500 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:rounded-full"
          />
        </div>
      </div>
    </div>
  );
}

