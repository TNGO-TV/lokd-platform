'use strict';
// ESLint's maintained API adapter supplies removed context/SourceCode methods.
// Original rule implementations remain unchanged and are tested for parity.
const {fixupPluginRules}=require('@eslint/compat');
module.exports=fixupPluginRules(require('./index.js'));
