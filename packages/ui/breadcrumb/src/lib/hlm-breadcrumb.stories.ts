import { provideRouter } from '@angular/router';
import {
  applicationConfig,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { HlmBreadcrumbImports } from '../index';

// Les masters `Breadcrumb`, `Breadcrumb/Item` et `Breadcrumb/Separator` :
// `label-micro` en capitales, `outline`, le niveau courant en
// `on-surface-variant`, séparés d'un chevron de 14.
const meta: Meta = {
  title: 'Navigation/Breadcrumb',
  decorators: [
    applicationConfig({ providers: [provideRouter([])] }),
    moduleMetadata({ imports: [HlmBreadcrumbImports] }),
  ],
};
export default meta;

type Story = StoryObj;

export const FilDAriane: Story = {
  name: "Fil d'Ariane",
  render: () => ({
    template: `
      <nav hlmBreadcrumb>
        <ol hlmBreadcrumbList>
          <li hlmBreadcrumbItem><a hlmBreadcrumbLink link="/">Organisation</a></li>
          <li hlmBreadcrumbSeparator></li>
          <li hlmBreadcrumbItem><a hlmBreadcrumbLink link="/repas/planning">Repas</a></li>
          <li hlmBreadcrumbSeparator></li>
          <li hlmBreadcrumbItem><span hlmBreadcrumbPage>Planning</span></li>
        </ol>
      </nav>
    `,
  }),
};

/** Des niveaux masqués derrière une ellipse. */
export const Replie: Story = {
  name: 'Replié',
  render: () => ({
    template: `
      <nav hlmBreadcrumb>
        <ol hlmBreadcrumbList>
          <li hlmBreadcrumbItem><a hlmBreadcrumbLink link="/">Organisation</a></li>
          <li hlmBreadcrumbSeparator></li>
          <li hlmBreadcrumbItem><hlm-breadcrumb-ellipsis /></li>
          <li hlmBreadcrumbSeparator></li>
          <li hlmBreadcrumbItem><span hlmBreadcrumbPage>Vue consolidée</span></li>
        </ol>
      </nav>
    `,
  }),
};
