import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('development interoperability note preserves release and authority boundaries', () => {
  const text = fs.readFileSync(path.join(root, 'docs/FRAMEWORK_LAYER_INTEROPERABILITY_dev.md'), 'utf8');
  for (const phrase of [
    'immutable Blueprint release remains `blueprints-v0.2.0`',
    'blueprint is optional',
    'they are not required features of PeopleBot',
    'transport would not adopt or activate the family',
    'An inaccessible source reference remains unverified',
    'does not implement A2A',
    'Discovery is not initialization'
  ]) assert.ok(text.includes(phrase), phrase);
});

test('released family compatibility remains unchanged while candidate links stay documentation-only', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'registry/families.json'), 'utf8'));
  assert.deepEqual(registry.families[0].compatible_communications_versions, ['0.6.0']);
  assert.equal(fs.readFileSync(path.join(root, 'VERSION'), 'utf8').trim(), '0.2.0');
  assert.equal(fs.existsSync(path.join(root, 'release/candidates/blueprints-v0.3.0.json')), false);
});
