# Journal de la refonte de la gestion de projet

> Matière première de la rétro : ce qui marche, ce qui frotte, ce qui se
> généralise. Le ou les skills de conception et de gestion de projet en
> sortiront. Ce fichier disparaît une fois les skills écrits.

Modèle : TGR (`~/projects/TGR/TGR MON REPO`), backlog en fichiers
(`backlog/`), board « TGR Lancement », `scripts/agent-loop.sh`, `infra/`.

## Décisions de cadrage (17 octobre 2026)

- Les issues ouvertes (#9 à #24, PRD #1) sont réécrites au format TGR. On
  modifie l'issue en place quand le périmètre ne change pas, sinon on ferme et
  on recrée.
- Le découpage est repensé, il ne s'agit pas seulement de reformater.
- La branche `codex/maquette-projet` est mise de côté. La refonte se fait dans un
  worktree séparé, sur `chore/refonte-gestion-projet`, depuis `develop`.
- On garde les ADR (pas de document unique `D-xxx`). Les issues les citent dans
  leur Contexte.
- Les fichiers `backlog/` servent à la création (idempotente). Ensuite, c'est
  GitHub qui fait foi.
- `current-issues.md` est supprimé. Le board et les relations natives
  « blocked by » le remplacent.
- Épiques : SOCLE, AGENDA, SPORT, CUISINE, FOYER, DASH, CMD, PORTFOLIO, INFRA.
- Gabarit d'issue TGR, encore à améliorer.
- Labels alignés sur TGR (`type:*`, `epic:*`, `blocked:externe`, `needs-human`,
  `ready-for-agent`, `agent-loop`).
- Pas de date limite, mais des jalons quand même. On ne crée pas de champ
  « Responsable ».
- Nouveau projet GitHub « Personal OS ». L'ancien projet n°1, « untitled », est
  supprimé.
- On reprend toute l'infra TGR : provisionnement idempotent, staging, CD poussé
  en SSH, tests des scripts infra, CI économe, `worktree.sh`, `agent-loop`. Les
  ADR 0021 et 0023 seront remplacés.
- La cible reste la même : VPS OVH, puis homelab.
- `agent-loop` doit marcher de la même façon dans les deux projets, avec merge
  automatique sans relecture humaine. La conception complète doit rendre les
  agents autonomes.
- L'infra et l'outillage deviennent des tickets de l'épique INFRA. Ils ne sont
  pas faits pendant la refonte.

## Décisions, deuxième série (17 octobre 2026)

- Gabarit d'issue : un ticket doit être complet, au point qu'un agent n'ait
  **aucune** question à se poser, et le workflow doit rester fluide.
- Les skills de la rétro vont dans `~/.agents/skills/`, versionnés dans
  `~/dotfiles/agents/skills/`.
- Le CD est poussé en SSH avec une clé bridée : utilisateur dédié, `command=`
  forcé, répétition de la migration sur le VPS. Cela remplace l'ADR 0023.
- Le staging tourne sur le même VPS, dans un projet Compose séparé, derrière le
  proxy de tête et Authentik. Il n'utilise que des données de démo et se déploie
  à chaque merge sur `develop`. Cela remplace l'ADR 0021.
- `develop` → `main` reste à la main. C'est le seul geste humain de la
  livraison.
- `agent-loop` devient un outil partagé. Chaque repo fournit sa config et ses
  conventions dans `AGENTS.md`. TGR est modifié en conséquence.
- `AGENTS.md` fait référence et `CLAUDE.md` contient `@AGENTS.md`. Il est écrit
  pendant la refonte.
- La Cuisine passe en tête des jalons fonctionnels. `pick-issue` est corrigé
  pour trier les jalons sans date sur leur numéro (fait le 17 octobre dans
  `~/dotfiles`).
- Tickets S ou M. Un L reste possible, en dernier recours.
- Une épique UI (design system). La plupart des écrans exigent une revue
  visuelle humaine.
- Les conventions d'API se fixent par une séance de grilling, puis un ADR, avant
  d'écrire les tickets.
- Quatre artifacts par projet, produits en fin de conception : planning
  (checklist de toutes les issues), check-list MEP (tenue à jour à chaque
  ticket), architecture (globale, plus des onglets par composant, mise à jour
  de temps à autre) et registre des risques (mis à jour par les tickets qui
  traitent un risque).

## Décisions, troisième série : le pilotage (17 octobre 2026)

- Un seul artifact « Pilotage <projet> » à quatre pages (Planning, MEP,
  Architecture, Risques). Le gabarit est commun à tous les projets, seul le
  thème change, tiré des tokens de l'application.
- Planning : chaque barre se place après ses bloqueurs, sa longueur suit la
  taille (S=1, M=2, L=4), et les barres sont groupées par jalon. On y voit
  l'épique, le type, la priorité et un état dérivé de GitHub (à faire,
  disponible, pris par la boucle, PR en revue, needs-human, fait), avec des
  filtres.
