import { Sparkles } from 'lucide-react';

export default function AppIntro({ leaving = false }) {
  return (
    <div
      className={['app-boot', leaving ? 'app-boot--leaving' : ''].filter(Boolean).join(' ')}
      role="status"
      aria-label="A játék betöltése"
    >
      <div className="app-boot__rail app-boot__rail--top" aria-hidden="true" />
      <div className="app-boot__rail app-boot__rail--bottom" aria-hidden="true" />
      <div className="app-boot__content">
        <div className="app-boot__mark" aria-hidden="true">
          <Sparkles className="h-10 w-10" />
        </div>
        <p className="app-boot__eyebrow">Én még sosem...</p>
        <p className="app-boot__title">Az ivós játék</p>
        <span className="app-boot__meter" aria-hidden="true">
          <span />
        </span>
      </div>
    </div>
  );
}
