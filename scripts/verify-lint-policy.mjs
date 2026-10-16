import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {ESLint} from 'eslint';
const root=process.cwd();
const policy=JSON.parse(fs.readFileSync(path.join(root,'config/eslint-policy.json'),'utf8'));
const fixtures=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/eslint-policy.json'),'utf8'));
const eslint=new ESLint({cwd:root});
const normalizedRules=rules=>Object.fromEntries(Object.entries(rules).map(([key,value])=>[key,value[0]===0?[0]:value]));
const effective={};
for(const [extension,profile] of Object.entries(policy.extensions)){
 const expected=policy.profiles[profile],actual=await eslint.calculateConfigForFile(path.join(root,'app','lint-fixture.'+extension));
 assert.deepEqual(normalizedRules(actual.rules),normalizedRules(expected.rules),extension+' rule policy');
 for(const key of ['parserOptions','ecmaVersion','sourceType','globals'])assert.deepEqual(actual.languageOptions[key],expected[key],extension+' '+key);
 assert.deepEqual(actual.languageOptions.parser.meta,expected.parser,extension+' parser');
 assert.deepEqual(actual.settings,expected.settings,extension+' resolver/settings');
 effective[extension]=Object.values(actual.rules).filter(value=>value[0]!==0).length;
}
const normalize=messages=>messages.map(m=>({rule:m.ruleId,severity:m.severity,line:m.line,column:m.column})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
for(const fixture of fixtures){
 const [result]=await eslint.lintText(fixture.code,{filePath:path.join(root,fixture.file)});
 assert.equal(result.fatalErrorCount,0,fixture.name+' parses');
 assert.deepEqual(normalize(result.messages),fixture.diagnostics,fixture.name);
}
console.log(JSON.stringify({effective,diagnosticFixtures:fixtures.length,baseline:policy.baseline}));
