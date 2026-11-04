---
id: UI-4
title: "Agenda et Calendrier composés avec le design system, d'après leurs maquettes"
epic: UI
type: feature
priority: P1
size: M
milestone: M1 UI
blocked_by: [UI-2, UI-3]
adr: [0011, 0030]
risques: [AG-4]
revue_visuelle: true
reprend: 63
---

## Contexte

Les deux écrans existants deviennent les premiers écrans composés avec le design system, et les exemples que suivront les tickets des modules : une liste par période en lecture seule (Agenda), une vue du mois avec un formulaire prérempli par URL (Calendrier). Ils suivent leurs maquettes pen.dev.

## État actuel du code

- `packages/dashboard/src/app/agenda.ts`, `agenda.html`, `calendrier.ts`, `calendrier.html` et leurs specs ; route `/calendrier/evenements/nouveau` (SOCLE-4) ; `modules-d-origine.ts` (lien de chaque entrée vers son module).
- Après UI-2 et UI-3 : `DccmShell`, `DccmPageHeader`, `DccmFormPage` (`page`, `panel`, `sheet`), `DccmConfirm`, `DccmState`, et les composants de UI-5 et UI-6.
- Maquettes : `design/captures/ecrans/agenda-1424.png` et `agenda-390.png` (frames `kOd1d`, `A5lpsn`), `calendrier-1424.png` et `calendrier-390.png` (frames `kTbwn`, `e4t4N`) dans `design/personalos.pen`.

## À faire

- **Agenda** (`/agenda`) :
  - semaine courante par défaut ; semaine précédente, suivante et « Aujourd'hui » ;
  - ≥ 768 px : sept colonnes, une par jour (en-tête jour, date, nombre d'entrées), le jour courant mis en avant ; < 768 px : liste des jours ;
  - une entrée : heure, icône et couleur du pilier de sa source, titre, ligne de détail (la période : « 18:30 – 19:45 », ou « jusqu'au … » sur plusieurs jours ; absente sans `endsAt`), `HlmBadge` du statut (« Prévu », « Réalisé », « Manqué », libellés actuels de `agenda.ts`), lien « Ouvrir dans <module> » ;
  - légende des sources ; `DccmState` pour chargement, vide et erreur.
- **Calendrier** (`/calendrier`) :
  - ≥ 768 px : grille du mois (lundi en premier, jours hors mois atténués, jour courant mis en avant, Événements en pastilles avec heure et catégorie) ; < 768 px : bandeau de la semaine et liste du jour, comme `calendrier-390.png` ;
  - mois précédent, suivant et « Aujourd'hui » ; « Nouvel événement » (`HlmButton` `primary`) ;
  - création et modification par `DccmFormPage` aux routes `/calendrier/evenements/nouveau` et `/calendrier/evenements/:id`, en `panel` à partir de 1280 px et en `sheet` en dessous, préremplies par URL (ADR 0030) ;
  - suppression par `DccmConfirm` destructif.
- Tests jest des deux écrans adaptés au nouveau balisage : navigation de période, groupement par jour, préremplissage, erreurs de champ, confirmation de suppression.

## Décisions déjà prises

- L'Agenda reste en lecture seule : une entrée renvoie vers l'écran de son module (ADR 0011).
- L'entrée d'Agenda ne montre que ce que porte `AgendaItem` (ADR 0011) : ni tag d'Espace, ni lieu, allure ou ingrédients comme dans la maquette. Le badge de la maquette desktop devient le statut, comme sur la maquette mobile.
- Les catégories d'Événement sont celles du contrat (`Rendez-vous`, `Anniversaire`, `Échéance`, `Autre`), pas celles de la maquette mobile (Pro, Personnel, Santé).
- Hors périmètre malgré la maquette : vue « Mois » de l'Agenda, filtres par Espace et par catégorie, recherche, synthèse de la semaine, état de synchronisation des sources, notification de rappel. Ils feront l'objet de tickets s'ils sont voulus.
- Les textes de la maquette ne sont pas repris : seuls les libellés d'interface (boutons, titres de section, en-têtes) le sont.

## Critères d'acceptation

- [ ] Les deux écrans correspondent à leurs maquettes en 390 et 1280 px, dans la limite du périmètre ci-dessus.
- [ ] Ils n'utilisent que des composants du design system et des jetons : aucune couleur, taille de police ni rayon en dur.
- [ ] Les tests existants des deux écrans passent, adaptés si besoin.

## Vérification

- `pnpm exec nx test dashboard` ; `pnpm exec nx affected -t lint test build --base=origin/develop`.
- Captures : `scripts/captures.sh /agenda /calendrier /calendrier/evenements/nouveau`, jointes à côté des maquettes correspondantes.

## Pour la prod

Rien.

## Hors périmètre

- La récurrence : AGENDA-1, AGENDA-2.

## Dépendances

- UI-2.
- UI-3.
