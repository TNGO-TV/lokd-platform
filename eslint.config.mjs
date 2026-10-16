import policy from './config/eslint-policy.json' with {type:'json'};
import react from '@lokd/eslint-plugin-react-compat';
import hooks from 'eslint-plugin-react-hooks';
import a11y from 'eslint-plugin-jsx-a11y-x';
import imports from 'eslint-plugin-import-x';
import next from '@next/eslint-plugin-next';
import ts from 'typescript-eslint';

const plugins={react,'react-hooks':hooks,'jsx-a11y':a11y,import:imports,'@next/next':next,'@typescript-eslint':ts.plugin};
// Preserve the recorded Next16.3.8 policy; dependency replacement does not reset rules.
const eslintConfig = [
 {ignores:['**/node_modules/**','.next/**','out/**','build/**','next-env.d.ts','dist/**','.sites-runtime/**','vendor/**']},
 ...Object.entries(policy.extensions).map(([extension,profile])=>{
  const p=policy.profiles[profile];
  return {files:['**/*.'+extension],languageOptions:{parser:ts.parser,parserOptions:p.parserOptions,ecmaVersion:p.ecmaVersion,sourceType:p.sourceType,...(p.globals?{globals:p.globals}:{})},plugins,...(p.settings?{settings:p.settings}:{}),rules:p.rules};
 }),
];

export default eslintConfig;
