from ytmusicapi import YTMusic
from typing import Dict, Any, List
import yt_dlp

class YTMusicService:
    def __init__(self):
        self.ytmusic = YTMusic()

    def search(self, query: str, filter: str = None) -> List[Dict[str, Any]]:
        """
        Search YouTube Music.
        """
        return self.ytmusic.search(query, filter=filter)

    def get_song(self, video_id: str) -> Dict[str, Any]:
        """
        Get song details.
        """
        return self.ytmusic.get_song(video_id)

    def get_stream_url(self, video_id: str) -> str:
        """
        Get the streaming URL for a given video ID using yt-dlp to handle ciphers.
        """
        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'no_warnings': True,
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(f"https://www.youtube.com/watch?v={video_id}", download=False)
                return info.get('url')
        except Exception as e:
            import traceback
            print(f"Error getting stream URL: {e}")
            traceback.print_exc()
            return None

ytmusic_service = YTMusicService()
