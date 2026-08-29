import { Check, Monitor, RotateCcw } from 'lucide-react';
import { landscapeRatios } from '../data/displayRatios.js';

export default function LandscapeRatioPicker({ value, onChange }) {
  return (
    <section className="orientation-picker" aria-labelledby="orientation-picker-title">
      <div className="orientation-picker-heading">
        <span className="orientation-picker-icon" aria-hidden="true">
          <Monitor />
        </span>
        <span className="min-w-0 flex-1">
          <span id="orientation-picker-title" className="orientation-picker-title">
            Fekvő játéknézet
          </span>
          <span className="orientation-picker-description">
            Válassz képarányt a fekvő elrendezéshez.
          </span>
        </span>
        <span className="orientation-picker-status">
          {value ? `${value} aktív` : 'Álló'}
        </span>
      </div>

      <div className="orientation-option-grid" role="group" aria-label="Fekvő képarány">
        {landscapeRatios.map((ratio) => {
          const selected = value === ratio.id;

          return (
            <button
              key={ratio.id}
              type="button"
              aria-pressed={selected}
              aria-label={`${ratio.id}, ${ratio.label}. ${ratio.description}${selected ? '. Aktív, újabb megnyomással visszaáll álló nézetre' : ''}`}
              className={`orientation-option${selected ? ' orientation-option--selected' : ''}`}
              onClick={() => onChange(ratio.id)}
              style={{ '--orientation-preview-ratio': ratio.cssRatio }}
            >
              <span className="orientation-preview" aria-hidden="true">
                <span className="orientation-preview-player" />
                <span className="orientation-preview-copy">
                  <span />
                  <span />
                </span>
                <span className="orientation-preview-action" />
              </span>
              <span className="orientation-option-copy">
                <span className="orientation-option-ratio">{ratio.id}</span>
                <span className="orientation-option-label">{ratio.label}</span>
                <span className="orientation-option-description">{ratio.description}</span>
              </span>
              <span className="orientation-option-check" aria-hidden="true">
                {selected ? <Check /> : null}
              </span>
            </button>
          );
        })}
      </div>

      <p className="orientation-picker-help">
        <RotateCcw aria-hidden="true" />
        Az aktív képarányra újra koppintva visszaáll az alap álló nézet.
      </p>
    </section>
  );
}
