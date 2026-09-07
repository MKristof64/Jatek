import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import Layout from '../../src/components/Layout.jsx';
import GamePage from '../../src/pages/GamePage.jsx';
import HomePage from '../../src/pages/HomePage.jsx';
import PlayersPage from '../../src/pages/PlayersPage.jsx';
import ModeSelectPage from '../../src/pages/ModeSelectPage.jsx';
import SettingsPage from '../../src/pages/SettingsPage.jsx';
import RoomPage from '../../src/pages/RoomPage.jsx';
import { cards } from '../../src/data/cards.js';
import { getModeById } from '../../src/data/modes.js';
import '../../src/index.css';
import '../../src/responsive.css';

const root = createRoot(document.getElementById('root'));
const noop = () => {};
const players = [
  { id: 'one', name: 'Alexandra' },
  { id: 'two', name: 'Kristof' },
];
window.auditCards = cards;
window.renderFixture = ({ screen = 'game', card = cards[0], ratio = null, dark = true, canControl = true, host = false }) => {
  const settings = { darkMode: dark, saveGames: true, includeDuelCards: true, includeRoundtableCards: true, landscapeRatio: ratio };
  const room = { code: '123456', hostPlayerId: 'one', rolesByPlayerId: { one: 'host', two: 'player' } };
  const screens = {
    game: <GamePage card={card} cardText={card.text} mode={getModeById(card.mode)} currentPlayer={players[0].name} participants={players} timerState={{remainingSeconds:card.durationSeconds}} canControlGame={canControl} canControlTimer={canControl} canFinishGame={host} onNext={noop} onToggleTimer={noop} />,
    home: <HomePage playersCount={2} savedGamesCount={1} onStart={noop} onPlayers={noop} onSavedGames={noop} onSettings={noop} />,
    players: <PlayersPage players={players} onAdd={noop} onRemove={noop} onRoom={noop} onNext={noop} onBack={noop} />,
    modes: <ModeSelectPage playersCount={2} selectedMode="university" onSelectMode={noop} onStartGame={noop} onBack={noop} />,
    settings: <SettingsPage settings={settings} onToggle={noop} onLandscapeRatioChange={noop} onClearData={noop} onBack={noop} />,
    room: <RoomPage room={room} players={players} currentParticipantId="one" maxParticipants={15} onlineStatus={{mode:'host'}} onCreateRoom={noop} onJoinRoom={noop} onSetRole={noop} onRemoveParticipant={noop} onLeaveRoom={noop} onFinishRoom={noop} onStartGame={noop} onBack={noop} />,
  };
  flushSync(() => root.render(<Layout gameMode={screen === 'game'} immersiveMode darkMode={dark} landscapeRatio={ratio}>{screens[screen]}</Layout>));
};
window.renderFixture({});
