import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { HlmSkeleton } from './hlm-skeleton';

// Le master `Skeleton` de la planche `05 Feedback` : trois os (220 × 14,
// 280 × 10, 180 × 10), puis la carte en chargement de la galerie.

const os = `
  <div class="flex w-70 flex-col gap-2.5">
    <hlm-skeleton class="h-3.5 w-55" />
    <hlm-skeleton class="h-2.5 w-70" />
    <hlm-skeleton class="h-2.5 w-45" />
  </div>`;

const meta: Meta = {
  title: 'Feedback/Skeleton',
  decorators: [moduleMetadata({ imports: [HlmSkeleton] })],
};
export default meta;

type Story = StoryObj;

export const Master: Story = {
  render: () => ({ template: os }),
};

export const Carte: Story = {
  render: () => ({
    template: `
      <div class="flex w-90 flex-col gap-space-md rounded-md border border-surface-container-highest bg-surface-container p-gutter" role="status" aria-busy="true" aria-label="Chargement">
        ${os}
        ${os}
      </div>`,
  }),
};
