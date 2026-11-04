import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { makeFixture, run } from './run-script';

/** Un `sendmail` qui garde le courriel au lieu de l'envoyer. */
function banc(courriel: string) {
  const fixture = makeFixture({ extraConf: courriel ? `DEPLOY_ALERT_EMAIL=${courriel}` : '' });
  const faux = join(fixture.dir, 'faux');
  mkdirSync(faux);
  const boite = join(fixture.dir, 'courriel.txt');
  writeFileSync(join(faux, 'sendmail'), `#!/usr/bin/env bash\ncat >"${boite}"\n`);
  chmodSync(join(faux, 'sendmail'), 0o755);
  const journal = join(fixture.dir, 'deploy-trigger-staging.log');
  writeFileSync(
    journal,
    Array.from({ length: 80 }, (_, i) => `ligne ${i + 1}`).join('\n') + '\n'
  );
  return { fixture, boite, journal, env: { PATH: `${faux}:${process.env.PATH}` } };
}

describe('notify-failure.sh', () => {
  it('envoie la fin du journal du déploiement en échec', () => {
    const { fixture, boite, journal, env } = banc('moi@exemple.test');

    const resultat = run('notify-failure.sh', ['déploiement staging', journal], fixture, env);

    expect(resultat.status).toBe(0);
    const courriel = readFileSync(boite, 'utf8');
    expect(courriel).toContain('To: moi@exemple.test');
    expect(courriel).toMatch(/^Subject: .*échec : déploiement staging/m);
    expect(courriel).toContain('ligne 80');
    expect(courriel).toContain('ligne 31');
    expect(courriel).not.toContain('ligne 30\n');
  });

  it("n'envoie rien sans adresse, et le dit", () => {
    const { fixture, boite, journal, env } = banc('');

    const resultat = run('notify-failure.sh', ['déploiement prod', journal], fixture, env);

    expect(resultat.status).toBe(0);
    expect(existsSync(boite)).toBe(false);
    expect(resultat.stderr).toContain('DEPLOY_ALERT_EMAIL absent');
  });
});
