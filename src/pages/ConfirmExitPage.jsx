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
      <section className="flex flex-1 flex-col justify-between gap-5">
        <div className="rounded-[2rem] border border-white/12 bg-slate-950/58 p-5 shadow-card backdrop-blur">
          <div className="mb-5 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-amber-300 to-pink-500 text-slate-950 shadow-glow">
            <Icon className="h-8 w-8" />
          </div>
          <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-100/76">
            Megerősítés
          </p>
          <h2 className="mt-2 text-4xl font-black leading-none text-white">
            Biztos vagy benne?
          </h2>
          <p className="mt-4 text-base font-bold leading-7 text-white/68">
            {content.text}
          </p>
        </div>

        <div className="space-y-3">
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
