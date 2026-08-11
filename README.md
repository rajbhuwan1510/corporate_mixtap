# Local YouTube Music Player

A polished local web-based music player built with FastAPI, `ytmusicapi`, and React.

## Prerequisites

- Python 3.12
- Node.js & npm

## Setup & Running

You need to run both the backend and frontend simultaneously in separate terminals.

### 1. Start the Backend

Open a PowerShell terminal and run:

```powershell
cd c:\Users\Flipshope\Downloads\radio\music-player
# Activate the virtual environment
.\venv\Scripts\Activate.ps1
# Start the FastAPI server
cd backend
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`.

### 2. Start the Frontend

Open a second PowerShell terminal and run:

```powershell
cd c:\Users\Flipshope\Downloads\radio\music-player\frontend
# Start the Vite development server
npm run dev
```

The web app will be available at `http://localhost:5173`.

### Verification (Milestone 1)

1. Open `http://localhost:5173` in your browser.
2. Search for a song, artist, or album.
3. Click on a song from the search results to start playback.
4. Test the player controls (Play, Pause, Seek, Volume) at the bottom.
