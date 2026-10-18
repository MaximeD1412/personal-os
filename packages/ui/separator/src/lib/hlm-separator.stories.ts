import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { HlmSeparator } from './hlm-separator';

// Le master `Divider` : un filet de 1 px en `surface-container-high`.
const meta: Meta<HlmSeparator> = {
  title: 'Data Display/Divider',
  component: HlmSeparator,
  decorators: [moduleMetadata({ imports: [HlmSeparator] })],
};
export default meta;

type Story = StoryObj<HlmSeparator>;

export const Horizontal: Story = {
  render: () => ({
    template: `
      <div class="flex w-80 flex-col gap-space-md text-body-dense text-on-surface-variant">
        <p>Liste active</p>
        <hlm-separator />
        <p>Liste clôturée</p>
      </div>
    `,
  }),
};

export const Vertical: Story = {
  render: () => ({
    template: `
      <div class="flex h-6 items-center gap-space-md text-body-dense text-on-surface-variant">
        <span>Frigo</span>
        <hlm-separator orientation="vertical" />
        <span>Garde-manger</span>
      </div>
    `,
  }),
};
