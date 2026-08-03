# Le portfolio est rédigé, pas généré

> **Statut :** accepté — 3 août 2026
> Réduit le §7.9 et retire du périmètre les entités `Experience`, `Skill`, `CaseStudy` et `Publication` du §19.

Le portfolio n'est pas une transcription du CV : il présente la personne, ses projets, ses compétences et ceux avec qui elle a travaillé, et il doit être agréable à regarder. Cet objectif se sert mieux d'un texte écrit avec soin que d'une liste d'objets rendue automatiquement.

En conséquence :

- Les pages présentation, expériences et compétences sont des **contenus rédigés** en français et en anglais, édités depuis le tableau de bord. Il n'existe **ni entité Expérience, ni entité Compétence, ni étude de cas structurée**.
- Le **CV** est un PDF rédigé hors de l'application et téléversé. L'application ne le génère pas et ne le modélise pas. La divergence éventuelle entre le PDF et le site est assumée : elle coûte moins cher qu'un second modèle de données à tenir à jour en double.
- Il n'existe **qu'un seul portfolio**, en deux langues. Les « profils » du §7.9 (dev Java full-stack, produit, freelance) sortent du périmètre.
- La langue initiale est déduite de l'en-tête `Accept-Language` du visiteur — pas d'une géolocalisation par IP, qui exigerait une base externe et se tromperait en déplacement. Un sélecteur reste toujours visible et le choix est mémorisé.

Seuls les **Projets** restent structurés, parce qu'ils existent déjà dans l'application pour d'autres raisons et portent une **Présentation publique** par langue.

## Conséquences

- Aucune régénération automatique du CV n'est possible, et ce n'est pas un manque.
- Un projet dont la présentation anglaise n'est pas écrite est simplement absent du portfolio anglais. Il n'y a pas de repli d'une langue sur l'autre.
- Si le besoin d'un CV structuré réapparaît un jour, il faudra le construire à partir des contenus rédigés, pas l'inverse.
