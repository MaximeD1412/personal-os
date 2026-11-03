import { Marked } from 'marked';

/**
 * Le rendu du texte publié, écrit en markdown. Le HTML écrit dans le texte
 * s'affiche comme du texte ; le HTML produit passe ensuite par l'assainisseur
 * d'Angular (`[innerHTML]`).
 */
const rendu = new Marked({
  gfm: true,
  async: false,
  renderer: { html: ({ text }) => echapper(text) },
});

export function rendreLeMarkdown(texte: string): string {
  return texte.trim() ? rendu.parse(texte, { async: false }) : '';
}

function echapper(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
