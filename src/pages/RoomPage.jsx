import {
  Crown,
  DoorOpen,
  KeyRound,
  Play,
  Skull,
  Trash2,
  UserPlus,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import Header from '../components/Header.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';

const roleMeta = {
  host: {
    label: 'Házigazda',
    icon: Crown,
    tone: 'text-amber-200 bg-amber-300/12 ring-amber-200/20',
  },
  narrator: {
    label: 'Mesélő',
    icon: Skull,
    tone: 'text-pink-100 bg-pink-400/12 ring-pink-200/20',
  },
  player: {
    label: 'Játékos',
    icon: UserRound,
    tone: 'text-cyan-100 bg-cyan-300/10 ring-cyan-200/20',
  },
};

function RoleBadge({ role }) {
  const meta = roleMeta[role] ?? roleMeta.player;
  const Icon = meta.icon;

  return (
    <span
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ring-1',
        meta.tone,
      ].join(' ')}
    >
      <Icon className="h-3.5 w-3.5" />
      {meta.label}
    </span>
  );
}

export default function RoomPage({
  room,
  players,
  currentParticipantId,
  maxParticipants,
  onCreateRoom,
  onJoinRoom,
  onSetRole,
  onRemoveParticipant,
  onLeaveRoom,
  onFinishRoom,
  onStartGame,
  onlineStatus,
  onBack,
}) {
  const [hostName, setHostName] = useState('Házigazda');
  const [joinCode, setJoinCode] = useState(room?.code ?? '');
  const [joinName, setJoinName] = useState('');
  const [message, setMessage] = useState('');
  const [joining, setJoining] = useState(false);
  const currentRole = room?.rolesByPlayerId?.[currentParticipantId] ?? null;
  const isHost =
    currentRole === 'host' ||
    Boolean(room?.hostPlayerId && currentParticipantId === room.hostPlayerId) ||
    onlineStatus?.mode === 'host';
  const currentDisplayRole = isHost ? 'host' : (currentRole ?? 'player');
  const canStart = players.length >= 2;

  useEffect(() => {
    if (room?.code) {
      setJoinCode(room.code);
    }
  }, [room?.code]);

  const currentPlayer = useMemo(
    () => players.find((player) => player.id === currentParticipantId),
    [players, currentParticipantId],
  );

  const handleCreate = async (event) => {
    event.preventDefault();
    const error = await Promise.resolve(onCreateRoom(hostName));
    setMessage(error ?? '');
  };

  const handleJoin = async (event) => {
    event.preventDefault();
    setJoining(true);
    try {
      const error = await Promise.resolve(onJoinRoom(joinCode, joinName));
      setMessage(error ?? '');
      if (!error) setJoinName('');
    } finally {
      setJoining(false);
    }
  };

  return (
    <>
      <Header title="Szoba" onBack={onBack} compact />
      <section
        className={[
          'room-screen flex min-h-0 flex-1 flex-col gap-3',
          room ? 'room-screen--active' : 'room-screen--empty',
        ].join(' ')}
      >
        {!room ? (
          <div className="mobile-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            <form
              onSubmit={handleCreate}
              className="room-card rounded-[1.6rem] border border-white/12 bg-white/10 p-4 shadow-card backdrop-blur"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 via-orange-400 to-pink-500 text-slate-950">
                  <Crown className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-100/70">
                    Új szoba
                  </p>
                  <h2 className="text-2xl font-black text-white">Házigazda</h2>
                </div>
              </div>
              <input
                className="party-field mb-3 w-full rounded-2xl px-4 py-4 font-bold outline-none"
                value={hostName}
                onChange={(event) => setHostName(event.target.value)}
                maxLength={24}
                placeholder="Neved"
                aria-label="Házigazda neve"
              />
              <PrimaryButton type="submit" icon={KeyRound}>
                Kód generálása
              </PrimaryButton>
            </form>

            <form
              onSubmit={handleJoin}
              className="room-card rounded-[1.6rem] border border-white/12 bg-slate-950/42 p-4 shadow-card backdrop-blur"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-cyan-100 ring-1 ring-white/10">
                  <UsersRound className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-100/70">
                    Csatlakozás
                  </p>
                  <h2 className="text-2xl font-black text-white">6 jegyű kód</h2>
                </div>
              </div>
              <div className="grid gap-3">
                <input
                  className="party-field w-full rounded-2xl px-4 py-4 text-center text-xl font-black tracking-[0.2em] outline-none"
                  value={joinCode}
                  onChange={(event) =>
                    setJoinCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                  }
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  aria-label="Szobakód"
                />
                <input
                  className="party-field w-full rounded-2xl px-4 py-4 font-bold outline-none"
                  value={joinName}
                  onChange={(event) => setJoinName(event.target.value)}
                  maxLength={24}
                  placeholder="Neved"
                  aria-label="Játékos neve"
                />
                <PrimaryButton type="submit" variant="secondary" icon={DoorOpen} disabled={joining}>
                  {joining ? 'Csatlakozás...' : 'Belépés'}
                </PrimaryButton>
              </div>
            </form>
          </div>
        ) : (
          <>
            <div className="room-content min-h-0 flex-1 flex flex-col gap-3">
              <div className="room-card rounded-[1.6rem] border border-white/12 bg-white/10 p-4 shadow-card backdrop-blur">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.22em] text-amber-100/70">
                      Meghívó kód
                    </p>
                    <p className="mt-1 text-4xl font-black tracking-[0.16em] text-white">
                      {room.code}
                    </p>
                  </div>
                  <div className="text-right">
                    <RoleBadge role={currentDisplayRole} />
                    <p className="mt-2 text-sm font-bold text-white/58">
                      {players.length}/{maxParticipants}
                    </p>
                  </div>
                </div>
                {currentPlayer ? (
                  <p className="mt-3 truncate text-sm font-bold text-white/62">
                    Belépve: {currentPlayer.name}
                  </p>
                ) : null}
                {onlineStatus?.message ? (
                  <p className="mt-1 text-xs font-black uppercase tracking-[0.16em] text-lime-100/72">
                    {onlineStatus.message}
                  </p>
                ) : null}
              </div>

              <div className="room-members mobile-scroll min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                {players.map((player, index) => {
                  const role = room.rolesByPlayerId?.[player.id] ?? 'player';
                  const isRoomOwner = room.hostPlayerId === player.id;
                  const meta = roleMeta[role] ?? roleMeta.player;
                  const Icon = meta.icon;

                  return (
                    <div
                      key={player.id}
                      className="room-member room-member-motion rounded-[1.35rem] border border-white/10 bg-slate-950/38 p-3 shadow-card backdrop-blur"
                      style={{ '--motion-index': index }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/10 text-white ring-1 ring-white/10">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-lg font-black text-white">
                            {player.name}
                          </p>
                          <RoleBadge role={role} />
                        </div>
                      </div>

                      {isHost && !isRoomOwner ? (
                        <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                          <select
                            className="party-field w-full rounded-2xl px-3 py-3 font-black outline-none"
                            value={role}
                            onChange={(event) => onSetRole(player.id, event.target.value)}
                            aria-label={`${player.name} jogosultsága`}
                          >
                            <option value="player">Játékos</option>
                            <option value="narrator">Mesélő</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => onRemoveParticipant(player.id)}
                            className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-500/18 text-rose-50 ring-1 ring-rose-200/25 transition active:scale-[0.98]"
                            aria-label={`${player.name} eltávolítása`}
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="room-side shrink-0 space-y-2">
              {isHost ? (
                <form
                  onSubmit={handleJoin}
                  className="room-join-inline grid gap-2"
                >
                  <input
                    className="party-field min-w-0 rounded-2xl px-4 py-3 font-bold outline-none"
                    value={joinName}
                    onChange={(event) => setJoinName(event.target.value)}
                    maxLength={24}
                    placeholder="Új játékos neve"
                    aria-label="Új játékos neve"
                  />
                  <PrimaryButton
                    type="submit"
                    icon={UserPlus}
                    disabled={joining}
                    className="min-h-12"
                  >
                    {joining ? 'Hozzáadás...' : 'Hozzáadás'}
                  </PrimaryButton>
                </form>
              ) : null}

              <div className="room-actions grid grid-cols-2 gap-2">
                <PrimaryButton
                  icon={Play}
                  disabled={!isHost || !canStart}
                  onClick={onStartGame}
                >
                  Kezdés
                </PrimaryButton>
                <PrimaryButton
                  variant="danger"
                  icon={DoorOpen}
                  onClick={isHost ? onFinishRoom : onLeaveRoom}
                >
                  {isHost ? 'Befejezés' : 'Kilépés'}
                </PrimaryButton>
              </div>
            </div>
          </>
        )}

        {message ? (
          <p className="shrink-0 rounded-2xl bg-rose-500/16 px-4 py-3 text-sm font-bold text-rose-50 ring-1 ring-rose-200/20">
            {message}
          </p>
        ) : null}
      </section>
    </>
  );
}
