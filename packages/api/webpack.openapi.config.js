const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

// Le générateur de l'OpenAPI (`nx run api:openapi`) : l'API elle-même, avec
// un autre point d'entrée. Il ne fait pas partie de l'image.
module.exports = {
  output: {
    path: join(__dirname, '../../dist/packages/api-openapi'),
    clean: true,
  },
  plugins: [
    new NxAppWebpackPlugin({
      target: 'node',
      compiler: 'tsc',
      main: './src/openapi.main.ts',
      tsConfig: './tsconfig.app.json',
      optimization: false,
      outputHashing: 'none',
      sourceMap: false,
    }),
  ],
};
