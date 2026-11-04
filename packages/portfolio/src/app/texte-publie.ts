import {
  Component,
  computed,
  inject,
  input,
  SecurityContext,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { rendreLeMarkdown } from './markdown';

/**
 * Un texte publié, rendu depuis son markdown. Ses images se décodent à
 * part, sans retenir l'affichage de la page ; leur cadre (16:9, l'image
 * entière dedans) est réservé avant qu'elles n'arrivent, si bien que rien
 * ne bouge autour.
 * Le chapô (`variante="chapo"`) est le texte d'ouverture, en plus grand.
 */
@Component({
  selector: 'pos-texte-publie',
  host: {
    class:
      'flex flex-col gap-space-sm text-on-surface-variant [&_a]:text-primary [&_a]:underline [&_blockquote]:border-s-2 [&_blockquote]:border-outline-variant [&_blockquote]:ps-space-sm [&_code]:font-mono [&_code]:text-code-mono [&_h1]:text-headline-md [&_h1]:text-on-surface [&_h2]:mt-space-md [&_h2]:text-headline-md [&_h2]:text-on-surface [&_h3]:mt-space-sm [&_h3]:text-title-sm [&_h3]:text-on-surface [&_h3:first-child]:mt-0 [&_h2:first-child]:mt-0 [&_ol]:list-decimal [&_ol]:ps-gutter [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-surface-container-low [&_pre]:p-space-sm [&_strong]:text-on-surface [&_ul]:list-disc [&_ul]:ps-gutter [&_li+li]:mt-space-xs [&_hr]:border-surface-container-highest [&_img]:aspect-video [&_img]:w-full [&_img]:object-contain [&_img]:rounded-md [&_img]:border [&_img]:border-surface-container-highest [&_img]:bg-surface-container-low',
    '[class.text-body-default]': "variante() === 'courant'",
    '[class.text-headline-md]': "variante() === 'chapo'",
    '[class.font-normal]': "variante() === 'chapo'",
    '[innerHTML]': 'html()',
  },
  template: '',
})
export class TextePublie {
  private readonly assainisseur = inject(DomSanitizer);

  readonly texte = input.required<string>();
  readonly variante = input<'courant' | 'chapo'>('courant');

  protected readonly html = computed(() =>
    this.assainisseur.bypassSecurityTrustHtml(
      differerLesImages(
        this.assainisseur.sanitize(
          SecurityContext.HTML,
          rendreLeMarkdown(this.texte()),
        ) ?? '',
      ),
    ),
  );
}

/**
 * `loading` et `decoding` ne passent pas l'assainisseur d'Angular : ils
 * s'ajoutent à son résultat. Une balise `<img` n'y vient que de lui, tout
 * texte qui l'imiterait étant déjà échappé (`&lt;img`). La première image,
 * souvent en haut de la page, se charge tout de suite ; les suivantes, à
 * l'approche.
 */
function differerLesImages(html: string): string {
  let rang = 0;
  return html.replace(/<img(?=[\s/>])/g, () =>
    rang++ === 0
      ? '<img decoding="async"'
      : '<img loading="lazy" decoding="async"',
  );
}