- MEP : chaque élément est rattaché à la prochaine livraison. Une case cochée
  est rangée, à l'affichage, dans la livraison (`develop` → `main`) qui suit la
  date où elle a été cochée.
- Architecture : un onglet Global (aujourd'hui et cible), puis API, Tableau de
  bord, Portfolio, Données, Infra et Livraison.
- Risques : les tickets portent `risques: [ID]` dans leur frontmatter, et l'agent
  met à jour le registre dans sa PR. L'identification des risques fait partie de
  la conception, avant les tickets. Statuts : ouvert, solution choisie,
  implémenté, accepté.
- **Montage** : les données vivent dans le dépôt (`docs/pilotage/*.json`, relues
  par Codex) et dans GitHub. `pilotage build` est un script déterministe, sans
  LLM. `pilotage publish` lance `claude -p`, qui publie l'artifact avec les
  fichiers produits par le script. La base de l'artifact ne garde que ce qui se
  saisit sur la page : cases MEP, commentaires, statut d'un risque changé à la
  main. Pour un statut de risque, la valeur la plus récente gagne, qu'elle
  vienne du dépôt ou de la page.
- La publication se fait par `agent-loop` à la prise d'un ticket et après son
  merge (sous verrou), par `pick-issue` en fin de ticket, et à la main avec
  `/pilotage`.
- TGR garde ses artifacts actuels.
- Les jalons sont validés : M0 Outillage agents et staging, M1 UI, M2 Cuisine
  socle, M3 Cuisine boucle, M4 Agenda et sport, M5 Tableau de bord et barre de
  commande, M6 Projets et portfolio, M7 Infra de fond.
- Revue visuelle : un label `revue-visuelle`. L'agent joint des captures mobile
  et desktop (agent-browser), la boucle s'arrête avant le merge, et le merge
  attend ton approbation de la PR.

## Observations

- Le PRD #1 tranche déjà presque tout le produit (19 ADR, 91 user stories,
  modules profonds identifiés). « Repenser » consiste surtout à re-découper
  finement et à ancrer chaque ticket dans le code existant, pas à refaire la
  conception produit. **À généraliser** : la phase de conception doit d'abord
  mesurer ce qui est déjà décidé avant de rouvrir des sujets.
- personal-os n'a ni `CLAUDE.md` ni `AGENTS.md`. Pour un agent autonome, c'est le
  premier manque, avant même le backlog. TGR en a un, très opérationnel : quels
  tests lancer, dans quel ordre, quoi faire dans un worktree.
- `pick-issue` trie d'abord par date d'échéance du jalon. Sans échéance, tous
  les jalons sont à égalité et l'ordre des jalons est perdu. Le skill doit
  savoir trier sur le numéro du jalon (M0 < M1…) quand il n'y a pas de date.
- `agent-loop.sh` et ses prompts sont écrits pour TGR (« The Gamer Rich »,
  workspaces npm, `CLAUDE.md` de TGR). Pour qu'il serve aux deux projets, il
  faut le rendre générique.
