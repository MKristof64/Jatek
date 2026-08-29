export const landscapeRatios = Object.freeze([
  {
    id: '16:9',
    cssRatio: '16 / 9',
    numericRatio: 16 / 9,
    label: 'Szélesvásznú',
    description: 'Monitorok, TV-k, YouTube és háttérképek',
  },
  {
    id: '4:3',
    cssRatio: '4 / 3',
    numericRatio: 4 / 3,
    label: 'Klasszikus',
    description: 'Klasszikus fotó- és kijelzőarány',
  },
  {
    id: '3:2',
    cssRatio: '3 / 2',
    numericRatio: 3 / 2,
    label: 'Fotós',
    description: 'Fényképezőgépek és fotók tipikus aránya',
  },
  {
    id: '16:10',
    cssRatio: '16 / 10',
    numericRatio: 16 / 10,
    label: 'Laptop',
    description: 'Laptopokon és monitorokon gyakori',
  },
]);

export function getLandscapeRatio(value) {
  return landscapeRatios.find((ratio) => ratio.id === value) ?? null;
}

export function normalizeLandscapeRatio(value) {
  return getLandscapeRatio(value)?.id ?? null;
}

export function toggleLandscapeRatio(currentValue, requestedValue) {
  const currentRatio = normalizeLandscapeRatio(currentValue);
  const requestedRatio = normalizeLandscapeRatio(requestedValue);

  if (!requestedRatio) return currentRatio;
  return currentRatio === requestedRatio ? null : requestedRatio;
}
