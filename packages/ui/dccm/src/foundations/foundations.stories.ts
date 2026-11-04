import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import {
  DccmFoundationsCouleurs,
  DccmFoundationsElevation,
  DccmFoundationsEspacements,
  DccmFoundationsIcones,
  DccmFoundationsPistes,
  DccmFoundationsRayons,
  DccmFoundationsTypographie,
} from './foundations';

// La planche `Design System / 00 Foundations`, une story par section. Les
// valeurs affichées sont lues dans `packages/theme/tokens.css` tel qu'il est
// servi : une story ne peut pas montrer un jeton qui n'existe plus.
const meta: Meta = {
  title: 'Foundations',
  parameters: { layout: 'fullscreen' },
  decorators: [
    moduleMetadata({
      imports: [
        DccmFoundationsCouleurs,
        DccmFoundationsPistes,
        DccmFoundationsTypographie,
        DccmFoundationsEspacements,
        DccmFoundationsRayons,
        DccmFoundationsIcones,
        DccmFoundationsElevation,
      ],
    }),
  ],
};
export default meta;

type Story = StoryObj;

export const Couleurs: Story = {
  render: () => ({ template: '<dccm-foundations-couleurs />' }),
};

export const PistesTeintees: Story = {
  name: 'Pistes teintées',
  render: () => ({ template: '<dccm-foundations-pistes />' }),
};

export const Typographie: Story = {
  render: () => ({ template: '<dccm-foundations-typographie />' }),
};

export const Espacements: Story = {
  render: () => ({ template: '<dccm-foundations-espacements />' }),
};

export const Rayons: Story = {
  render: () => ({ template: '<dccm-foundations-rayons />' }),
};

export const Icones: Story = {
  name: 'Icônes',
  render: () => ({ template: '<dccm-foundations-icones />' }),
};

export const Elevation: Story = {
  name: 'Élévation',
  render: () => ({ template: '<dccm-foundations-elevation />' }),
};
