export function initialGameFromSearch(search = '') {
  const params = new URLSearchParams(search);
  return params.get('jatek') === 'darkroom' ? 'darkroom' : 'drinking';
}

export function gameLocation(href, gameId) {
  const url = new URL(href);
  url.searchParams.delete('szoba');
  if (gameId === 'darkroom') url.searchParams.set('jatek', 'darkroom');
  else url.searchParams.delete('jatek');
  return url.pathname + url.search + url.hash;
}
