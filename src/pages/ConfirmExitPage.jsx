import { Home, LogOut, Undo2 } from 'lucide-react';
import Header from '../components/Header.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';

const copy = {
  exit: {
    title: 'Kilépés?',
    text: 'Visszalépsz a módválasztóhoz. A jelenlegi játékállapot nem folytatódik tovább.',
    confirm: 'Kilépés megerősítése',
    icon: LogOut,
  },
  home: {
    title: 'Főoldal?',
    text: 'Visszatérsz a főoldalra. Ha véletlenül nyomtad meg, válaszd a Mégse gombot.',
    confirm: 'Főoldal megnyitása',
    icon: Home,
  },
};

export default function ConfirmExitPage({ intent, onCancel, onConfirm }) {
  const content = copy[intent] ?? copy.exit;
  const Icon = content.icon;

  return (
    <>
      <Header title={content.title} onBack={onCancel} compact />
      <section className="flex min-h-0 flex-1 flex-col justify-between gap-4">
        <div className="rounded-[1.75rem] border border-white/12 bg-slate-950/58 p-4 shadow-card backdrop-blur min-[390px]:p-5">
          <div className="mb-4 grid h-14 w-14 place-items-center rounded-3xl bg-gradient-to-br from-amber-300 to-pink-500 text-slate-950 shadow-glow min-[390px]:mb-5 min-[390px]:h-16 min-[390px]:w-16">
            <Icon className="h-8 w-8" />
          </div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-100/76">
            Megerősítés
          </p>
          <h2 className="mt-2 text-3xl font-black leading-none text-white min-[390px]:text-4xl">
            Biztos vagy benne?
          </h2>
          <p className="mt-4 text-base font-bold leading-7 text-white/68">
            {content.text}
          </p>
        </div>

        <div className="shrink-0 space-y-3">
          <PrimaryButton icon={Undo2} onClick={onCancel}>
            Mégse
          </PrimaryButton>
          <PrimaryButton variant="danger" icon={Icon} onClick={onConfirm}>
            {content.confirm}
          </PrimaryButton>
        </div>
      </section>
    </>
  );
}
