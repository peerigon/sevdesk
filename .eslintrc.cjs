module.exports = {
  extends: [
    "peerigon/presets/prettier-typescript.js",
    // See https://github.com/peerigon/eslint-config-peerigon#peerigonstylesno-default-export
    "peerigon/styles/no-default-export",
  ],
  env: {
    node: true,
  },
  root: true,
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: "./tsconfig.json",
    sourceType: "module",
  },
};
