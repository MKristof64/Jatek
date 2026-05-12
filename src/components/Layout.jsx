export default function Layout({ children, darkMode = true }) {
  const background = darkMode
    ? 'from-[#090018] via-[#25004d] to-[#5a0038]'
    : 'from-[#fff7ed] via-[#fdf2f8] to-[#ecfeff]';
  const themeClass = darkMode ? 'theme-dark' : 'theme-light';

  return (
    <div className={themeClass}>
      <main
        className={[
          'party-bg min-h-screen bg-gradient-to-br transition-colors',
          background,
          darkMode ? 'text-white' : 'text-[#20112d]',
        ].join(' ')}
      >
        <div className="mx-auto flex min-h-screen w-full max-w-[430px] flex-col px-4 py-5 safe-bottom">
          {children}
        </div>
      </main>
    </div>
  );
}
