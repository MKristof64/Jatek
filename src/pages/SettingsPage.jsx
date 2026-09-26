import { ChevronRight, Gamepad2, Moon, RefreshCw, RotateCcw, Save, UsersRound } from 'lucide-react';
import { useState } from 'react';
import Header from '../components/Header.jsx';
import LandscapeRatioPicker from '../components/LandscapeRatioPicker.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';
import SettingsToggle from '../components/SettingsToggle.jsx';

export default function SettingsPage({
  settings,
  onToggle,
  onLandscapeRatioChange,
  onClearData,
  onChooseGame,
  onBack,
}) {
  const [notice, setNotice] = useState('');

  const updateSetting = (key, value, label) => {
    onToggle(key, value);
    setNotice(`${label}: ${value ? 'bekapcsolva' : 'kikapcsolva'}`);
  };

  const updateLandscapeRatio = async (ratio) => {
    const nextRatio = await onLandscapeRatioChange(ratio);
    setNotice(
      nextRatio
        ? `${nextRatio} fekvő nézet bekapcsolva`
        : 'Alap álló nézet visszaállítva',
    );
  };

  return (
    <>
      <Header title="Beállítások" onBack={onBack} compact />
      <section className="flex min-h-0 flex-1 flex-col gap-3">
        {notice ? (
          <p className="shrink-0 rounded-2xl border border-lime-200/20 bg-lime-300/10 px-4 py-3 text-sm font-bold text-lime-50">
            {notice}
          </p>
        ) : null}

        <div className="mobile-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pb-1 pr-1">
          <SettingsToggle
            label="Sötét mód"
            description="Kontrasztos, bulis éjszakai felület."
            checked={settings.darkMode}
            onChange={(value) => updateSetting('darkMode', value, 'Sötét mód')}
            icon={Moon}
          />
          <SettingsToggle
            label="Játék mentése"
            description="Megőrzi a játékosokat, a haladást és a kijátszott kártyákat."
            checked={settings.saveGames}
            onChange={(value) => updateSetting('saveGames', value, 'Játék mentése')}
            icon={Save}
          />
          <SettingsToggle
            label="Páros kártyák"
            description="Két játékost érintő extra kártyák a pakliban."
            checked={settings.includeDuelCards}
            onChange={(value) =>
              updateSetting('includeDuelCards', value, 'Páros kártyák')
            }
            icon={UsersRound}
          />
          <SettingsToggle
            label="Körbemenős"
            description="Mindenkit bevonó, körben haladó extra kártyák."
            checked={settings.includeRoundtableCards}
            onChange={(value) =>
              updateSetting('includeRoundtableCards', value, 'Körbemenős')
            }
            icon={RefreshCw}
          />

          <LandscapeRatioPicker
            value={settings.landscapeRatio}
            onChange={(ratio) => void updateLandscapeRatio(ratio)}
          />

          <div className="rounded-3xl border border-rose-200/18 bg-rose-400/10 p-4">
            <p className="text-base font-black text-rose-50">Adatok törlése</p>
            <p className="mt-1 text-sm leading-6 text-rose-50/70">
              Törli a játékosokat, a korábbi játékokat és visszaállítja az
              alapbeállításokat.
            </p>
            <PrimaryButton
              variant="danger"
              icon={RotateCcw}
              className="mt-4"
              onClick={onClearData}
            >
              Minden adat törlése
            </PrimaryButton>
          </div>

          <button
            type="button"
            onClick={onChooseGame}
            className="flex min-h-20 w-full touch-manipulation items-center gap-3 rounded-3xl border border-amber-200/25 bg-gradient-to-br from-amber-300/15 via-orange-400/10 to-rose-400/15 p-4 text-left shadow-card transition hover:brightness-110 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-200"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-300/15 text-amber-200">
              <Gamepad2 aria-hidden="true" className="h-6 w-6" />
            </span>
            <span className="min-w-0 flex-1 text-base font-black leading-6 text-white">
              Másik játék választása
            </span>
            <ChevronRight aria-hidden="true" className="h-5 w-5 shrink-0 text-amber-200" />
          </button>
        </div>
      </section>
    </>
  );
}
