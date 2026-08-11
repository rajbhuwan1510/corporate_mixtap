import { useState } from 'react';

interface JoinRoomProps {
  roomId: string;
  onJoin: (name: string) => void;
}

export function JoinRoom({ roomId, onJoin }: JoinRoomProps) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onJoin(name.trim());
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-zinc-100 px-4">
      <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl flex flex-col gap-6">
        <div className="text-center">
          <p className="text-zinc-500 text-xs font-semibold tracking-wider uppercase mb-1">ROOM {roomId}</p>
          <h2 className="text-2xl font-bold">Join the room</h2>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="name-input" className="text-sm font-medium text-zinc-400">
              Your name:
            </label>
            <input
              id="name-input"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Rahul"
              className="w-full bg-zinc-950 border border-zinc-800 text-zinc-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-zinc-600 transition-all placeholder:text-zinc-600"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-white text-zinc-950 font-semibold py-3 rounded-xl hover:bg-zinc-200 active:scale-[0.98] transition-all"
          >
            JOIN ROOM
          </button>
        </form>
      </div>
    </div>
  );
}
