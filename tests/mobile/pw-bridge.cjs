// CJS bridge that resolves playwright-core from a known sibling project,
// so the mobile-view test runs without adding a local playwright dependency.
module.exports = require('/home/terry/projects/llm_wiki/node_modules/playwright-core');
