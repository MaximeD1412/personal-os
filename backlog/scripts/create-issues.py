#!/usr/bin/env python3
"""Create or update the GitHub backlog from backlog/epics/*.md and backlog/issues/*.md.

Dry run by default: prints what would be done and touches nothing.
Pass --apply to do it for real. Re-running is safe: issues already handled are
found through backlog/issues-map.json and skipped.

Adapted from TGR (backlog/scripts/create-issues.py). Differences:
  - milestones have no due date (pick-issue sorts them by their M<n> number);
  - an issue whose front matter has `reprend: <n>` rewrites the open issue #n
    (title, body, labels, milestone) instead of creating a new one, and its
    stale native "blocked by" relations are removed;
  - labels `revue-visuelle` (revue_visuelle: true) and no `ready-for-agent`
    for type externe or hors_boucle: true;
  - epics are native sub-issues of the PRD (#1).

Steps (with --apply):
  1. labels, then milestones M0..M7
  2. epic issues, then issues in dependency order (create or rewrite)
  3. native sub-issue links (PRD -> epics -> issues), native "blocked by"
  4. GitHub Project (optional, --project "<title>"): items, fields Priorité, Taille.
     Needs the `project` scope: gh auth refresh -s project

Usage:
  python3 -B backlog/scripts/create-issues.py                          # dry run
  python3 -B backlog/scripts/create-issues.py --apply --project "Personal OS"
"""
import argparse
import json
import re
import subprocess
import sys
import time
from pathlib import Path

REPO = "MaximeD1412/personal-os"
OWNER = "MaximeD1412"
PRD = 1
ROOT = Path(__file__).resolve().parents[2]
ISSUES = ROOT / "backlog" / "issues"
EPICS = ROOT / "backlog" / "epics"
MAP = ROOT / "backlog" / "issues-map.json"

MILESTONES = {
    "M0 Outillage agents et staging": "Boucle d'agents partagée, worktrees, jeu de démo, captures, staging, CD poussé, conventions d'API appliquées",
    "M1 UI": "Design system DCCM, coque, motifs d'écran",
    "M2 Cuisine socle": "Ingrédients, recettes, planning manuel, stock, liste de courses figée et clôture, repas cuisiné",
    "M3 Cuisine boucle": "Port IA, Tours de génération, Souhaits, génération contrôlée, produits, écart et complément",
    "M4 Agenda et sport": "Récurrence, Séances, Objectifs",
    "M5 Tableau de bord et barre de commande": "À faire calculés, accueil, catalogue d'actions, barre de commande",
    "M6 Projets et portfolio": "Projets, Présentations publiques, pages de contenu, CV, portfolio public",
    "M7 Infra de fond": "Provisionnement idempotent, homelab",
}
EPIC_LABEL = {e: f"epic:{e.lower()}" for e in
              ("SOCLE", "INFRA", "UI", "FOYER", "CUISINE", "AGENDA", "SPORT", "DASH", "CMD", "PORTFOLIO")}
LABELS = {
    **{v: ("5319e7", f"Epic {k}") for k, v in EPIC_LABEL.items()},
    "type:feature": ("0e8a16", "Fonctionnalité"),
    "type:chore": ("c5def5", "Infra, outillage"),
    "type:spike": ("fbca04", "Benchmark, étude"),
    "type:externe": ("d4c5f9", "Geste humain hors du dépôt : accès, compte, achat"),
    "blocked:externe": ("b60205", "Attend une décision ou un geste hors du dépôt"),
    "ready-for-agent": ("1d76db", "Prête à être prise (skill pick-issue, agent-loop)"),
    "agent-loop": ("5319e7", "Ticket pris par agent-loop"),
    "needs-human": ("d93f0b", "La boucle d'agents a passé la main"),
    "revue-visuelle": ("fbca04", "Le merge attend l'approbation humaine des captures"),
}
OBSOLETE_LABELS = ["hitl"]
TRANSIENT = ("unexpected EOF", "timeout", "connection reset", "HTTP 502", "HTTP 503", "HTTP 504", "secondary rate limit")


def parse(path):
    text = path.read_text(encoding="utf-8")
    m = re.match(r"---\n(.*?)\n---\n(.*)", text, re.S)
    if not m:
        sys.exit(f"no front matter: {path}")
    meta = {}
    for line in m.group(1).splitlines():
        k, _, v = line.partition(":")
        v = v.split(" #")[0].strip()
        if v.startswith("[") and v.endswith("]"):
            v = [x.strip() for x in v[1:-1].split(",") if x.strip()]
        elif v.startswith('"') and v.endswith('"'):
            v = v[1:-1]
        elif v in ("true", "false"):
            v = v == "true"
        meta[k.strip()] = v
    meta["body"] = m.group(2).strip()
    return meta


def gh(*args, input=None, attempts=4):
    for n in range(attempts):
        r = subprocess.run(["gh", *args], capture_output=True, text=True, input=input)
        if r.returncode == 0:
            return r.stdout
        err = r.stderr.strip()
        if n + 1 < attempts and any(t.lower() in err.lower() for t in TRANSIENT):
            time.sleep(5 * (n + 1))
            continue
        raise RuntimeError(f"gh {' '.join(args[:4])}...: {err}")


