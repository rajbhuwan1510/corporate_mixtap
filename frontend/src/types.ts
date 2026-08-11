export interface Song {
  videoId: string;
  title: string;
  artists: { name: string; id: string }[];
  album: { name: string; id: string } | null;
  thumbnails: { url: string; width: number; height: number }[];
  duration?: string;
}

export interface User {
  id: string;
  name: string;
  joinedAt: number;
  lastSeen: number;
}

export interface Room {
  id: string;
  createdAt: number;
  hostId: string;
  users: User[];
  currentTrackId: string | null;
  currentSong: Song | null;
  playlistIndex: number;
  playlist: Song[];
  playback: {
    isPlaying: boolean;
    position: number;
    startedAt: number | null;
  };
  version: number;
}
