import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ArrowRight, Users, Copy, Share2, Crown, X, Check, Timer, LogOut, Trophy, ChevronRight, Flag, RotateCcw, Gamepad2 } from 'lucide-react';
import { isValidAnswer, TOPICS } from './game.js';
import './darkroom.css';

export const DARKROOM_API_URL = `${(import.meta.env.VITE_DARKROOM_API_ORIGIN || 'https://darkroom.kristof-madarasz159.chatgpt.site').replace(/\/$/, '')}/api/game`;
const WEB_APP_URL = 'https://mkristof64.github.io/Jatek/';
const STORAGE = 'partyrush.darkroom.';
const emptyAnswers = () => Array(7).fill('');
const validAnswers = value => Array.isArray(value) && value.length === 7 && value.every(answer => typeof answer === 'string' && answer.length <= 100);
const readStorage = key => { try { return sessionStorage.getItem(STORAGE + key); } catch { return null; } };
const writeStorage = (key, value) => { try { sessionStorage.setItem(STORAGE + key, value); } catch { /* Play remains available with storage disabled. */ } };
const removeStorage = key => { try { sessionStorage.removeItem(STORAGE + key); } catch { /* Storage is optional. */ } };
const cancelled = () => Object.assign(new Error('A művelet megszakadt.'), { name: 'AbortError' });
const inviteUrl = code => { const url = new URL(WEB_APP_URL); url.searchParams.set('jatek', 'darkroom'); url.searchParams.set('szoba', code); return url.href; };

function ScoreInput({ value, label, max = 100, onSave }) {
  const [v, setV] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const focused = useRef(false);
  const latestValue = useRef(value);
  latestValue.current = value;
  useEffect(() => { if (!focused.current) setV(String(value)); }, [value]);
  async function save() {
    focused.current = false;
    const number = Number(v);
    if (v === '' || !Number.isInteger(number) || number < 0 || number > max || number === latestValue.current) { setV(String(latestValue.current)); return; }
    setSaving(true);
    try { if (await onSave(number) === false) setV(String(latestValue.current)); }
    catch { setV(String(latestValue.current)); }
    finally { setSaving(false); }
  }
  return <input className="score-input" type="number" inputMode="numeric" min="0" max={max} step="1" disabled={saving} aria-busy={saving} aria-label={label} value={v} onFocus={() => { focused.current = true; }} onChange={event => setV(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }} onBlur={save} />;
}

