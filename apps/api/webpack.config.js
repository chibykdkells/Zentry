const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = (config) => ({
  ...config,
  externals: [
    nodeExternals({
      allowlist: [/^@zentry\//, /^@zendocx\//],
      modulesDir: path.resolve(__dirname, 'node_modules'),
      additionalModuleDirs: [path.resolve(__dirname, '../../node_modules')],
    }),
  ],
});
