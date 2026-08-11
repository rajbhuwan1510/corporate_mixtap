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
        Get the streaming URL for a given video ID using Piped API (to bypass Render IP blocks),
        falling back to local yt-dlp extraction if Piped is unavailable.
        """
        # Try Piped API first (highly reliable on cloud hosting)
        piped_apis = [
            "https://pipedapi.kavin.rocks",
            "https://api.piped.yt",
            "https://pipedapi.us.to"
        ]
        
        import urllib.request
        import json
        
        for api_base in piped_apis:
            try:
                url = f"{api_base}/streams/{video_id}"
                req = urllib.request.Request(
                    url, 
                    headers={'User-Agent': 'Mozilla/5.0'}
                )
                with urllib.request.urlopen(req, timeout=5) as response:
                    data = json.loads(response.read().decode())
                    # Look for audio streams
                    audio_streams = data.get("audioStreams", [])
                    if audio_streams:
                        # Return the highest quality audio stream url
                        return audio_streams[0].get("url")
            except Exception as e:
                print(f"Failed to fetch stream from Piped API ({api_base}): {e}")
                continue

        # Fallback to local yt-dlp
        ydl_opts = {
            'format': 'bestaudio/best',
            'quiet': True,
            'no_warnings': True,
            'nocheckcertificate': True,
            'extractor_args': {
                'youtube': {
                    'player_client': ['android_music'],
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
            print(f"Fallback yt-dlp error: {e}")
            traceback.print_exc()
            return None

ytmusic_service = YTMusicService()
