import { cards } from '../src/data/cards.js';
import { modes } from '../src/data/modes.js';

const modeIds = new Set(modes.map((mode) => mode.id));
const allowedKinds = new Set(['never', 'duel', 'roundtable']);
const ids = new Set();
const issues = [];

modes.forEach((mode) => {
  if (!mode.id) issues.push('Mode is missing id');
  if (!mode.name) issues.push(`Mode ${mode.id} is missing name`);
  if (!mode.type) issues.push(`Mode ${mode.id} is missing type`);
  if (!mode.icon) issues.push(`Mode ${mode.id} is missing icon`);
});

cards.forEach((card) => {
  if (!card.id) {
    issues.push(`Card is missing id: ${JSON.stringify(card)}`);
    return;
  }

  if (ids.has(card.id)) issues.push(`Duplicate card id: ${card.id}`);
  ids.add(card.id);

  if (!modeIds.has(card.mode)) issues.push(`Unknown mode "${card.mode}" on ${card.id}`);
  if (!allowedKinds.has(card.kind)) issues.push(`Unknown kind "${card.kind}" on ${card.id}`);
  if (!String(card.title ?? '').trim()) issues.push(`Empty title on ${card.id}`);
  if (!String(card.text ?? '').trim()) issues.push(`Empty text on ${card.id}`);

  if (
    card.durationSeconds != null &&
    (!Number.isFinite(card.durationSeconds) || card.durationSeconds < 0 || card.durationSeconds > 120)
  ) {
    issues.push(`Invalid duration ${card.durationSeconds} on ${card.id}`);
  }
});

const summary = modes.map((mode) => ({
  mode: mode.id,
  cards: cards.filter((card) => card.mode === mode.id).length,
  never: cards.filter((card) => card.mode === mode.id && card.kind === 'never').length,
  duel: cards.filter((card) => card.mode === mode.id && card.kind === 'duel').length,
  roundtable: cards.filter((card) => card.mode === mode.id && card.kind === 'roundtable').length,
}));

console.table(summary);

if (issues.length > 0) {
  console.error(issues.join('\n'));
  process.exit(1);
}

console.log(`Validated ${cards.length} cards across ${modes.length} modes.`);
