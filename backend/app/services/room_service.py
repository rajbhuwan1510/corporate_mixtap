import time
import random
from typing import Dict, List, Optional, Any
from pydantic import BaseModel

class User(BaseModel):
    id: str
    name: str
    joinedAt: float
    lastSeen: float

class PlaybackState(BaseModel):
    isPlaying: bool
    position: float
    startedAt: Optional[float] = None  # Server timestamp in seconds

class Room(BaseModel):
    id: str
    createdAt: float
    hostId: str
    users: List[User] = []
    currentTrackId: Optional[str] = None
    currentSong: Optional[Dict[str, Any]] = None
    playlistIndex: int = 0
    playlist: List[Dict[str, Any]] = []
    playback: PlaybackState
    version: int = 1

class RoomService:
    def __init__(self):
        self.rooms: Dict[str, Room] = {}
        # We can configure idle timeout in seconds (default: 60s)
        self.room_idle_timeout = 60.0
        # Store time when a room became empty: room_id -> timestamp
        self.empty_rooms: Dict[str, float] = {}

    # Funny edgy corporate room names — full phrases
    ROOM_NAMES = [
        # Titles / People
        "BOSS-BITCH", "HORNY-HR", "DUMB-INTERN", "IDIOT-MANAGER",
        "LAZY-CEO", "USELESS-VP", "CREEPY-CTO", "DRUNK-CFO",
        "BOOTLICKER-EMPLOYEE", "FAKE-VISIONARY", "TOXIC-LEAD",
        "MICRO-MANAGER", "GASLIGHT-GURU", "CLUELESS-FOUNDER",
        "SLEEPING-DIRECTOR", "OVERTIME-SLAVE", "OFFICE-SNITCH",
        "LINKEDIN-WARRIOR", "ZOOM-ZOMBIE", "PIVOT-MONKEY",
        "CHAI-PEON", "CHAMCHA-SENIOR", "JUGAAD-BOSS",
        "GHISSU-INTERN", "SARKARI-BABU", "NALLA-LEAD",
        # Meetings / Events
        "POINTLESS-MEETING", "USELESS-STANDUP", "FAKE-BRAINSTORM",
        "MIDNIGHT-DEADLINE", "SUNDAY-CALL", "PANIC-SPRINT",
        "GHOST-OFFSITE", "BUDGET-TAMASHA", "SALARY-FREEZE",
        "TEAM-OUTING-CANCELLED", "APPRAISAL-NAUTANKI",
        "PERFORMANCE-PIP", "TOXIC-TOWNHALL", "FIRE-DRILL-ALERT",
        # Tasks / Situations
        "LAST-MINUTE-CHANGE", "UNCLEAR-REQUIREMENTS", "SCOPE-CREEP",
        "PRODUCTION-DOWN", "BLAME-GAME-LIVE", "FEATURE-GRAVEYARD",
        "CRUNCH-MODE-ALWAYS", "COPY-PASTE-DEVELOPER",
        "FAKE-DEADLINE-REAL", "UNPAID-OVERTIME", "BROKEN-PIPELINE",
        "README-NEVER-READ", "COMMENT-YOUR-CODE", "PR-NEVER-MERGED",
        # Hinglish Office Desi
        "SETTING-LAGAO", "JUGAAD-DEPLOY", "KAL-KAR-LENA",
        "BOSS-KA-CHAMCHA", "APNA-TIME-AAYEGA", "PAISE-NAHI-MILENGE",
        "KUCH-BHI-CHALEGA", "BAKWAAS-PROJECT", "ULLU-MEETING",
        "GHANTA-SPRINT", "BEKAAR-STANDUP", "MAST-CHILL-ZONE",
    ]

    def generate_room_id(self) -> str:
        while True:
            room_id = random.choice(self.ROOM_NAMES)
            if room_id not in self.rooms:
                return room_id

    def create_room(self, creator_id: str, creator_name: str, initial_song: Optional[Dict[str, Any]] = None, initial_position: float = 0.0, is_playing: bool = False) -> Room:
        room_id = self.generate_room_id()
        now = time.time()
        
        # Creator user
        creator = User(
            id=creator_id,
            name=creator_name,
            joinedAt=now,
            lastSeen=now
        )
        
        # If there's an initial song, create a playlist containing it
        playlist = [initial_song] if initial_song else []
        current_track_id = initial_song.get("videoId") if initial_song else None
        
        playback = PlaybackState(
            isPlaying=is_playing,
            position=initial_position,
            startedAt=now if is_playing else None
        )
        
        room = Room(
            id=room_id,
            createdAt=now,
            hostId=creator_id,
            users=[creator],
            currentTrackId=current_track_id,
            currentSong=initial_song,
            playlistIndex=0,
            playlist=playlist,
            playback=playback,
            version=1
        )
        
        self.rooms[room_id] = room
        if room_id in self.empty_rooms:
            del self.empty_rooms[room_id]
        return room

    def get_room(self, room_id: str) -> Optional[Room]:
        self.clean_expired_rooms()
        return self.rooms.get(room_id)

    def calculate_current_position(self, room: Room) -> float:
        if not room.playback.isPlaying or room.playback.startedAt is None:
            return room.playback.position
        
        elapsed = time.time() - room.playback.startedAt
        return room.playback.position + elapsed

    def join_room(self, room_id: str, user_id: str, user_name: str) -> Optional[Room]:
        room = self.get_room(room_id)
        if not room:
            return None
        
        # Check if user already exists
        existing_user = next((u for u in room.users if u.id == user_id), None)
        now = time.time()
        if existing_user:
            existing_user.name = user_name
            existing_user.lastSeen = now
        else:
            new_user = User(
                id=user_id,
                name=user_name,
                joinedAt=now,
                lastSeen=now
            )
            room.users.append(new_user)
            
        # If room had no host (or host left), assign the first user as host
        if not room.hostId or not any(u.id == room.hostId for u in room.users):
            room.hostId = user_id

        # Update position based on elapsed time before returning/broadcasting state
        if room.playback.isPlaying and room.playback.startedAt:
            room.playback.position = self.calculate_current_position(room)
            room.playback.startedAt = now

        if room_id in self.empty_rooms:
            del self.empty_rooms[room_id]

        room.version += 1
        return room

    def leave_room(self, room_id: str, user_id: str) -> Optional[Room]:
        room = self.rooms.get(room_id)
        if not room:
            return None
        
        # Calculate current position before updating users
        now = time.time()
        if room.playback.isPlaying and room.playback.startedAt:
            room.playback.position = self.calculate_current_position(room)
            room.playback.startedAt = now

        room.users = [u for u in room.users if u.id != user_id]
        
        # If host left, assign a new host if users still exist
        if room.hostId == user_id:
            if room.users:
                room.hostId = room.users[0].id
            else:
                room.hostId = ""

        if not room.users:
            self.empty_rooms[room_id] = now

        room.version += 1
        return room

    def update_play(self, room_id: str) -> Optional[Room]:
        room = self.get_room(room_id)
        if not room:
            return None
        
        now = time.time()
        if not room.playback.isPlaying:
            room.playback.isPlaying = True
            room.playback.startedAt = now
            room.version += 1
            
        return room

    def update_pause(self, room_id: str) -> Optional[Room]:
        room = self.get_room(room_id)
        if not room:
            return None
        
        now = time.time()
        if room.playback.isPlaying:
            room.playback.position = self.calculate_current_position(room)
            room.playback.isPlaying = False
            room.playback.startedAt = None
            room.version += 1
            
        return room

    def update_seek(self, room_id: str, position: float) -> Optional[Room]:
        room = self.get_room(room_id)
        if not room:
            return None
        
        now = time.time()
        room.playback.position = position
        if room.playback.isPlaying:
            room.playback.startedAt = now
        else:
            room.playback.startedAt = None
            
        room.version += 1
        return room

    def update_track(self, room_id: str, song: Dict[str, Any]) -> Optional[Room]:
        room = self.get_room(room_id)
        if not room:
            return None
        
        now = time.time()
        room.currentSong = song
        room.currentTrackId = song.get("videoId")
        
        # Check if the song is already in the upcoming queue (at or after playlistIndex)
        found_idx = -1
        for i in range(room.playlistIndex, len(room.playlist)):
            if room.playlist[i].get("videoId") == song.get("videoId"):
                found_idx = i
                break
                    
        if found_idx != -1:
            room.playlistIndex = found_idx
        else:
            # Insert right after current song to preserve the remaining queue
            insert_pos = room.playlistIndex + 1 if room.playlist else 0
            room.playlist.insert(insert_pos, song)
            room.playlistIndex = insert_pos
            
        room.playback.position = 0.0
        if room.playback.isPlaying:
            room.playback.startedAt = now
        else:
            room.playback.startedAt = None
            
        room.version += 1
        return room

    def next_track(self, room_id: str) -> Optional[Room]:
        room = self.get_room(room_id)
        if not room or not room.playlist:
            return None
        
        now = time.time()
        next_idx = room.playlistIndex + 1
        if next_idx < len(room.playlist):
            room.playlistIndex = next_idx
            room.currentSong = room.playlist[next_idx]
            room.currentTrackId = room.currentSong.get("videoId")
            room.playback.position = 0.0
            if room.playback.isPlaying:
                room.playback.startedAt = now
            room.version += 1
        return room

    def prev_track(self, room_id: str) -> Optional[Room]:
        room = self.get_room(room_id)
        if not room or not room.playlist:
            return None
        
        now = time.time()
        prev_idx = room.playlistIndex - 1
        if prev_idx >= 0:
            room.playlistIndex = prev_idx
            room.currentSong = room.playlist[prev_idx]
            room.currentTrackId = room.currentSong.get("videoId")
            room.playback.position = 0.0
            if room.playback.isPlaying:
                room.playback.startedAt = now
            room.version += 1
        return room

    def add_to_playlist(self, room_id: str, song: Dict[str, Any]) -> Optional[Room]:
        room = self.get_room(room_id)
        if not room:
            return None
        
        room.playlist.append(song)
        
        # If no song is currently set, make this the current song
        if room.currentSong is None:
            room.currentSong = song
            room.currentTrackId = song.get("videoId")
            room.playlistIndex = 0
            
        room.version += 1
        return room

    def remove_from_playlist(self, room_id: str, index: int) -> Optional[Room]:
        room = self.get_room(room_id)
        if not room:
            return None
        
        if 0 <= index < len(room.playlist):
            room.playlist.pop(index)
            # Adjust index if necessary
            if room.playlistIndex >= len(room.playlist):
                room.playlistIndex = max(0, len(room.playlist) - 1)
            
            if room.playlist:
                room.currentSong = room.playlist[room.playlistIndex]
                room.currentTrackId = room.currentSong.get("videoId")
            else:
                room.currentSong = None
                room.currentTrackId = None
                room.playback.isPlaying = False
                room.playback.position = 0.0
                room.playback.startedAt = None
                
            room.version += 1
        return room

    def clear_playlist(self, room_id: str) -> Optional[Room]:
        room = self.get_room(room_id)
        if not room:
            return None
        
        room.playlist = []
        room.playlistIndex = 0
        room.currentSong = None
        room.currentTrackId = None
        room.playback.isPlaying = False
        room.playback.position = 0.0
        room.playback.startedAt = None
        room.version += 1
        return room

    def update_user_activity(self, room_id: str, user_id: str):
        room = self.rooms.get(room_id)
        if room:
            now = time.time()
            for u in room.users:
                if u.id == user_id:
                    u.lastSeen = now
                    break

    def clean_expired_rooms(self):
        now = time.time()
        expired_ids = []
        for room_id, empty_since in list(self.empty_rooms.items()):
            if now - empty_since > self.room_idle_timeout:
                expired_ids.append(room_id)
                
        for rid in expired_ids:
            if rid in self.rooms:
                del self.rooms[rid]
            if rid in self.empty_rooms:
                del self.empty_rooms[rid]

room_service = RoomService()
