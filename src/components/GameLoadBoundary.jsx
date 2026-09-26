import { Component } from 'react';

export default class GameLoadBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="grid min-h-dvh place-items-center bg-[#120b18] p-6 text-white">
        <div className="w-full max-w-sm rounded-3xl border border-white/15 bg-white/5 p-6">
          <h1 className="text-2xl font-black">A játék nem töltődött be.</h1>
          <p className="mt-3 text-white/70">Próbáld újratölteni. A szobádhoz utána újra kapcsolódunk.</p>
          <button type="button" className="mt-5 min-h-12 w-full rounded-2xl bg-rose-400 px-4 font-bold text-slate-950" onClick={() => window.location.reload()}>Újratöltés</button>
          <button type="button" className="mt-3 min-h-12 w-full rounded-2xl border border-white/20 px-4 font-bold" onClick={this.props.onBack}>Játék választása</button>
        </div>
      </main>
    );
  }
}
