import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  matArrowForwardOutline,
  matAssignmentLateOutline,
  matDnsOutline,
  matEventOutline,
  matFitnessCenterOutline,
  matShoppingBasketOutline,
} from '@ng-icons/material-symbols/outline';
import { HlmBadge } from '@personal-os/ui/badge';
import {
  applicationConfig,
  moduleMetadata,
  type Meta,
  type StoryObj,
} from '@storybook/angular';
import { HlmCardImports } from '../index';
import { HlmCard } from './hlm-card';

type Args = HlmCard & {
  title: string;
  tone: 'primary' | 'secondary' | 'tertiary' | 'outline';
};

// Les masters `Card`, `CardHeader` et `CardTitle`. Les cartes métier des
// écrans (événement, repas, recette, séance) se composent dans leur module à
// partir de ces directives, de `hlmBadge` et de `dccm-list-row`.
const meta: Meta<Args> = {
  title: 'Data Display/Card',
  component: HlmCard,
  decorators: [
    applicationConfig({
      providers: [
        provideIcons({
          matArrowForwardOutline,
          matAssignmentLateOutline,
          matDnsOutline,
          matEventOutline,
          matFitnessCenterOutline,
          matShoppingBasketOutline,
        }),
      ],
    }),
    moduleMetadata({ imports: [...HlmCardImports, HlmBadge, NgIcon] }),
  ],
  args: { variant: 'default', title: 'À faire', tone: 'primary' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'nested'] },
    title: { control: 'text', description: 'Le titre (`hlmCardTitle`).' },
    tone: {
      control: 'inline-radio',
      options: ['primary', 'secondary', 'tertiary', 'outline'],
      description: "La couleur de l'icône de pilier (`hlmCardTitle`).",
    },
  },
  render: (args) => ({
    props: args,
    template: `
      <section hlmCard class="w-90" [variant]="variant">
        <header hlmCardHeader>
          <h3 hlmCardTitle [tone]="tone"><ng-icon name="matAssignmentLateOutline" />{{ title }}</h3>
          <div hlmCardAction><span hlmBadge>4 alertes</span></div>
        </header>
        <div hlmCardContent><p>Contenu de la carte (slot)</p></div>
        <footer hlmCardFooter>
          <span>Mis à jour il y a 2 min</span>
          <a href="#">Tout voir<ng-icon name="matArrowForwardOutline" /></a>
        </footer>
      </section>
    `,
  }),
};
export default meta;

type Story = StoryObj<Args>;

/** En-tête, contenu et pied, comme le master. */
export const Complete: Story = { name: 'Complète' };

/** Sans pied ni zone de fin d'en-tête. */
export const Simple: Story = {
  render: () => ({
    template: `
      <section hlmCard class="w-90">
        <header hlmCardHeader>
          <h3 hlmCardTitle tone="tertiary"><ng-icon name="matShoppingBasketOutline" />Synthèse du caddie</h3>
        </header>
        <div hlmCardContent><p>12 articles restants, dont 4 au rayon frais.</p></div>
      </section>
    `,
  }),
};

/** Une description sous le titre : elle passe à la ligne sous la zone de fin. */
export const AvecDescription: Story = {
  name: 'Avec description',
  render: () => ({
    template: `
      <section hlmCard class="w-90">
        <header hlmCardHeader>
          <h3 hlmCardTitle><ng-icon name="matAssignmentLateOutline" />À faire</h3>
          <p hlmCardDescription>Éléments calculés par vos modules, lecture seule.</p>
          <div hlmCardAction><span hlmBadge tone="warning">4 alertes</span></div>
        </header>
        <div hlmCardContent><p>Contenu de la carte (slot)</p></div>
      </section>
    `,
  }),
};

/** Une carte dans une carte : `variant="nested"`, un cran plus haut sur la rampe. */
export const Imbriquee: Story = {
  name: 'Imbriquée',
  render: () => ({
    template: `
      <section hlmCard class="w-90">
        <header hlmCardHeader>
          <h3 hlmCardTitle><ng-icon name="matEventOutline" />Les 7 prochains jours</h3>
        </header>
        <div hlmCardContent>
          <article hlmCard variant="nested">
            <header hlmCardHeader>
              <h4 hlmCardTitle><ng-icon name="matAssignmentLateOutline" />Dentiste</h4>
              <div hlmCardAction><span hlmBadge tone="neutral">09:30</span></div>
            </header>
            <div hlmCardContent><p>Cabinet Dr. Martin · Contrôle annuel</p></div>
          </article>
        </div>
      </section>
    `,
  }),
};

/** L'icône dit le pilier : Agenda et Projets, Sport et Finances, Repas, Stock et Courses, Infrastructure. */
export const Piliers: Story = {
  render: () => ({
    template: `
      <div class="grid w-90 gap-space-md">
        <section hlmCard><h3 hlmCardTitle tone="primary"><ng-icon name="matEventOutline" />Agenda</h3></section>
        <section hlmCard><h3 hlmCardTitle tone="secondary"><ng-icon name="matFitnessCenterOutline" />Sport</h3></section>
        <section hlmCard><h3 hlmCardTitle tone="tertiary"><ng-icon name="matShoppingBasketOutline" />Courses</h3></section>
        <section hlmCard><h3 hlmCardTitle tone="outline"><ng-icon name="matDnsOutline" />Infrastructure</h3></section>
      </div>
    `,
  }),
};
