import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ALERT_RATIO,
  DEFAULT_QUOTA,
  minutesReport,
  quotaDe,
} from './actions-minutes.mjs';

// Dernière seconde du mois : la projection égale la consommation.
const OCT_END = new Date('2026-10-31T23:59:59Z');
const day = (product, unitType, quantity) => ({
  date: '2026-10-09',
  product,
  sku: `${product}_linux`,
  unitType,
  quantity,
});

test('additionne les minutes Actions du mois, sans les autres produits ni unités', () => {
  const report = minutesReport(
    [
      day('actions', 'Minutes', 600),
      day('Actions', 'minutes', 400),
      day('actions', 'GigabyteHours', 50),
      day('git_lfs', 'Minutes', 999),
    ],
    2000,
    OCT_END,
  );
  assert.equal(report.used, 1000);
  assert.equal(report.alert, false);
});

test('alerte dès 80 % du quota mensuel', () => {
  assert.equal(ALERT_RATIO, 0.8);
  assert.equal(
    minutesReport([day('actions', 'Minutes', 1599)], 2000, OCT_END).alert,
    false,
  );
  assert.equal(
    minutesReport([day('actions', 'Minutes', 1600)], 2000, OCT_END).alert,
    true,
  );
  assert.equal(
    minutesReport([day('actions', 'Minutes', 1600)], 3000, OCT_END).alert,
    false,
  );
});

// Projection à la fin du mois, au rythme du mois en cours.
const OCT_11 = new Date('2026-10-11T00:00:00Z');

test('projette la consommation à la fin du mois au rythme déjà pris', () => {
  const report = minutesReport([day('actions', 'Minutes', 1000)], 3000, OCT_11);
  assert.equal(report.projected, 3100);
  assert.equal(
    report.alert,
    true,
    'projection au-dessus du quota : alerte avant les 80 %',
  );
  assert.equal(
    minutesReport([day('actions', 'Minutes', 900)], 3000, OCT_11).alert,
    false,
  );
});

test('ne projette pas le premier jour sur moins de 24 heures', () => {
  const report = minutesReport(
    [day('actions', 'Minutes', 40)],
    3000,
    new Date('2026-11-01T02:00:00Z'),
  );
  assert.equal(report.projected, 1200);
});

test('montant facturé du mois : netAmount des lignes Actions, stockage compris', () => {
  const report = minutesReport(
    [
      { ...day('actions', 'Minutes', 3000), netAmount: 0 },
      { ...day('actions', 'Minutes', 2000), netAmount: 12 },
      { ...day('actions', 'GigabyteHours', 50), netAmount: 0.5 },
      { ...day('git_lfs', 'Minutes', 999), netAmount: 99 },
      day('actions', 'Minutes', 10),
    ],
    3000,
    OCT_END,
  );
  assert.equal(report.billed, 12.5);
});

test('quota : ACTIONS_MINUTES_QUOTA, sinon les 3 000 minutes de GitHub Pro', () => {
  assert.equal(DEFAULT_QUOTA, 3000);
  assert.equal(quotaDe('2000'), 2000);
  assert.equal(quotaDe(''), DEFAULT_QUOTA);
  assert.equal(quotaDe(undefined), DEFAULT_QUOTA);
});

test('refuse un quota illisible plutôt que de surveiller le mauvais seuil', () => {
  assert.throws(() => quotaDe('3 000'), /ACTIONS_MINUTES_QUOTA/);
  assert.throws(() => quotaDe('0'), /ACTIONS_MINUTES_QUOTA/);
  assert.throws(() => quotaDe('-5'), /ACTIONS_MINUTES_QUOTA/);
});
