import { create } from 'storybook/theming';

// L'habillage de Storybook lui-même (barre latérale, pages de documentation),
// aligné sur la planche : fond `surface`, texte `on-surface`, accent `primary`
// (`inverse-primary` pour la sélection, où Storybook écrit en blanc).
// Storybook ne lit pas les variables CSS : les valeurs sont recopiées de
// `packages/theme/tokens.css`.
export const theme = create({
  base: 'dark',
  brandTitle: 'Personal OS · design system',
  fontBase: "'Inter Variable', ui-sans-serif, system-ui, sans-serif",
  fontCode: "'JetBrains Mono Variable', ui-monospace, monospace",
  colorPrimary: '#adc6ff',
  colorSecondary: '#005ac2',
  appBg: '#0a0e14',
  appContentBg: '#10141a',
  appPreviewBg: '#10141a',
  appBorderColor: '#31353c',
  appBorderRadius: 8,
  textColor: '#dfe2eb',
  textMutedColor: '#8c909f',
  barBg: '#0a0e14',
  barTextColor: '#c2c6d6',
  barSelectedColor: '#adc6ff',
  inputBg: '#0a0e14',
  inputBorder: '#31353c',
  inputTextColor: '#dfe2eb',
  inputBorderRadius: 8,
});
