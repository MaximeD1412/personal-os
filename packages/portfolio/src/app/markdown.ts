import { Marked, type Token } from 'marked';

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

/**
 * Le premier paragraphe d'un texte publié, en texte brut : sans balises ni
 * syntaxe markdown, les espaces ramenés à un seul. Lu dans les jetons du
 * markdown, sans rendu ni document.
 */
export function premierParagrapheDuMarkdown(texte: string): string {
  const paragraphe = rendu
    .lexer(texte)
    .find((jeton) => jeton.type === 'paragraph');
  return paragraphe && 'tokens' in paragraphe && paragraphe.tokens
    ? texteBrut(paragraphe.tokens).replace(/\s+/g, ' ').trim()
    : '';
}

function texteBrut(jetons: readonly Token[]): string {
  return jetons
    .map((jeton) => {
      if ('tokens' in jeton && jeton.tokens?.length) {
        return texteBrut(jeton.tokens);
      }
      if (jeton.type === 'br') {
        return ' ';
      }
      return 'text' in jeton && typeof jeton.text === 'string'
        ? jeton.text
        : '';
    })
    .join('');
}

function echapper(texte: string): string {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
