import { Component, computed, input } from '@angular/core';
import { rendreLeMarkdown } from './markdown';

/** Un texte publié, rendu depuis son markdown. */
@Component({
  selector: 'pos-texte-publie',
  host: {
    class:
      'flex flex-col gap-space-sm text-body-default text-on-surface-variant [&_a]:text-primary [&_a]:underline [&_blockquote]:border-s-2 [&_blockquote]:border-outline-variant [&_blockquote]:ps-space-sm [&_code]:font-mono [&_code]:text-code-mono [&_h1]:text-headline-md [&_h1]:text-on-surface [&_h2]:text-title-sm [&_h2]:text-on-surface [&_h3]:text-label-regular [&_h3]:font-semibold [&_h3]:text-on-surface [&_ol]:list-decimal [&_ol]:ps-gutter [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-surface-container-low [&_pre]:p-space-sm [&_strong]:text-on-surface [&_ul]:list-disc [&_ul]:ps-gutter',
    '[innerHTML]': 'html()',
  },
  template: '',
})
export class TextePublie {
  readonly texte = input.required<string>();

  protected readonly html = computed(() => rendreLeMarkdown(this.texte()));
}
