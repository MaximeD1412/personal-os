const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = {
  output: {
    path: join(__dirname, '../../dist/packages/api'),
    clean: true,
    ...(process.env.NODE_ENV !== 'production' && {
      devtoolModuleFilenameTemplate: '[absolute-resource-path]',
    }),
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/main.ts',
      // Deux commandes de plus dans l'image, pour deploy-staging.sh (ADR 0031) :
      // le staging se réinitialise avec la même image que celle qu'il sert,
      // sans pnpm ni sources.
      //   - `node demo-seed.js` : `pnpm demo:seed`, compilé ;
      //   - `node verifier-environnement.js` : les garde-fous du démarrage de
      //     l'API, lancés avant la migration et le semis.
      // Un chemin absolu : Nx ne rapporte au projet que ceux qui commencent
      // par `./`.
      additionalEntryPoints: [
        {
          entryName: 'demo-seed',
          entryPath: join(__dirname, '../database/src/demo/main.ts'),
        },
        {
          entryName: 'verifier-environnement',
          entryPath: join(__dirname, 'src/verifier-environnement.ts'),
        },
      ],
      tsConfig: './tsconfig.app.json',
      assets: ['./src/assets'],
      optimization: false,
      outputHashing: 'none',
      generatePackageJson: true,
      sourceMap: true,
    }),
  ],
};
