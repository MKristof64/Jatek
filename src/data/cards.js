import { boldSpicyCards } from './boldSpicyCards.js';
import { classicFunnyCards } from './classicFunnyCards.js';
import { hardcoreCards } from './hardcoreCards.js';

export const cards = [
  ...classicFunnyCards,
  ...boldSpicyCards,
  ...hardcoreCards,
  { id: 'team-01', mode: 'team', text: '{player}, válassz csapattársat, és találjatok ki közösen egy kézfogást', safe: true },
  { id: 'team-02', mode: 'team', text: '{player}, a jobb oldaladon ülővel mondjatok felváltva öt városnevet', safe: true },
  { id: 'team-03', mode: 'team', text: '{player}, két csapat vitassa meg 30 másodpercig: reggeli vagy vacsora a jobb?', safe: true },
  { id: 'team-04', mode: 'team', text: '{player}, válassz valakit, akivel egyszerre mutattok egy pózt. A többiek adjanak címet neki', safe: true },
  { id: 'team-05', mode: 'team', text: '{player}, indíts lánctörténetet egy mondattal, mindenki tegyen hozzá egy szót', safe: true },
  { id: 'team-06', mode: 'team', text: '{player}, kérj két önkéntest egy 15 másodperces némás jelenethez', safe: true },
  { id: 'team-07', mode: 'team', text: '{player}, a társaság szavazzon: melyik két ember alkotná a legviccesebb kvízcsapatot?', safe: true },
  { id: 'team-08', mode: 'team', text: '{player}, válaszd {target}-t csapattársnak egy villám asszociációs körre', safe: true },
];
