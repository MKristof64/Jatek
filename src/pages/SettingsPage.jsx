import { Moon, RotateCcw, ShieldCheck, Volume2, Vibrate } from 'lucide-react';
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
      <section className="flex flex-1 flex-col gap-3">
        {notice ? (
          <p className="rounded-2xl border border-lime-200/20 bg-lime-300/10 px-4 py-3 text-sm font-bold text-lime-50">
            {notice}
          </p>
        ) : null}

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
          label="Rezgés"
          description="Finom haptikus jelzés támogatott telefonokon."
          checked={settings.vibration}
          onChange={(value) => updateSetting('vibration', value, 'Rezgés')}
          icon={Vibrate}
        />
        <SettingsToggle
          label="Biztonságos mód"
          description="Csak ártalmatlan, könnyen vállalható feladatok."
          checked={settings.safeMode}
          onChange={(value) =>
            updateSetting('safeMode', value, 'Biztonságos mód')
          }
          icon={ShieldCheck}
        />

        <div className="mt-auto rounded-3xl border border-rose-200/18 bg-rose-400/10 p-4">
          <p className="text-base font-black text-rose-50">Adatok törlése</p>
          <p className="mt-1 text-sm leading-6 text-rose-50/70">
            Törli a játékosokat, a saját paklit és visszaállítja a beállításokat.
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
      </section>
    </>
  );
}
