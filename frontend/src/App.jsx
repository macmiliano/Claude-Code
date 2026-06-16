import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Lobby from './pages/Lobby.jsx';
import WaitingRoom from './pages/WaitingRoom.jsx';
import Game from './pages/Game.jsx';
import GameOver from './pages/GameOver.jsx';
import Profile from './pages/Profile.jsx';
import Leaderboard from './pages/Leaderboard.jsx';
import WatchLive from './pages/WatchLive.jsx';
import Spectate from './pages/Spectate.jsx';

/**
 * Top-level route table. Navigation between these pages is driven both by user
 * clicks and by Socket.IO events (handled in GameContext) — e.g. `game-start`
 * pushes players to /game, and `game-over` pushes them to /results.
 */
export default function App() {
  return (
    <div className="min-h-full w-full">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/lobby" element={<Lobby />} />
        <Route path="/waiting" element={<WaitingRoom />} />
        <Route path="/game" element={<Game />} />
        <Route path="/results" element={<GameOver />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/watch" element={<WatchLive />} />
        <Route path="/spectate" element={<Spectate />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
