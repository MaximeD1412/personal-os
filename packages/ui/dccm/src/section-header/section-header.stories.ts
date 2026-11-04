import { HlmButton } from '@personal-os/ui/button';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { DccmSectionHeader } from './section-header';

// Le master `SectionHeader` : le titre d'une section de page, sa description
// et sa zone de fin (un lien, un bouton secondaire).
const meta: Meta<DccmSectionHeader> = {
  title: 'Data Display/SectionHeader',
  component: DccmSectionHeader,
  decorators: [moduleMetadata({ imports: [DccmSectionHeader, HlmButton] })],
  args: {
    heading: 'Les 7 prochains jours',
    description: 'Vue consolidée du foyer',
  },
  render: (args) => ({
    props: args,
    template: `
      <dccm-section-header class="w-120" [heading]="heading" [description]="description">
        <a hlmBtn variant="link" href="#">Voir tout</a>
      </dccm-section-header>
    `,
  }),
};
export default meta;

type Story = StoryObj<DccmSectionHeader>;

export const Controles: Story = { name: 'Contrôles' };

/** Le titre seul, sans description ni zone de fin. */
export const TitreSeul: Story = {
  name: 'Titre seul',
  render: () => ({
    template: `<dccm-section-header class="w-120" heading="Séances de la semaine" />`,
  }),
};
