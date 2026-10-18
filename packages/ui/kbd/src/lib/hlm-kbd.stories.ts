import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { HlmKbd } from './hlm-kbd';

// Le master `KeyboardHint` de la planche `01 Actions`.
const meta: Meta<{ touches: string }> = {
  title: 'Actions/KeyboardHint',
  component: HlmKbd,
  decorators: [moduleMetadata({ imports: [HlmKbd] })],
  args: { touches: '⌘K' },
  argTypes: { touches: { control: 'text' } },
};
export default meta;

type Story = StoryObj<{ touches: string }>;

export const Raccourci: Story = {
  render: (args) => ({
    props: args,
    template: `<kbd hlmKbd>{{ touches }}</kbd>`,
  }),
};

export const Galerie: Story = {
  parameters: { controls: { disable: true } },
  render: () => ({
    template: `
      <div class="flex items-center gap-2">
        <kbd hlmKbd>⌘K</kbd>
        <kbd hlmKbd>Esc</kbd>
        <kbd hlmKbd>↵</kbd>
      </div>`,
  }),
};
