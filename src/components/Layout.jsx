export default function Layout({ children, darkMode = true }) {
  const background = darkMode
    ? 'from-[#080011] via-[#3a001f] to-[#7a0736]'
    : 'from-[#fff3e7] via-[#fff0f4] to-[#ffe4ec]';
  const themeClass = darkMode ? 'theme-dark' : 'theme-light';

  return (
    <div className={themeClass}>
      <main
        className={[
          'party-bg app-shell overflow-x-hidden bg-gradient-to-br transition-colors',
          background,
          darkMode ? 'text-white' : 'text-[#20112d]',
        ].join(' ')}
      >
        <div className="phone-frame mx-auto flex w-full max-w-[430px] flex-col">
          {children}
        </div>
      </main>
    </div>
  );
}
