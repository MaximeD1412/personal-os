import { Marked } from 'marked';

/**
 * Le rendu des notes d'un Projet, écrites en markdown (GitHub : listes de
 * tâches, tableaux, liens nus). Le HTML produit passe ensuite par
 * l'assainisseur d'Angular (`[innerHTML]`), qui retire ce qu'il ne connaît
 * pas.
 *
 * Trois écarts au rendu par défaut : le HTML écrit dans les notes s'affiche
 * comme du texte ; une case à cocher devient « ☑ » ou « ☐ », qu'un
 * `<input>` désactivé n'aurait pas survécu à l'assainissement ; et sa ligne
 * porte la classe `tache`, pour que l'écran la montre sans puce.
 */
const rendu = new Marked({
  gfm: true,
  async: false,
  renderer: {
    html: ({ text }) => echapper(text),
    checkbox: ({ checked }) => (checked ? '☑ ' : '☐ '),
    // `false` rend la main au rendu par défaut.
    listitem(item) {
      return item.task
        ? `<li class="tache">${this.parser.parse(item.tokens)}</li>\n`
        : false;
    },
  },
});

export function rendreLeMarkdown(notes: string): string {
  if (!notes.trim()) {
    return '';
  }
  return rendu.parse(notes, { async: false });
}

function echapper(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
