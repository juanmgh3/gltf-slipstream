// Global quality preset (T14). One radiogroup, three presets; the active option is
// the live thing and carries the amber (accent fill + ink, per the accent rule).

import type { QualityPreset } from '../optimizer/types';

const PRESETS: QualityPreset[] = ['maximum', 'balanced', 'aggressive'];

interface ControlsProps {
  preset: QualityPreset;
  onPreset: (preset: QualityPreset) => void;
}

export function Controls({ preset, onPreset }: ControlsProps) {
  return (
    <fieldset class="controls" aria-label="Quality preset">
      <legend class="ct-legend">Preset</legend>
      <div class="ct-options">
        {PRESETS.map((option) => (
          <label key={option} class={`ct-option${option === preset ? ' is-active' : ''}`}>
            <input
              class="ct-input"
              type="radio"
              name="preset"
              value={option}
              checked={option === preset}
              onChange={() => onPreset(option)}
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
