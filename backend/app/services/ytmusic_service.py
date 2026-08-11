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
            'nocheckcertificate': True,
            'extractor_args': {
                'youtube': {
                    'player_client': ['ios', 'tv'],
                }
            },
            'http_headers': {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'Sec-Ch-Ua-Mobile': '?0',
                'Sec-Ch-Ua-Platform': '"Windows"',
            }
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
