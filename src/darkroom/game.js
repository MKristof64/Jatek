export const TOPICS = ['Alkoholmárka', 'Pornóműfaj', 'Szexpóz', 'Fétis fajta', 'Színész/színésznő', 'Szexjáték (tárgy)', 'Red flag', 'Random dolog egy kocsmában', 'Becenév partnernek', 'Pornóoldal', 'Kocsma neve', 'Escortnév', 'Szerepjátékfajta', 'Random pajzán szó', 'Ország', 'Város', 'Állat', 'Random bolt', 'Autómárka', 'Kétértelmű szó', 'Férfi név', 'Női név', 'Foglalkozás', 'Szakítás oka', 'Random étel', 'Ami az exedre emlékeztet'];
export const normalize = value => String(value).trim().toLocaleLowerCase('hu').normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ');
export function isValidAnswer(value, letter) {
  const answer = normalize(value || '');
  return answer.startsWith(normalize(letter)) && (answer.match(/\p{L}/gu) || []).length >= 3;
}
