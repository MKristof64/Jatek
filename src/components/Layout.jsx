import { getLandscapeRatio } from '../data/displayRatios.js';

export default function Layout({
  children,
  darkMode = true,
  gameMode = false,
  immersiveMode = false,
  devMotion = false,
  landscapeRatio = null,
}) {
  const background = darkMode
    ? 'from-[#080011] via-[#3a001f] to-[#7a0736]'
    : 'from-[#fff3e7] via-[#fff0f4] to-[#ffe4ec]';
  const isImmersive = immersiveMode || gameMode;
  const landscapePreset = getLandscapeRatio(landscapeRatio);
  const themeClass = [
    darkMode ? 'theme-dark' : 'theme-light',
    isImmersive ? 'app-immersive-mode' : '',
    gameMode ? 'app-game-mode' : '',
    devMotion ? 'app-dev-motion' : '',
    landscapePreset ? 'app-landscape-layout' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={themeClass}
      data-landscape-ratio={landscapePreset?.id ?? undefined}
      style={
        landscapePreset
          ? { '--app-landscape-ratio': landscapePreset.numericRatio }
          : undefined
      }
    >
      <main
        className={[
          'party-bg app-shell overflow-x-hidden bg-gradient-to-br transition-colors',
          background,
          darkMode ? 'text-white' : 'text-[#20112d]',
        ].join(' ')}
      >
        <div
          className={[
            'phone-frame mx-auto flex w-full flex-col',
            landscapePreset ? 'party-bg phone-frame--ratio-canvas' : '',
            gameMode
              ? 'phone-frame--game phone-frame--immersive max-w-none'
              : isImmersive
                ? 'phone-frame--immersive max-w-none'
                : 'max-w-[430px]',
          ].join(' ')}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
