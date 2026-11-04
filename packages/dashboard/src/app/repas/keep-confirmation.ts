import type { DccmConfirm } from '@personal-os/ui/dccm';

/**
 * La confirmation de la garde d'une recette, la même depuis sa fiche et depuis
 * le planning : une recette gardée entre dans « Mes recettes » et la
 * génération la propose d'abord, sans retour en arrière.
 */
export async function confirmerLaGarde(
  confirmation: DccmConfirm,
  titre: string,
): Promise<boolean> {
  return (
    (await confirmation.confirm({
      title: `Garder «\u00a0${titre}\u00a0» ?`,
      description:
        'Elle rejoint vos recettes, et la génération la proposera en priorité aux prochains tours.',
      confirmLabel: 'Garder la recette',
    })) === true
  );
}
