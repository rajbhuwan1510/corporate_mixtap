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
        Get the streaming URL for a given video ID using YTMusic's metadata and custom base.js deciphering.
        """
        import urllib.request
        import urllib.parse
        import re

        try:
            # 1. Fetch metadata using native YTMusic
            song_info = self.get_song(video_id)
            streaming_data = song_info.get("streamingData", {})
            adaptive_formats = streaming_data.get("adaptiveFormats", [])
            
            # Select the optimal audio format (prefer audio/mp4 / m4a or high quality webm)
            audio_formats = [f for f in adaptive_formats if f.get("mimeType", "").startswith("audio/")]
            if not audio_formats:
                return None
            
            # Prefer audio/mp4 for clean compatibility
            selected_format = next((f for f in audio_formats if "audio/mp4" in f.get("mimeType", "")), audio_formats[0])
            
            # 2. Extract playback stream URL
            direct_url = selected_format.get("url")
            if direct_url:
                return direct_url
            
            # 3. If signatureCipher is present, decrypt it
            sig_cipher = selected_format.get("signatureCipher") or selected_format.get("cipher")
            if not sig_cipher:
                return None
                
            cipher_parts = urllib.parse.parse_qs(sig_cipher)
            enc_sig = cipher_parts.get("s", [None])[0]
            sig_param = cipher_parts.get("sp", ["sig"])[0]
            base_url = cipher_parts.get("url", [None])[0]
            
            if not enc_sig or not base_url:
                return None
                
            # Get decipher operations from player base.js
            decipherer = YouTubeDecipherer()
            js_url = decipherer.get_base_js_url(video_id)
            decrypted_sig = decipherer.decipher(enc_sig, js_url)
            
            # Construct final authenticated streaming URL
            parsed_url = urllib.parse.urlparse(base_url)
            query_params = urllib.parse.parse_qs(parsed_url.query)
            query_params[sig_param] = [decrypted_sig]
            
            # Reconstruct URL with decrypted signature
            new_query = urllib.parse.urlencode(query_params, doseq=True)
            final_url = urllib.parse.urlunparse((
                parsed_url.scheme,
                parsed_url.netloc,
                parsed_url.path,
                parsed_url.params,
                new_query,
                parsed_url.fragment
            ))
            return final_url
        except Exception as e:
            print(f"Error extracting stream url: {e}")
            return None

class YouTubeDecipherer:
    def __init__(self):
        self.cached_operations = None
        self.cached_js_url = None

    def get_base_js_url(self, video_id: str) -> str:
        import urllib.request
        import re
        try:
            url = f"https://www.youtube.com/watch?v={video_id}"
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'})
            with urllib.request.urlopen(req, timeout=10) as response:
                html = response.read().decode('utf-8')
                m = re.search(r'jsUrl\x22:\x22([^\x22]+)\x22', html)
                if m:
                    return "https://www.youtube.com" + m.group(1)
        except Exception as e:
            print(f"Error fetching watch page: {e}")
        return "https://www.youtube.com/s/player/8d2a370b/player_es6.vflset/en_GB/base.js"

    def fetch_decipher_operations(self, js_url: str):
        import urllib.request
        import re
        if self.cached_operations and self.cached_js_url == js_url:
            return self.cached_operations
        
        try:
            req = urllib.request.Request(js_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=10) as resp:
                js = resp.read().decode('utf-8')
            
            # Match split("") followed by object method calls, then join("").
            match = re.search(
                r'\b([a-zA-Z0-9_$]+)\s*=\s*function\(\s*([a-zA-Z0-9_$]+)\s*\)\s*\{\s*\2\s*=\s*\2\.split\(\s*["\']\s*["\']\s*\);.*?\b([a-zA-Z0-9_$]+)\.[a-zA-Z0-9_$]+\(\s*\2\s*,.*?\b\2\.join\(', 
                js, re.DOTALL
            )
            if not match:
                match = re.search(
                    r'\b([a-zA-Z0-9_$]+)\s*=\s*function\(\s*([a-zA-Z0-9_$]+)\s*\)\s*\{\s*var\s+([a-zA-Z0-9_$]+)\s*=\s*\2\.split\(\s*["\']\s*["\']\s*\);.*?\b([a-zA-Z0-9_$]+)\.[a-zA-Z0-9_$]+\(\s*\3\s*,.*?\b\3\.join\(', 
                    js, re.DOTALL
                )
            
            if match:
                var_name = match.group(2)
                target_array = match.group(3) if len(match.groups()) > 3 else var_name
                obj_name = match.group(3) if len(match.groups()) == 3 else match.group(4)
                
                obj_match = re.search(r'\b' + re.escape(obj_name) + r'\s*=\s*\{(.*?)\}\s*;', js, re.DOTALL)
                if not obj_match:
                    obj_match = re.search(r'\bvar\s+' + re.escape(obj_name) + r'\s*=\s*\{(.*?)\}\s*;', js, re.DOTALL)
                
                operations = {}
                if obj_match:
                    obj_body = obj_match.group(1)
                    for op_match in re.finditer(r'\b([a-zA-Z0-9_$]+)\s*:\s*function\s*\(\s*([a-zA-Z0-9_$]+)\s*,\s*([a-zA-Z0-9_$]+)\s*\)\s*\{(.*?)\}', obj_body, re.DOTALL):
                        op_name = op_match.group(1)
                        op_code = op_match.group(4)
                        if "reverse" in op_code:
                            operations[op_name] = "reverse"
                        elif "splice" in op_code or "slice" in op_code:
                            operations[op_name] = "slice"
                        else:
                            operations[op_name] = "swap"
                
                func_body_start = js.find(match.group(0))
                func_body_end = js.find("}", func_body_start)
                func_body = js[func_body_start:func_body_end]
                
                calls = []
                for call_match in re.finditer(re.escape(obj_name) + r'\.([a-zA-Z0-9_$]+)\(\s*' + re.escape(target_array) + r'\s*,\s*(\d+)\s*\)', func_body):
                    method_name = call_match.group(1)
                    argument = int(call_match.group(2))
                    op_type = operations.get(method_name)
                    if op_type:
                        calls.append((op_type, argument))
                
                if calls:
                    self.cached_operations = calls
                    self.cached_js_url = js_url
                    return calls
            
            return [("reverse", 0), ("slice", 2), ("swap", 13), ("reverse", 0), ("slice", 1), ("swap", 4)]
        except Exception as e:
            print(f"Error fetching/parsing player JS: {e}")
        return [("reverse", 0), ("slice", 2), ("swap", 13), ("reverse", 0), ("slice", 1), ("swap", 4)]

    def decipher(self, sig: str, js_url: str) -> str:
        calls = self.fetch_decipher_operations(js_url)
        s_arr = list(sig)
        for op, arg in calls:
            try:
                if op == "reverse":
                    s_arr.reverse()
                elif op == "slice":
                    s_arr = s_arr[arg:]
                elif op == "swap":
                    s_arr[0], s_arr[arg] = s_arr[arg], s_arr[0]
            except Exception as e:
                print(f"Decipher operation error: {e}")
        return "".join(s_arr)

ytmusic_service = YTMusicService()
