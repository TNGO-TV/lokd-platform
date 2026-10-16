import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as portals from '../app/lib/public-site.ts';

// Exercise the real component event handlers with inert hook/data boundaries.
// No authenticated page, database, provider or browser network is involved.
function component(name) {
  const pushes = [], location = {href: 'https://example.test/current'};
  const jsx = (type, props) => ({type, props});
  const empty = () => null;
  const modules = {
    'react/jsx-runtime': {jsx, jsxs: jsx, Fragment: 'fragment'},
    react: {useState: value => [value, () => {}], useEffect: () => {}},
    'next/navigation': {useRouter: () => ({push: path => pushes.push(path)})},
    'next/image': {default: empty},
    '../lib/public-site': portals,
    '../lib/use-pilot': {usePilot: () => ({state: null, loading: true, busy: false})},
    '../lib/use-operations': {useOperations: () => ({state: null})},
    './portal-onboarding-summary': {PortalOnboardingSummary: empty},
    './portal-specialist-packs': {PortalSpecialistPacks: empty},
  };
  const source = fs.readFileSync(new URL(`../app/components/${name}.tsx`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {compilerOptions: {jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  const exports = {};
  vm.runInNewContext(code, {exports, require: key => {assert.ok(Object.hasOwn(modules, key), key); return modules[key];}, window: {location, setTimeout: () => 0}, Intl});
  return {render: exports.default, pushes, location};
}

function find(node, predicate) {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return null;
}

test('officer and Operations join actions use client navigation; external client destinations stay full navigation', async () => {
  const officer = component('officer-app');
  const apply = find(officer.render(), node => node.type === 'button' && node.props.children === 'Apply / get qualified');
  assert.ok(apply); apply.props.onClick();
  assert.deepEqual(officer.pushes, ['/join']);
  assert.equal(officer.location.href, 'https://example.test/current');
  for (const name of ['Officers', 'Bookings', 'Clients']) {
    const workspace = component('workspace-view');
    const top = find(workspace.render({name}), node => node.props?.name === name && typeof node.props.onAction === 'function');
    assert.ok(top); await top.props.onAction();
    assert.deepEqual(workspace.pushes, name === 'Officers' ? ['/join'] : []);
    assert.equal(workspace.location.href, name === 'Officers' ? 'https://example.test/current' : portals.CLIENT_PORTAL_URL);
  }
});
