import { Moon, RefreshCw, RotateCcw, UsersRound, Volume2 } from 'lucide-react';
import { useState } from 'react';
import Header from '../components/Header.jsx';
import PrimaryButton from '../components/PrimaryButton.jsx';
import SettingsToggle from '../components/SettingsToggle.jsx';

export default function SettingsPage({
  settings,
  onToggle,
  onClearData,
  onBack,
}) {
  const [notice, setNotice] = useState('');

  const updateSetting = (key, value, label) => {
    onToggle(key, value);
    setNotice(`${label}: ${value ? 'bekapcsolva' : 'kikapcsolva'}`);
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
            label="Hang"
            description="Rövid visszajelzés kártyaváltásnál."
            checked={settings.sound}
            onChange={(value) => updateSetting('sound', value, 'Hang')}
            icon={Volume2}
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

          <div className="rounded-3xl border border-rose-200/18 bg-rose-400/10 p-4">
            <p className="text-base font-black text-rose-50">Adatok törlése</p>
            <p className="mt-1 text-sm leading-6 text-rose-50/70">
              Törli a játékosokat és visszaállítja az alapbeállításokat.
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
        </div>
      </section>
    </>
  );
}