- Codex est disponible par le binaire de l'app Windows
  (`/mnt/c/Users/*/.codex/bin/wsl/*/codex`), qu'`agent-loop.sh` sait déjà
  trouver. Il n'y a rien à installer.
- ~~En headless, `agent-loop` ne met jamais à jour les artifacts.~~ C'était dû à un
  CLI trop ancien. Depuis la 2.1.302, `claude -p` a bien Artifact et ArtifactData
  (vérifié en lecture le 17 octobre). Le diagnostic qui suit reste valable pour
  le reste. Ancien constat : En `claude -p`,
  l'outil Artifact n'est pas disponible. Les tickets #227 et #228 de TGR se sont
  rabattus sur une section « Pour la prod » dans la PR, ce qui fait dériver la
  check-list MEP. Dans TGR, les données des artifacts sont aussi écrites en dur
  dans le HTML : la check-list fait 380 Ko et se republie en entier à chaque
  ticket, au risque d'un conflit entre deux boucles. **À généraliser** : les
  données des artifacts vivent dans le dépôt, et c'est l'agent qui les modifie
  dans sa PR (Codex les relit). L'artifact n'est qu'une vue, synchronisée par
  un skill interactif.
- Les artifacts TGR partagent une identité visuelle propre à TGR (néon, sombre
  uniquement) et la notion de « Partenaire ». Le planning a des dates en dur et
  un avancement coché à la main, sans lien avec GitHub.
- **Le grilling des conventions d'API a révélé une contradiction** : le PRD et
  l'ADR 0018 supposent un OpenAPI « déjà produit », alors qu'il n'existe pas.
  **À généraliser** : avant de trancher des conventions, comparer ce que disent
  les documents à ce que fait le code. Dix questions ont suffi, toutes fermées
  par la reco ou par un choix entre deux variantes. Elles ont abouti à
  l'ADR 0030.
- **Le registre des risques s'est validé d'un coup**, à partir d'un premier jet
  par catégorie : risque, gravité, solution, et ✓ pour ce qui existe déjà. C'est
  plus rapide qu'un grilling question par question. Il est enregistré dans
  `docs/pilotage/risques.json`. **À généraliser** : bâtir le premier jet à
  partir du PRD, des ADR et du code, et marquer ce qui est déjà couvert. Le
  champ `tickets` se remplit pendant le découpage.
- **Le découpage a été validé en une passe**, sur un tableau par jalon : ID,
  titre, taille, priorité, bloqueurs, 👁 pour la revue visuelle,
  « reprend #n ». Seules les questions de domaine qui bloquaient la rédaction
  ont été posées avec (Participant, grain des préférences, fournisseurs).
  **À généraliser** : avant de rédiger 60 tickets, faire valider le tableau et
  lever les ambiguïtés du glossaire qui conditionnent le modèle de données.
- **La rédaction des tickets a fait remonter des incohérences** que la
  conception n'avait pas vues :
  - les routes du front sont en français, contrairement à l'exemple de
    l'ADR 0030 ;
  - les `container_name` fixes empêchent un second projet Compose ;
  - l'entité jouet `Trace` reste à retirer ;
  - un article de courses manuel sans Ingrédient contredit le glossaire ;
  - des relations « blocked by » natives périmées subsistent sur les issues
    réutilisées (#19 bloquée par #18).

  **À généraliser** : écrire « État actuel du code » à partir du code réel,
  jamais de mémoire. Vérifier la cohérence du backlog par script : bloqueurs
  connus, pas de cycle, pas de bloqueur dans un jalon plus tardif, risques
  connus.
- **La branche de conception doit être fusionnée sur `develop` avant de créer
  les issues.** Les issues citent des fichiers (`AGENTS.md`, ADR 0030 à 0032,
  `docs/pilotage/`) que les premiers agents ne trouveraient pas sinon.
- `current-issues.md` ne vivait pas sur `develop` mais sur
  `chore/issue-tracking`, que `pick-issue` réécrivait. Le retirer revient à
  supprimer cette branche.
