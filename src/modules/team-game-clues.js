/**
 * Indices du « Qui est-ce ? » pour une page.
 *  1. data.pages[clé]  : indices rédigés pour cette page (export du CMS « Indices du jeu ») ;
 *  2. data.teams[clé]  : pas d'indices rédigés, mais l'équipe dédiée de la page (CMS Besoins / Secteurs, champ equipe-dediee) est connue :
 *                        on fabrique 3 indices génériques dont les cartes écartées sont, dans l'ordre de data.generic.priority, celles
 *                        qui ne sont pas dans l'équipe — l'équipe qui reste à la fin est donc bien celle de la page ;
 *  3. data.fallback    : dernier recours (page inconnue) : indices d'une autre page.
 * Module pur (aucun accès au DOM) : smf-kit/scripts/check-game-data.mjs l'importe pour valider les données.
 */
function splitGroups(list) {
  const n = list.length;
  const a = Math.max(1, Math.round(n / 2));
  const b = Math.max(1, Math.round(((n - a) * 2) / 3));
  return [list.slice(0, a), list.slice(a, a + b), list.slice(a + b)].filter((group) => group.length);
}

function generic(data, key, team, roster) {
  const kind = key.split('/')[0];
  const texts = data.generic?.[kind] || data.generic?.default || [];
  const order = [...(data.generic?.priority || []), ...roster];
  const rest = [...new Set(order)].filter((slug) => roster.includes(slug) && !team.includes(slug));
  return splitGroups(rest).map((out, i) => ({ text: texts[i] || texts[texts.length - 1] || 'Ils sont dans l’équipe, pas de doute.', out }));
}

/** @returns {{ clues: {text: string, out: string[]}[] | null, source: 'pages' | 'teams' | 'fallback' }} */
export function cluesFor(data, key, roster) {
  if (data.pages[key]) return { clues: data.pages[key], source: 'pages' };
  const team = (data.teams?.[key] || []).filter((slug) => roster.includes(slug));
  if (team.length >= 2) return { clues: generic(data, key, team, roster), source: 'teams' };
  return { clues: data.pages[data.fallback] || null, source: 'fallback' };
}