const DarkroomPage = forwardRef(function DarkroomPage({ onChooseGame }, ref) {
  const [name, setName] = useState(''), [code, setCode] = useState(''), [mode, setMode] = useState('create');
  const [session, setSession] = useState(null), [state, setState] = useState(null), [answers, setAnswers] = useState(emptyAnswers);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState(''), [network, setNetwork] = useState('');
  const [saved, setSaved] = useState(true), [clock, setClock] = useState(Date.now()), [rules, setRules] = useState(false);
  const [kick, setKick] = useState(null), [exitAction, setExitAction] = useState(null), [exitError, setExitError] = useState('');
  const [keyboardOpen, setKeyboardOpen] = useState(false), [ending, setEnding] = useState(false);
  const rootRef = useRef(null), live = useRef(null), creds = useRef(null), draft = useRef(emptyAnswers());
  const timer = useRef(null), queue = useRef(Promise.resolve()), offset = useRef(0), mounted = useRef(false);
  const epoch = useRef(0), revision = useRef(0), requests = useRef(new Set()), poll = useRef(null), pending = useRef(0);
  const exitPending = useRef(false), exitDestination = useRef('home'), enterPending = useRef(false), endingRef = useRef(false), focusBeforeModal = useRef(null);
  const currentDraftKey = useRef(null), latestChoose = useRef(onChooseGame), answerRevision = useRef(0);
  latestChoose.current = onChooseGame;

  const host = Boolean(state && state.host === state.you), round = state?.round;
  const own = round?.players.find(player => player.id === state.you);
  const remaining = round ? Math.max(0, Math.ceil((round.deadline - clock) / 1000)) : 0;
  const filled = answers.filter(answer => answer.trim()).length;
  const ranking = state ? [...state.players].sort((first, second) => second.total - first.total) : [];
  const leader = ranking[0], tied = leader ? ranking.filter(player => player.total === leader.total) : [];

  function toast(text) { if (mounted.current) setMessage(text); }
  function updateRoomUrl(roomCode) {
    try { const url = new URL(window.location.href); url.searchParams.set('jatek', 'darkroom'); if (roomCode) url.searchParams.set('szoba', roomCode); else url.searchParams.delete('szoba'); history.replaceState(history.state, '', url.pathname + url.search + url.hash); } catch { /* Native app history may be unavailable. */ }
  }
  function cancelDraftTimer() { if (timer.current) clearTimeout(timer.current); timer.current = null; }
  function abortRequests() { for (const controller of requests.current) controller.abort(); requests.current.clear(); poll.current = null; }
  function clear() {
    cancelDraftTimer(); epoch.current += 1; revision.current += 1; abortRequests();
    if (currentDraftKey.current) removeStorage(currentDraftKey.current);
    currentDraftKey.current = null; creds.current = null; live.current = null; draft.current = emptyAnswers();
    removeStorage('session'); updateRoomUrl(null);
    if (mounted.current) { setSession(null); setState(null); setAnswers(emptyAnswers()); setSaved(true); setNetwork(''); setExitAction(null); setKick(null); }
  }
  function consume(next) {
    if (!mounted.current || !next || !/^\d{6}$/.test(next.code) || !Array.isArray(next.players)) return;
    if (Number.isFinite(next.serverNow)) offset.current = next.serverNow - Date.now();
    setClock(Date.now() + offset.current);
    const ownNext = next.round?.players.find(player => player.id === next.you);
    const changedRound = next.round?.id !== live.current?.round?.id;
    if (changedRound) {
      cancelDraftTimer();
      if (currentDraftKey.current) removeStorage(currentDraftKey.current);
      currentDraftKey.current = next.round ? `draft.${next.code}.${next.you}.${next.round.id}` : null;
      let nextAnswers = validAnswers(ownNext?.answers) ? ownNext.answers : emptyAnswers();
      let unsavedRestore = false;
      if (next.phase === 'playing' && !ownNext?.submitted && currentDraftKey.current) {
        try { const stored = JSON.parse(readStorage(currentDraftKey.current) || 'null'); if (validAnswers(stored)) { unsavedRestore = stored.some((answer, index) => answer !== nextAnswers[index]); nextAnswers = stored; } } catch { /* Reject malformed or unrelated stored drafts. */ }
      }
      answerRevision.current = Number.isSafeInteger(ownNext?.answerRevision) ? ownNext.answerRevision : 0;
      draft.current = [...nextAnswers]; setAnswers(draft.current); setSaved(!unsavedRestore);
      if (unsavedRestore) scheduleDraft(next.round.id, draft.current);
    }
    if (Number.isSafeInteger(ownNext?.answerRevision)) answerRevision.current = Math.max(answerRevision.current, ownNext.answerRevision);
    if (next.phase !== 'playing' || ownNext?.submitted) {
      cancelDraftTimer(); if (currentDraftKey.current) removeStorage(currentDraftKey.current);
      if (validAnswers(ownNext?.answers)) { draft.current = [...ownNext.answers]; setAnswers(draft.current); }
      setSaved(true);
    }
    const changedPhase = next.phase !== live.current?.phase || changedRound;
    live.current = next; setState(next); setNetwork('');
    if (changedPhase) requestAnimationFrame(() => { if (mounted.current) rootRef.current?.scrollTo({ top: 0, behavior: 'auto' }); });
  }
  async function request(options, controller) {
    const timeout = setTimeout(() => controller.abort('timeout'), 12000);
    requests.current.add(controller);
    try {
      const response = await fetch(DARKROOM_API_URL + (options.query || ''), { ...options, query: undefined, signal: controller.signal, cache: 'no-store' });
      let data; try { data = await response.json(); } catch (error) { if (error.name === 'AbortError') throw error; throw new Error('A szerver válasza most nem olvasható. Próbáld újra.'); }
      return { response, data };
    } catch (error) {
      if (controller.signal.aborted && controller.signal.reason === 'timeout') throw new Error('A szerver túl lassan válaszol. Próbáld újra.');
      throw error;
    } finally { clearTimeout(timeout); requests.current.delete(controller); }
  }
  async function refresh() {
    const current = creds.current;
    if (!mounted.current || !current || poll.current || pending.current) return;
    const generation = epoch.current, atRevision = revision.current, controller = new AbortController(); poll.current = controller;
    try {
      const { response, data } = await request({ query: '?code=' + encodeURIComponent(current.code), headers: { Authorization: 'Bearer ' + current.token } }, controller);
      if (!mounted.current || generation !== epoch.current || atRevision !== revision.current || creds.current?.token !== current.token) return;
      if (!response.ok) { if ([401, 404, 410].includes(response.status)) { clear(); toast(data.error || 'Ez a szoba már nem elérhető.'); } else setNetwork(data.error || 'A játék most nem frissíthető.'); return; }
      consume(data);
    } catch (error) { if (error.name !== 'AbortError' && mounted.current && generation === epoch.current && atRevision === revision.current) setNetwork('A kapcsolat megszakadt. Újracsatlakozás…'); }
    finally { if (poll.current === controller) poll.current = null; }
  }
  function send(action, extra = {}) {
    const current = creds.current, generation = epoch.current;
    revision.current += 1; poll.current?.abort(); poll.current = null; pending.current += 1;
    if (mounted.current) setBusy(true);
    const task = queue.current.catch(() => {}).then(async () => {
      if (!mounted.current || generation !== epoch.current || !current || creds.current?.token !== current.token) throw cancelled();
      if (action === 'answers' && (
        extra.answerRevision < answerRevision.current ||
        extra.roundId !== live.current?.round?.id ||
        live.current?.phase !== 'playing'
      )) return { skipped: true };
      const controller = new AbortController();
      const { response, data } = await request({ method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + current.token }, body: JSON.stringify({ action, code: current.code, ...extra }) }, controller);
      if (!mounted.current || generation !== epoch.current || creds.current?.token !== current.token) throw cancelled();
      if (!response.ok) { if ([401, 404, 410].includes(response.status)) clear(); throw Object.assign(new Error(data.error || 'Nem sikerült menteni.'), { status: response.status }); }
      if (data.state) consume(data.state);
      return data;
    }).finally(() => { pending.current = Math.max(0, pending.current - 1); if (mounted.current) setBusy(pending.current > 0 || enterPending.current); });
    queue.current = task;
    return task;
  }
  async function command(action, extra = {}, onError) {
    setMessage('');
    try { await send(action, extra); return true; }
    catch (error) { if (error.name !== 'AbortError' && mounted.current) { const text = error.message || 'Nem sikerült menteni.'; toast(text); onError?.(text); void refresh(); } return false; }
  }
  useEffect(() => {
    mounted.current = true;
    const previousTitle = document.title, themeMeta = document.querySelector('meta[name="theme-color"]');
    const previousTheme = themeMeta?.getAttribute('content');
    document.title = 'Ország–Város • Darkroom'; themeMeta?.setAttribute('content', '#130b1d');
    let requestedCode = null;
    try { requestedCode = new URLSearchParams(location.search).get('szoba'); if (requestedCode && /^\d{6}$/.test(requestedCode)) { setCode(requestedCode); setMode('join'); } } catch { /* Native launches may omit a query. */ }
    setName(readStorage('name') || '');
    try { const old = JSON.parse(readStorage('session') || 'null'); if (old && /^\d{6}$/.test(old.code) && typeof old.token === 'string' && /^[A-Za-z0-9_-]{20,256}$/.test(old.token)) { creds.current = old; setSession(old); void refresh(); if (requestedCode && requestedCode !== old.code) toast('Még egy másik szobában vagy. Kilépés után csatlakozhatsz az új meghívóval.'); } } catch { removeStorage('session'); }
    return () => { mounted.current = false; epoch.current += 1; cancelDraftTimer(); abortRequests(); document.title = previousTitle; if (previousTheme !== null && previousTheme !== undefined) themeMeta?.setAttribute('content', previousTheme); };
  }, []);
  useEffect(() => {
    if (!session) return undefined;
    const interval = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 1500);
    const tick = setInterval(() => { if (document.visibilityState === 'visible') setClock(Date.now() + offset.current); }, 250);
    const visible = () => { if (document.visibilityState === 'visible') { setClock(Date.now() + offset.current); void refresh(); } };
    const online = () => { void refresh(); };
    document.addEventListener('visibilitychange', visible); window.addEventListener('online', online);
    return () => { clearInterval(interval); clearInterval(tick); document.removeEventListener('visibilitychange', visible); window.removeEventListener('online', online); };
  }, [session?.token]);
  useEffect(() => { if (!message) return undefined; const timeout = setTimeout(() => setMessage(''), 6000); return () => clearTimeout(timeout); }, [message]);
  useEffect(() => {
    const adjustFocus = () => {
      const active = document.activeElement, viewport = window.visualViewport;
      const editing = Boolean(rootRef.current?.contains(active) && active instanceof HTMLInputElement);
      setKeyboardOpen(editing && Boolean(viewport && window.innerHeight - viewport.height > 120));
      if (editing) requestAnimationFrame(() => {
        const bottom = viewport ? viewport.height + viewport.offsetTop : window.innerHeight;
        const rectangle = active.getBoundingClientRect();
        if (rectangle.bottom > bottom - 30) rootRef.current?.scrollBy({ top: rectangle.bottom - bottom + 70, behavior: 'auto' });
      });
    };
    window.visualViewport?.addEventListener('resize', adjustFocus);
    document.addEventListener('focusin', adjustFocus); document.addEventListener('focusout', adjustFocus);
    return () => { window.visualViewport?.removeEventListener('resize', adjustFocus); document.removeEventListener('focusin', adjustFocus); document.removeEventListener('focusout', adjustFocus); };
  }, []);
  async function enter(event) {
    event.preventDefault(); if (enterPending.current) return;
    enterPending.current = true; setBusy(true); setMessage('');
    const generation = epoch.current;
    try {
      const { response, data } = await request({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: mode, name: name.trim(), code }) }, new AbortController());
      if (!mounted.current || generation !== epoch.current) return;
      if (!response.ok) throw new Error(data.error || 'Nem sikerült csatlakozni.');
      if (!data.state || typeof data.token !== 'string') throw new Error('Hiányos szerverválasz. Próbáld újra.');
      const current = { code: data.state.code, token: data.token };
      creds.current = current; setSession(current); writeStorage('session', JSON.stringify(current)); writeStorage('name', name.trim()); consume(data.state); updateRoomUrl(current.code);
    } catch (error) { if (error.name !== 'AbortError' && mounted.current && generation === epoch.current) toast(error.message || 'Nem sikerült csatlakozni. Próbáld újra.'); }
    finally { enterPending.current = false; if (mounted.current) setBusy(pending.current > 0); }
  }
  function edit(index, value) {
    const current = live.current;
    if (endingRef.current || !current?.round || current.phase !== 'playing' || current.round.players.find(player => player.id === current.you)?.submitted) return;
    const next = [...draft.current]; next[index] = value; draft.current = next; setAnswers(next); setSaved(false);
    if (currentDraftKey.current) writeStorage(currentDraftKey.current, JSON.stringify(next));
    scheduleDraft(current.round.id, next);
  }
  function scheduleDraft(roundId, next) {
    cancelDraftTimer();
    answerRevision.current = Math.max(Date.now(), answerRevision.current + 1); const draftRevision = answerRevision.current;
    timer.current = setTimeout(async () => {
      timer.current = null;
      if (live.current?.round?.id !== roundId || live.current.phase !== 'playing') return;
      try { await send('answers', { roundId, answers: next, answerRevision: draftRevision }); if (mounted.current && draft.current === next) setSaved(true); }
      catch (error) { if (error.name !== 'AbortError' && mounted.current && draft.current === next && live.current?.round?.id === roundId && live.current.phase === 'playing') { setNetwork('A válaszok mentése nem sikerült. A beküldéskor újrapróbáljuk.'); if (error.status === 409) void refresh(); } }
    }, 450);
  }
  async function end(action) {
    const current = live.current; if (endingRef.current || !current?.round || current.phase !== 'playing') return;
    endingRef.current = true; setEnding(true); cancelDraftTimer();
    const snapshot = [...draft.current];
    answerRevision.current = Math.max(Date.now(), answerRevision.current + 1); const finalRevision = answerRevision.current;
    try {
      if (action === 'stop' && !current.round.players.find(player => player.id === current.you)?.submitted) {
        if (!await command('answers', { roundId: current.round.id, answers: snapshot, answerRevision: finalRevision })) return;
      }
      await command(action, { roundId: current.round.id, answers: snapshot, answerRevision: finalRevision });
    } finally { endingRef.current = false; if (mounted.current) setEnding(false); }
  }
  async function share() {
    if (!live.current) return;
    const url = inviteUrl(live.current.code);
    try { if (navigator.share) await navigator.share({ title: 'Ország–Város • Darkroom', text: 'Gyere a szobába! Kód: ' + live.current.code, url }); else { await navigator.clipboard.writeText(url); toast('Meghívólink kimásolva!'); } } catch (error) { if (error.name !== 'AbortError') toast('Meghívólink: ' + url); }
  }
  function openExit(action, trigger, destination = 'home') {
    if (exitPending.current) return;
    focusBeforeModal.current = trigger || document.activeElement; exitDestination.current = destination; setExitError(''); setExitAction(action);
  }
  function requestChooser() { if (creds.current) openExit('leave', document.activeElement, 'chooser'); else latestChoose.current?.(); }
  function goHome() { if (creds.current) openExit('leave', document.activeElement, 'home'); else rootRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }
  async function confirmExit() {
    if (!exitAction || exitPending.current) return;
    const action = exitAction, destination = exitDestination.current;
    exitPending.current = true; endingRef.current = true; setEnding(true); setExitError(''); cancelDraftTimer();
    try {
      const current = live.current;
      if (action === 'leave' && current?.phase === 'playing' && !current.round.players.find(player => player.id === current.you)?.submitted) {
        answerRevision.current = Math.max(Date.now(), answerRevision.current + 1);
        if (!await command('answers', { roundId: current.round.id, answers: [...draft.current], answerRevision: answerRevision.current }, setExitError)) return;
      }
      if (await command(action, {}, setExitError)) {
        setExitAction(null);
        if (action === 'leave') { clear(); if (destination === 'chooser') latestChoose.current?.(); }
      }
    } finally { exitPending.current = false; endingRef.current = false; if (mounted.current) setEnding(false); }
  }
  useImperativeHandle(ref, () => ({ handleBack() {
    if (creds.current) updateRoomUrl(creds.current.code);
    if (exitPending.current) return true;
    if (rules || kick || exitAction) { setRules(false); setKick(null); setExitAction(null); return true; }
    if (creds.current) { openExit('leave', document.activeElement, 'chooser'); return true; }
    return false;
  } }));
  useEffect(() => {
    if (rules || kick || exitAction) return undefined;
    const escape = event => {
      if (event.key !== 'Escape' || event.repeat || event.isComposing) return;
      event.preventDefault();
      if (creds.current) openExit('leave', document.activeElement, 'chooser');
      else latestChoose.current?.();
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [rules, kick, exitAction]);
  useEffect(() => {
    if (!rules && !kick && !exitAction) return undefined;
    const previousFocus = focusBeforeModal.current || document.activeElement;
    const handle = event => {
      if (event.key === 'Escape') { event.preventDefault(); if (!exitPending.current) { setRules(false); setKick(null); setExitAction(null); } return; }
      if (event.key !== 'Tab') return;
      const controls = Array.from(rootRef.current?.querySelectorAll('.modal button:not(:disabled), .modal input:not(:disabled), .modal a[href]') || []);
      if (!controls.length) return;
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handle);
    return () => { document.removeEventListener('keydown', handle); focusBeforeModal.current = null; if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus(); };
  }, [rules, kick, exitAction]);
 return <div ref={rootRef} className={'darkroom-root'+(keyboardOpen?' keyboard-open':'')+((rules||kick||exitAction)?' modal-open':'')}><main className="app">
  <header className="topbar"><button type="button" className="brand" onClick={goHome} aria-label="Ország–Város kezdőoldal"><span className="brand-tile">O<span>V</span></span><span>ORSZÁG–VÁROS<small>DARKROOM</small></span></button><div className="top-actions"><button className="text-button choose-game-button" onClick={requestChooser}><Gamepad2 size={17}/> Másik játék</button><button className="text-button" onClick={()=>setRules(true)}>Játékszabály</button><span className="badge adult">18+</span></div></header>
  {message&&<div className="toast" role="status">{message}<button aria-label="Üzenet bezárása" onClick={()=>setMessage('')}><X size={17}/></button></div>}
  {network&&<div className="network" role="status">{network}<button onClick={refresh}>Újrapróbálás</button></div>}
  {!state?<div className="start-layout"><section className="intro"><h1>Ország,<br/>Város<em>Eredeti, kicsit másképp!</em></h1><div className="floating-letter" aria-hidden="true"><span>?</span></div></section>
   <section className="entry panel"><div className="panel-heading"><span className="mini-icon"><Users size={23}/></span><div><h2>Gyűljön össze a társaság.</h2><p>Telefon elő, becenév be.</p></div></div><div className="tabs"><button className={mode==='create'?'selected':''} onClick={()=>setMode('create')}>Új szoba</button><button className={mode==='join'?'selected':''} onClick={()=>setMode('join')}>Csatlakozás</button></div><form onSubmit={enter}><label htmlFor="nickname">A beceneved</label><input id="nickname" required maxLength={24} autoComplete="nickname" placeholder="Így hívnak majd a játékban" value={name} onChange={e=>setName(e.target.value)}/>{mode==='join'&&<><label htmlFor="roomcode">Hatjegyű szobakód</label><input className="code-input" id="roomcode" required pattern="[0-9]{6}" inputMode="numeric" autoComplete="off" maxLength={6} placeholder="000000" value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))}/></>}<button className="primary entry-submit" disabled={busy||!!session}>{busy||session?'Kapcsolódás…':mode==='create'?'Szoba létrehozása':'Belépek a szobába'}<ArrowRight size={20}/></button></form><p className="entry-note">{mode==='create'?'Te leszel a házigazda. A kódot küldd el a többieknek.':'A kódot a házigazdától kapod. Mindenki a saját készülékén játszik.'}</p>{session&&<button className="text-button" onClick={()=>openExit('leave',document.activeElement,'home')}>Kilépés a szobából</button>}</section>
  </div>:<>
   <div className="room-bar"><span className="badge">{state.phase==='lobby'?'VÁRÓSZOBA':state.phase==='finished'?'VÉGEREDMÉNY':`${round?.number}. KÖR`}</span><div className="room-code"><span>SZOBAKÓD</span><button onClick={async()=>{try{await navigator.clipboard.writeText(state.code);toast('Szobakód kimásolva!');}catch{toast('Szobakód: '+state.code);}}} aria-label="Szobakód másolása">{state.code}<Copy size={17}/></button></div><button className="secondary share-button" onClick={share}><Share2 size={17}/> Meghívás</button>{<button className="icon-button" aria-label="Kilépés a szobából" disabled={busy} onClick={e=>openExit('leave',e.currentTarget)}><LogOut size={20}/></button>}</div>
   <div className="game-layout"><section className="game-main">
    {state.phase==='lobby'&&<div className="lobby panel"><div className="eyebrow">MÁR CSAK A TÁRSASÁG HIÁNYZIK</div><h1>Készen álltok<br/>a <em>következő betűre?</em></h1><p>Oszd meg a <b>{state.code}</b> kódot vagy a meghívólinket. Minden körben 7 témát sorsolunk a {TOPICS.length}-ból.</p><div className="lobby-letter" aria-hidden="true">?<span>7 TÉMA · 1 BETŰ</span></div><div className="setting"><label htmlFor="duration"><Timer size={18}/> Ennyi időtök lesz egy körre</label><select id="duration" value={state.seconds} disabled={!host||busy} onChange={e=>command('settings',{seconds:Number(e.target.value)})}><option value="60">1 perc</option><option value="90">1,5 perc</option><option value="120">2 perc</option><option value="180">3 perc</option></select></div>{host?<button className="primary" disabled={busy} onClick={()=>command('start')}>Induljon az első kör <ArrowRight size={21}/></button>:<div className="waiting">A házigazda indítja a játékot.</div>}</div>}
    {state.phase==='playing'&&<>
     <div className="round-banner"><div className="letter-tile" key={round.id}>{round.letter}</div><div className="round-info"><div className="eyebrow">EZZEL A BETŰVEL KEZDŐDJÖN</div><h1>Mi jut eszedbe?</h1><span>{filled}/7 válasz kitöltve</span></div><div className={'countdown '+(remaining<=15?'urgent':'')}><Timer size={18}/><b>{Math.floor(remaining/60)}:{String(remaining%60).padStart(2,'0')}</b><span>maradt</span></div></div>
     <form onSubmit={e=>{e.preventDefault();end('submit');}} className="answer-form"><div className="answer-grid">{round.topics.map((t,i)=>{const ok=isValidAnswer(answers[i],round.letter);return <label className={'answer-card answer-index-'+i+' '+(ok?'filled':'')} key={round.id+t}><span className="answer-label"><span className="category-number">0{i+1}</span><span>{t}</span>{ok&&<Check size={17}/>}</span><input aria-label={t} disabled={ending||own?.submitted||remaining===0} maxLength={100} enterKeyHint={i===6?'done':'next'} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();const fields=Array.from(rootRef.current?.querySelectorAll('.answer-card input')||[]);if(fields[i+1])fields[i+1].focus();else rootRef.current?.querySelector('.submit-bar button')?.focus();}}} autoComplete="off" placeholder={`${round.letter}… (legalább 3 betű)`} value={answers[i]} onChange={e=>edit(i,e.target.value)}/></label>;})}</div><div className="submit-bar"><span className="save-status">{own?.submitted?<><Check size={16}/> Beküldve. Várjuk a többieket.</>:saved?'Válaszok mentve':'Válaszok mentése…'}</span><button className="primary" disabled={ending||busy||own?.submitted||remaining===0} type="submit">{own?.submitted?'Kész vagyok':'Kész vagyok, beküldöm'}<Check size={19}/></button></div></form>{host&&<button className="text-button stop-button" disabled={ending||busy} onClick={()=>end('stop')}><Flag size={16}/> Kör lezárása mindenkinek</button>}
    </>}
    {state.phase==='review'&&<><div className="section-heading"><div><div className="eyebrow">{round.letter} BETŰ · {round.number}. KÖR</div><h1>Jöhetnek a válaszok.</h1><p>{host?'Beszéljétek át! A pontmezőket átírhatod; Enterrel vagy kilépéssel mentjük.':'Beszéljétek át a válaszokat. A házigazda javíthatja a pontokat.'}</p></div><span className="round-score-icon"><Check size={32}/></span></div><div className="review-categories">{round.topics.map((t,i)=><section className="review-category panel" key={t}><h2><span className="category-number">0{i+1}</span>{t}</h2>{round.players.map((p)=><div className="review-row" key={p.id}><span className="review-name">{p.name}{p.id===state.you&&<small> TE</small>}</span><span className={'review-answer '+(!p.answers[i]?'empty':'')}>{p.answers[i]||'Nincs válasz'}</span>{host?<ScoreInput label={`${p.name} pontja: ${t}`} value={p.points[i]} onSave={n=>command('score',{roundId:round.id,playerId:p.id,index:i,value:n})}/>:<span className={'point-pill '+(p.points[i]===1?'positive':'')}>{p.points[i]}</span>}</div>)}</section>)}</div><div className="review-actions">{host?<><button className="primary" disabled={busy||state.roundCount>=50} onClick={()=>command('start')}>Következő kör <ChevronRight size={21}/></button><button className="secondary" disabled={busy} onClick={e=>openExit('finish',e.currentTarget)}>Játék befejezése</button></>:<div className="waiting">A házigazda indítja a következő kört.</div>}</div></>}
    {state.phase==='finished'&&<div className="final panel"><span className="winner-icon"><Trophy size={52}/></span><div className="eyebrow">{state.roundCount} KÖR UTÁN</div><h1>{tied.length>1?'Döntetlen!':`${leader?.name||'A társaság'} nyert!`}</h1><p>{tied.map((p)=>p.name).join(' · ')}</p><div className="winner-points">{leader?.total||0}<span>PONT</span></div><button className="primary" onClick={()=>openExit('leave',document.activeElement,'home')}><RotateCcw size={19}/> Új társaság, új játék</button></div>}
   </section>
   <aside className="players panel"><div className="players-title"><h2>{state.phase==='lobby'?'A társaság':'Állás'}</h2><span><Users size={16}/>{state.players.length}/20</span></div><div className="player-list">{ranking.map((p,i)=><div className="player" key={p.id}><span className={'avatar color-'+i%5}>{p.name.slice(0,1).toLocaleUpperCase('hu')}</span><div className="player-name"><strong>{p.name}</strong><small>{p.id===state.host?<><Crown size={12}/> Házigazda</>:p.id===state.you?'Te':state.phase==='playing'?(round.players.find((x)=>x.id===p.id)?.submitted?'Beküldve':'Még gondolkodik…'):`${i+1}. hely`}</small></div>{state.phase!=='lobby'&&(host&&state.phase==='review'&&round.players.some((x)=>x.id===p.id)?<ScoreInput label={`${p.name} összpontszáma`} max={10000} value={p.total} onSave={n=>command('score',{roundId:round.id,playerId:p.id,value:n})}/>:<span className="total-points">{p.total}<small>pont</small></span>)}{host&&p.id!==state.host&&state.phase!=='finished'&&<button className="kick-button" aria-label={`${p.name} eltávolítása`} title="Eltávolítás" onClick={()=>setKick(p)}><X size={16}/></button>}</div>)}</div>{host&&state.phase==='review'&&<p className="side-note">Az összpontot is átírhatod.<br/>Minden játékosnál külön mentjük.</p>}<div className="scoring"><span>PONTOZÁS</span><div><b>1</b> egyedi válasz</div><div><b>0</b> azonos válasz</div><div><b>0</b> üres válasz</div></div>{state.phase==='lobby'&&state.players.length===1&&<p className="side-note">Még csak te vagy itt.<br/>Hívd meg a többieket!</p>}</aside>
   </div>
  </>}
  <footer><span>ORSZÁG–VÁROS / DARKROOM</span></footer>
  {rules&&<div className="modal-backdrop" onClick={()=>setRules(false)}><section className="modal panel" role="dialog" aria-modal="true" aria-labelledby="rules-title" onClick={e=>e.stopPropagation()}><button autoFocus className="modal-close icon-button" aria-label="Bezárás" onClick={()=>setRules(false)}><X/></button><div className="eyebrow">JÁTÉKSZABÁLY</div><h2 id="rules-title">Egy betű, hét válasz.</h2><ol><li>A házigazda létrehoz egy szobát. A többiek becenévvel és a hatjegyű kóddal belépnek.</li><li>Minden körben új betűt és 7 különböző témát sorsolunk. A betűk egy teljes sorozaton belül nem ismétlődnek.</li><li>Írjatok a kisorsolt betűvel kezdődő, legalább 3 betűből álló válaszokat! A szóközök, számok és írásjelek nem számítanak betűnek. Az ékezetpárok egyenértékűek: A/Á, E/É, I/Í, O/Ó/Ö/Ő, U/Ú/Ü/Ű.</li><li>A beküldés lezárja a saját válaszaidat. Ha mindenki kész, az idő lejár, vagy a házigazda lezárja, jön a pontozás.</li><li>Egyedi válasz: 1 pont. Azonos válasz: 0 pont. Üres, 3 betűnél rövidebb vagy rossz kezdőbetűjű válasz: 0 pont. Kis- és nagybetű, ékezet és felesleges szóköz nem számít eltérésnek.</li><li>A témába illő válaszokat közösen bíráljátok el. A házigazda a kör végén válaszonként vagy összpontban javíthat, és játékost is eltávolíthat.</li></ol><p>A szoba 24 óráig él. Új játékos két kör között csatlakozhat. Újratöltéskor ugyanabban a böngészőfülben visszatérhetsz.</p><button className="primary" onClick={()=>setRules(false)}>Értem, játsszunk <ArrowRight size={18}/></button></section></div>}
  {exitAction&&<div className="modal-backdrop" onClick={()=>{if(!exitPending.current)setExitAction(null);}}><section className="modal panel" role="dialog" aria-modal="true" aria-labelledby="exit-title" aria-describedby="exit-description" aria-busy={busy} onClick={e=>e.stopPropagation()}><h2 id="exit-title">{exitAction==='leave'?(host?'Lezárod a játékot és kilépsz?':'Kilépsz a szobából?'):'Befejezed a játékot?'}</h2><p id="exit-description">{exitAction==='leave'?(host?'A szoba játéka lezárul. A többiek látják a végeredményt, te kilépsz.':!state?'Kilépsz a szobából. Házigazdaként ezzel a társaság játékát is lezárod.':'Kilépsz a szobából. A többiek játéka folytatódhat.'):'Minden játékosnál lezárul a játék, és megjelenik a végeredmény.'}</p>{exitError&&<p className="exit-error" role="alert">{exitError}</p>}<div className="review-actions"><button className="secondary" autoFocus disabled={busy} onClick={()=>setExitAction(null)}>Mégsem</button><button className="primary" disabled={busy} onClick={confirmExit}>{busy?'Egy pillanat…':exitAction==='leave'?(host?'Lezárás és kilépés':'Kilépés'):'Befejezés'}<LogOut size={18}/></button></div></section></div>}
  {kick&&<div className="modal-backdrop"><section className="modal panel" role="dialog" aria-modal="true" aria-labelledby="kick-title"><h2 id="kick-title">Eltávolítod {kick.name} játékost?</h2><p>Nem vesz részt a következő körökben. Az eddigi válaszai és pontjai megmaradnak.</p><div className="review-actions"><button className="secondary" autoFocus onClick={()=>setKick(null)}>Mégsem</button><button className="primary" disabled={busy} onClick={async()=>{if(await command('kick',{playerId:kick.id}))setKick(null);}}>Eltávolítás <X size={18}/></button></div></section></div>}
 </main></div>;
});

export default DarkroomPage;
