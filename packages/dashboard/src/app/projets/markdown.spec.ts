import { rendreLeMarkdown } from './markdown';

describe('rendreLeMarkdown', () => {
  it('rend titres, listes, emphase et liens', () => {
    const html = rendreLeMarkdown(
      '## Étapes\n\n- **Coudre** le carnet\n- Voir [la reliure](https://fr.wikipedia.org/wiki/Reliure)',
    );

    expect(html).toContain('<h2>Étapes</h2>');
    expect(html).toContain('<li><strong>Coudre</strong> le carnet</li>');
    expect(html).toContain(
      '<a href="https://fr.wikipedia.org/wiki/Reliure">la reliure</a>',
    );
  });

  it('rend une case à cocher en texte, qui survit à l’assainissement', () => {
    const html = rendreLeMarkdown('- [x] Choisir le papier\n- [ ] Coudre');

    expect(html).not.toContain('<input');
    expect(html).toContain('☑ Choisir le papier');
    expect(html).toContain('☐ Coudre');
  });

  it('marque la ligne d’une case à cocher, que l’écran montre sans puce', () => {
    const html = rendreLeMarkdown('- [x] Choisir le papier\n- Coudre');

    expect(html).toContain('<li class="tache">☑ Choisir le papier</li>');
    expect(html).toContain('<li>Coudre</li>');
  });

  it('montre le HTML écrit dans les notes comme du texte, sans l’interpréter', () => {
    const html = rendreLeMarkdown('Avant <img src=x onerror="alert(1)"> après');

    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });

  it('ne rend rien pour des notes vides', () => {
    expect(rendreLeMarkdown('  \n')).toBe('');
  });
});
