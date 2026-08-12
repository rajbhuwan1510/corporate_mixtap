from ytmusicapi import YTMusic
from typing import Dict, Any, List


class YTMusicService:
    def __init__(self):
        self.ytmusic = YTMusic()

    def search(self, query: str, filter: str = None) -> List[Dict[str, Any]]:
        """
        Search YouTube Music for songs, albums, artists, etc.
        """
        return self.ytmusic.search(query, filter=filter)

    def get_song(self, video_id: str) -> Dict[str, Any]:
        """
        Get song metadata (title, artists, thumbnails, duration, etc.).
        Playback is handled client-side via the YouTube IFrame Player API.
        """
        return self.ytmusic.get_song(video_id)


ytmusic_service = YTMusicService()
