import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { HlmProgress } from './hlm-progress';
import { HlmProgressIndicator } from './hlm-progress-indicator';

type Args = HlmProgress & { value: number };

// Le master `ProgressBar` : une piste de 4 ou 6 px, remplie dans la tonalité
// de ce qu'elle mesure. Elle porte toujours un nom (`aria-label`).
const meta: Meta<Args> = {
  title: 'Data Display/ProgressBar',
  component: HlmProgress,
  decorators: [
    moduleMetadata({ imports: [HlmProgress, HlmProgressIndicator] }),
  ],
  args: { value: 60, tone: 'secondary', thickness: 4 },
  argTypes: {
    value: { control: { type: 'range', min: 0, max: 100 } },
    tone: {
      control: 'inline-radio',
      options: ['secondary', 'primary', 'tertiary', 'error'],
    },
    thickness: { control: 'inline-radio', options: [4, 6] },
  },
  render: (args) => ({
    props: args,
    template: `
      <hlm-progress class="w-30" aria-label="Séances de la semaine" [value]="value" [tone]="tone" [thickness]="thickness">
        <hlm-progress-indicator />
      </hlm-progress>
    `,
  }),
};
export default meta;

type Story = StoryObj<Args>;

export const Controles: Story = { name: 'Contrôles' };

/** La galerie : une barre par tonalité, puis l'épaisseur 6. */
export const Galerie: Story = {
  render: () => ({
    props: {
      barres: [
        { tone: 'secondary', value: 60, nom: 'Séances faites' },
        { tone: 'primary', value: 35, nom: 'Tâches du sprint' },
        { tone: 'tertiary', value: 80, nom: 'Stock consommé' },
        { tone: 'error', value: 15, nom: 'Espace disque libre' },
      ],
    },
    template: `
      <div class="flex flex-col gap-space-lg">
        @for (b of barres; track b.tone) {
          <div class="flex items-center gap-space-md">
            <span class="w-40 text-label-micro text-outline uppercase">{{ b.tone }} · {{ b.value }} %</span>
            <hlm-progress class="w-30" [attr.aria-label]="b.nom" [value]="b.value" [tone]="b.tone">
              <hlm-progress-indicator />
            </hlm-progress>
          </div>
        }
        <div class="flex items-center gap-space-md">
          <span class="w-40 text-label-micro text-outline uppercase">épaisseur 6</span>
          <hlm-progress class="w-40" aria-label="Planning approuvé" [value]="62" thickness="6">
            <hlm-progress-indicator />
          </hlm-progress>
        </div>
      </div>
    `,
  }),
};