def labels_for(meta, kind):
    if kind == "epic":
        return meta.get("labels", [])
    out = [EPIC_LABEL[meta["epic"]], f"type:{meta['type']}"]
    if meta.get("revue_visuelle") is True:
        out.append("revue-visuelle")
    if meta["type"] in ("feature", "chore", "spike") and meta.get("hors_boucle") is not True:
        out.append("ready-for-agent")
    return out


def body_for(meta, numbers, kind):
    body = meta["body"]
    if kind == "issue":
        deps = meta.get("blocked_by", [])
        lines = [f"Blocked by #{numbers[d]}" if d in numbers else f"Blocked by {d} (non créée)" for d in deps]
        section = "\n".join(lines) if lines else "Aucune."
        body = re.sub(r"## Dépendances\n.*\Z", lambda _: f"## Dépendances\n\n{section}\n", body, flags=re.S)
        extra = []
        if meta.get("adr"):
            extra.append("ADR : " + ", ".join(meta["adr"]) + f" ([`docs/adr/`](https://github.com/{REPO}/tree/develop/docs/adr))")
        if meta.get("risques"):
            extra.append("Risques : " + ", ".join(meta["risques"]) + " (`docs/pilotage/risques.json`)")
        if extra:
            body += "\n\n" + "\n\n".join(extra)
        src = f"backlog/issues/{meta['id']}.md"
    else:
        src = f"backlog/epics/{meta['id'][5:]}.md"
    return body + f"\n\n---\nSource : `{src}` · décisions : `docs/adr/` · conventions : `AGENTS.md`\n"


def topo(issues):
    order, seen = [], set()

    def visit(i, stack=()):
        if i in seen:
            return
        if i in stack:
            sys.exit(f"cycle: {' -> '.join(stack + (i,))}")
        for d in issues[i].get("blocked_by", []):
            visit(d, stack + (i,))
        seen.add(i)
        order.append(i)

    for i in sorted(issues):
        visit(i)
    return order


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="do it for real (default: dry run)")
    ap.add_argument("--project", help="GitHub Project title to create or reuse")
    args = ap.parse_args()
    dry = not args.apply

    epics = {p.stem: parse(p) for p in sorted(EPICS.glob("*.md"))}
    issues = {p.stem: parse(p) for p in sorted(ISSUES.glob("*.md"))}
    numbers = json.loads(MAP.read_text()) if MAP.exists() else {}

    unknown = {d for m in issues.values() for d in m.get("blocked_by", []) if d not in issues}
    if unknown:
        sys.exit(f"unknown dependencies: {sorted(unknown)}")
    reused = [int(m["reprend"]) for m in issues.values() if m.get("reprend")]
    if len(reused) != len(set(reused)):
        sys.exit("an issue number is reused twice")
    if not dry:
        for n in reused:
            state = json.loads(gh("issue", "view", str(n), "-R", REPO, "--json", "state"))["state"]
            if state != "OPEN":
                sys.exit(f"#{n} is {state}: only open issues are rewritten")

    print(f"{'DRY RUN' if dry else 'APPLY'} on {REPO}: {len(epics)} epics, {len(issues)} issues "
          f"({len(reused)} rewritten in place), {len(numbers)} already handled")

    # 1. labels and milestones
    existing = set() if dry else {l["name"] for l in json.loads(gh("label", "list", "-R", REPO, "--limit", "200", "--json", "name"))}
    for name, (color, desc) in LABELS.items():
        if name not in existing:
            print(f"label     + {name}")
            if not dry:
                gh("label", "create", name, "-R", REPO, "--color", color, "--description", desc)
    ms_existing = set() if dry else {m["title"] for m in json.loads(gh("api", f"repos/{REPO}/milestones?state=all&per_page=100"))}
    for title, desc in MILESTONES.items():
        if title not in ms_existing:
            print(f"milestone + {title}")
            if not dry:
                gh("api", f"repos/{REPO}/milestones", "-f", f"title={title}", "-f", f"description={desc}")

    def handle(key, meta, kind):
        if key in numbers:
            return
        title = meta["title"] if kind == "epic" else f"[{meta['id']}] {meta['title']}"
        labels = labels_for(meta, kind)
        ms = meta.get("milestone") or ""
        target = meta.get("reprend")
        verb = f"rewrite #{target}" if target else "create"
        print(f"issue     {verb:<12} {title}  [{', '.join(labels)}]{'  ' + ms if ms else ''}")
        if dry:
            numbers[key] = int(target) if target else f"<{key}>"
            return
        body = body_for(meta, numbers, kind)
        if target:
            n = int(target)
            current = json.loads(gh("issue", "view", str(n), "-R", REPO, "--json", "labels"))["labels"]
            cmd = ["issue", "edit", str(n), "-R", REPO, "--title", title, "--body-file", "-", "--milestone", ms]
            for l in labels:
                cmd += ["--add-label", l]
            for l in current:
                if l["name"] not in labels:
                    cmd += ["--remove-label", l["name"]]
            gh(*cmd, input=body)
            numbers[key] = n
        else:
            cmd = ["issue", "create", "-R", REPO, "--title", title, "--body-file", "-"]
            for l in labels:
                cmd += ["--label", l]
            if ms:
                cmd += ["--milestone", ms]
            url = gh(*cmd, input=body).strip()
            numbers[key] = int(url.rsplit("/", 1)[1])
        MAP.write_text(json.dumps(numbers, indent=2, ensure_ascii=False) + "\n")

    # 2. epics, then issues in dependency order
    for meta in epics.values():
        handle(meta["id"], meta, "epic")
    for i in topo(issues):
        handle(i, issues[i], "issue")

    if dry:
        # Bodies are rendered with placeholder numbers: catch formatting errors now.
        for i in issues:
            body_for(issues[i], numbers, "issue")

    # 3. sub-issues and native dependencies
    ids = {}

    def db_id(n):
        if n not in ids:
            ids[n] = json.loads(gh("api", f"repos/{REPO}/issues/{n}"))["id"]
        return ids[n]

    def link_sub(parent, child, label):
        print(f"link      {label}")
        if dry:
            return
        try:
            gh("api", "-X", "POST", f"repos/{REPO}/issues/{parent}/sub_issues",
               "-F", f"sub_issue_id={db_id(child)}", "-F", "replace_parent=true")
        except RuntimeError as e:
            if "already" not in str(e).lower():
                print(f"  warn: {e}")

    for meta in epics.values():
        link_sub(PRD, numbers[meta["id"]], f"{meta['id']} -> sub-issue of #{PRD}")
    for i, meta in issues.items():
        parent = f"EPIC-{meta['epic']}"
        deps = meta.get("blocked_by", [])
        link_sub(numbers[parent], numbers[i], f"{i} -> sub-issue of {parent}; blocked by {', '.join(deps) or '-'}")
        if dry:
            continue
        wanted = {db_id(numbers[d]) for d in deps}
        if meta.get("reprend"):
            for dep in json.loads(gh("api", f"repos/{REPO}/issues/{numbers[i]}/dependencies/blocked_by")):
                if dep["id"] not in wanted:
                    print(f"  unlink stale blocked by #{dep['number']}")
                    gh("api", "-X", "DELETE", f"repos/{REPO}/issues/{numbers[i]}/dependencies/blocked_by/{dep['id']}")
        for d in deps:
            try:
                gh("api", "-X", "POST", f"repos/{REPO}/issues/{numbers[i]}/dependencies/blocked_by",
                   "-F", f"issue_id={db_id(numbers[d])}")
            except RuntimeError as e:
                if "already" not in str(e).lower():
                    print(f"  warn: {e}")

    # 4. obsolete labels
    for name in OBSOLETE_LABELS:
        print(f"label     - {name}")
        if not dry and name in existing:
            gh("label", "delete", name, "-R", REPO, "--yes")

    # 5. project
    if args.project:
        setup_project(args.project, issues, epics, numbers, dry)

    print("done" if not dry else "dry run finished: nothing was changed")


