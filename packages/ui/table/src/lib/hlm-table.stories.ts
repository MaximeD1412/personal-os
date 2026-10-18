import { HlmBadge } from '@personal-os/ui/badge';
import { moduleMetadata, type Meta, type StoryObj } from '@storybook/angular';
import { HlmTableImports } from '../index';

// Les masters `Table/HeaderCell` et `Table/Cell`, sur un tableau du stock :
// en-têtes en `label-micro`, cellules en `body-dense`, la première en
// `on-surface` 600. Un tag ou un badge se posent dans une cellule.
const meta: Meta = {
  title: 'Data Display/Table',
  decorators: [moduleMetadata({ imports: [...HlmTableImports, HlmBadge] })],
};
export default meta;

type Story = StoryObj;

export const Stock: Story = {
  render: () => ({
    props: {
      lignes: [
        { produit: 'Blancs de poulet fermier', lieu: 'Frigo ét. 1', quantite: '600 g', ton: 'success', statut: 'Stable' },
        { produit: 'Crème fraîche épaisse', lieu: 'Frigo', quantite: '180 g', ton: 'warning', statut: 'Périme J-2' },
        { produit: 'Yaourts nature', lieu: 'Frigo', quantite: '4', ton: 'error', statut: 'Périmé' },
      ],
    },
    template: `
      <div hlmTableContainer class="w-150">
        <table hlmTable>
          <caption hlmTableCaption>Stock domestique, rayon frais</caption>
          <thead hlmTableHeader>
            <tr hlmTableRow>
              <th hlmTableHead scope="col">Produit</th>
              <th hlmTableHead scope="col" class="w-30">Lieu</th>
              <th hlmTableHead scope="col" class="w-30">Quantité</th>
              <th hlmTableHead scope="col" class="w-30">Statut</th>
            </tr>
          </thead>
          <tbody hlmTableBody>
            @for (l of lignes; track l.produit) {
              <tr hlmTableRow>
                <td hlmTableCell class="font-semibold text-on-surface">{{ l.produit }}</td>
                <td hlmTableCell><span hlmBadge variant="tag">{{ l.lieu }}</span></td>
                <td hlmTableCell class="tabular-nums">{{ l.quantite }}</td>
                <td hlmTableCell><span hlmBadge [tone]="l.ton">{{ l.statut }}</span></td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    `,
  }),
};

/** Une ligne sélectionnée (`data-state="selected"`) et une ligne survolée (forcée ici). */
export const Etats: Story = {
  name: 'États',
  render: () => ({
    template: `
      <div hlmTableContainer class="w-150">
        <table hlmTable>
          <thead hlmTableHeader>
            <tr hlmTableRow><th hlmTableHead scope="col">Produit</th><th hlmTableHead scope="col" class="w-30">Quantité</th></tr>
          </thead>
          <tbody hlmTableBody>
            <tr hlmTableRow><td hlmTableCell class="font-semibold text-on-surface">Repos</td><td hlmTableCell>600 g</td></tr>
            <tr hlmTableRow class="bg-surface-container-high"><td hlmTableCell class="font-semibold text-on-surface">Survol</td><td hlmTableCell>180 g</td></tr>
            <tr hlmTableRow data-state="selected"><td hlmTableCell class="font-semibold text-on-surface">Sélectionnée</td><td hlmTableCell>4</td></tr>
          </tbody>
        </table>
      </div>
    `,
  }),
};
