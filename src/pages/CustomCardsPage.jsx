import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import Header from '../components/Header.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';

export default function CustomCardsPage({
  customCards,
  onAddCard,
  onDeleteCard,
  onBack,
}) {
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const handleSubmit = (event) => {
    event.preventDefault();
    const trimmedText = text.trim();
    if (!trimmedText) return;
    const error = onAddCard(trimmedText);
    if (error) {
      setMessage(error);
      return;
    }

    setText('');
    setMessage('');
  };

  const confirmDelete = () => {
    if (pendingDeleteId) onDeleteCard(pendingDeleteId);
    setPendingDeleteId(null);
  };

  return (
    <>
      <Header title="Saját pakli" onBack={onBack} compact />
      <section className="flex min-h-0 flex-1 flex-col gap-4">
        <form
          onSubmit={handleSubmit}
          className="shrink-0 rounded-[1.75rem] border border-white/10 bg-white/10 p-4"
        >
          <label
            htmlFor="custom-card"
            className="mb-2 block text-sm font-black uppercase tracking-[0.18em] text-amber-100/76"
          >
            Új feladat
          </label>
          <textarea
            id="custom-card"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Példa: {player}, találj ki egy közös csapatnevet {target} segítségével."
            maxLength={180}
            rows={4}
            className="party-field w-full resize-none rounded-3xl p-4 text-[16px] font-bold leading-6 outline-none transition"
          />
          <p className="mt-2 text-xs leading-5 text-white/48">
            Használható: {'{player}'} az aktuális játékoshoz, {'{target}'} egy
            véletlen másik játékoshoz.
          </p>
          <PrimaryButton type="submit" icon={Plus} className="mt-4">
            Hozzáadás
          </PrimaryButton>
        </form>

        {message ? (
          <p
            role="alert"
            className="shrink-0 rounded-2xl bg-rose-500/16 px-4 py-3 text-sm font-bold text-rose-50 ring-1 ring-rose-200/20"
          >
            {message}
          </p>
        ) : null}

        <div className="mobile-scroll min-h-0 flex-1 space-y-2 overflow-y-auto pb-1 pr-1">
          {customCards.length === 0 ? (
            <p className="rounded-3xl bg-white/8 p-5 text-center text-sm leading-6 text-white/58">
              Nincs még saját feladat. Hozz létre egyet, és megjelenik a saját
              pakliban.
            </p>
          ) : (
            customCards.map((card, index) => (
              <article
                key={card.id}
                className="flex gap-3 rounded-3xl border border-white/10 bg-white/10 p-4"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-300 to-pink-500 text-sm font-black text-slate-950">
                  {index + 1}
                </span>
                <p className="min-w-0 flex-1 text-sm font-bold leading-6 text-white/82">
                  {card.text}
                </p>
                <button
                  type="button"
                  onClick={() => setPendingDeleteId(card.id)}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-400/14 text-rose-100 ring-1 ring-rose-200/20"
                  aria-label="Saját feladat törlése"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              </article>
            ))
          )}
        </div>
      </section>

      {pendingDeleteId ? (
        <ConfirmDialog
          title="Törlöd ezt a kártyát?"
          description="A kártya végleg eltűnik a saját paklidból."
          confirmLabel="Törlés"
          onCancel={() => setPendingDeleteId(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </>
  );
}