def setup_project(title, issues, epics, numbers, dry):
    fields = {"Priorité": ["P0", "P1", "P2"], "Taille": ["S", "M", "L"]}
    print(f"project   + {title} with fields {', '.join(fields)}; {len(epics) + len(issues)} items")
    if dry:
        return
    projects = json.loads(gh("project", "list", "--owner", OWNER, "--format", "json"))["projects"]
    proj = next((p for p in projects if p["title"] == title), None)
    if not proj:
        proj = json.loads(gh("project", "create", "--owner", OWNER, "--title", title, "--format", "json"))
        gh("project", "link", str(proj["number"]), "--owner", OWNER, "--repo", REPO)
    pnum, pid = proj["number"], proj["id"]
    existing = {f["name"] for f in json.loads(gh("project", "field-list", str(pnum), "--owner", OWNER, "--format", "json"))["fields"]}
    for name, opts in fields.items():
        if name not in existing:
            gh("project", "field-create", str(pnum), "--owner", OWNER, "--name", name,
               "--data-type", "SINGLE_SELECT", "--single-select-options", ",".join(opts))
    fl = {f["name"]: f for f in json.loads(gh("project", "field-list", str(pnum), "--owner", OWNER, "--format", "json"))["fields"]}

    def opt(field, value):
        return next((o["id"] for o in fl[field].get("options", []) if o["name"] == value), None)

    for key in [m["id"] for m in epics.values()] + list(issues):
        url = f"https://github.com/{REPO}/issues/{numbers[key]}"
        item = json.loads(gh("project", "item-add", str(pnum), "--owner", OWNER, "--url", url, "--format", "json"))
        meta = issues.get(key)
        if not meta:
            continue
        for field, value in (("Priorité", meta["priority"]), ("Taille", meta["size"])):
            oid = opt(field, value)
            if oid:
                gh("project", "item-edit", "--id", item["id"], "--project-id", pid,
                   "--field-id", fl[field]["id"], "--single-select-option-id", oid)
    print("project: add the Status options 'In review' and 'Blocked' by hand (built-in field)")


if __name__ == "__main__":
    main()
