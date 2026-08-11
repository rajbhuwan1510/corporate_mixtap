export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = {
  search: async (query: string) => {
    const res = await fetch(`${API_URL}/api/search/songs?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Search failed');
    return res.json();
  },
  
  getStreamUrl: async (videoId: string) => {
    const res = await fetch(`${API_URL}/api/stream/${videoId}`);
    if (!res.ok) throw new Error('Stream URL not found');
    return res.json();
  },

  createRoom: async (creatorId: string, creatorName: string, currentSong: any, position: number, isPlaying: boolean) => {
    const res = await fetch(`${API_URL}/api/rooms/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creatorId,
        creatorName,
        currentSong,
        position,
        isPlaying,
      }),
    });
    if (!res.ok) throw new Error('Create room failed');
    return res.json();
  },

  getRoomDetails: async (roomId: string) => {
    const res = await fetch(`${API_URL}/api/rooms/${roomId}`);
    if (!res.ok) throw new Error('Get room failed');
    return res.json();
  }
};
