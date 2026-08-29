import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { ROOT, readJson, scanSensitive, validateFamily, validateLearningProposal, verifyAnnotatedTag, walk } from '../scripts/lib/blueprints.mjs';
import { buildFuturePrompts } from '../scripts/render-future-prompts.mjs';
import { buildInheritanceProof } from '../scripts/prove-inheritance.mjs';

const REVIEW = path.join(ROOT, 'reviews/gemini-snapshot-post-alignment');
const SOURCE_REPOSITORY = 'normsexchange-gemini/nx-gemini-communications_dev';
const SOURCE_TAG_OBJECT = '98db76569ee59266f0d9e914cb06280041e7fa02';
const SOURCE_TAG_TARGET = '857111e7c39b355e3a7f6f999c6997a5449424d7';
const SOURCE_TREE = '58f01277d3ef07ae052ba1d49c69d58dffb2e809';

test('foreign source review pins exact public Git evidence and the complete baseline diff', async () => {
  const source = await readJson(path.join(REVIEW, 'source.json'));
  assert.equal(source.repository, SOURCE_REPOSITORY);
  assert.equal(source.repository_id, '1346945284');
  assert.equal(source.visibility, 'public');
  assert.equal(source.authoritative_reference.tag, 'snapshot-post-alignment');
  assert.equal(source.authoritative_reference.tag_object, SOURCE_TAG_OBJECT);
  assert.equal(source.authoritative_reference.tag_target, SOURCE_TAG_TARGET);
  assert.equal(source.authoritative_reference.tree, SOURCE_TREE);
  assert.equal(source.previous_review_baseline.tag_object, '08400d37ec4eff309431158782b6410b3ef734c8');
  assert.equal(source.previous_review_baseline.tag_target, '7c87b1e289324c41c218336e2967a8fd4b3dede3');
  assert.equal(source.changed_paths.length, 7);
  assert.equal(source.source_files.length, 17);
  assert.equal(source.source_credential_review, 'UNKNOWN');
  assert.equal(source.independent_interface_verification.service_health, 'NOT_ASSESSED');
  assert.equal(source.foreign_code_executed, false);
  assert.equal(source.source_repository_modified, false);
});

test('inventory assigns exactly one initial scope to every material item', async () => {
  const inventory = await readJson(path.join(REVIEW, 'inventory.json'));
  assert.equal(inventory.items.length, 11);
  assert.deepEqual(inventory.classification_totals, {
    instance_memory: 1, family_knowledge: 2, environment_policy: 4, cross_environment_standard: 1,
    mission_specific: 0, rejected_or_unverified: 3, total: 11
  });
  assert.deepEqual(inventory.disposition_totals, {
    promoted: 2, retained_environment_policy: 4, retained_cross_environment_reference: 1,
    retained_instance_only: 1, deferred: 1, rejected: 2, total: 11
  });
  const scopes = new Set(['instance_memory', 'family_knowledge', 'environment_policy', 'cross_environment_standard', 'mission_specific', 'rejected_or_unverified']);
  for (const item of inventory.items) {
    assert.equal(item.original_publisher, 'normsexchange-gemini');
    assert.ok(scopes.has(item.initial_inheritance_classification));
    assert.ok(item.source_paths.length > 0 && item.source_paths.every((entry) => /^[a-f0-9]{64}$/.test(entry.sha256_lf)));
    assert.match(item.credential_review_status, /source unknown/);
    assert.equal(typeof item.independently_reproduced_or_validated, 'boolean');
  }
});

test('six sanitized learning proposals retain foreign publisher provenance and governed dispositions', async () => {
  const directory = path.join(REVIEW, 'learning-proposals');
  const files = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  assert.equal(files.length, 6);
  const proposals = await Promise.all(files.map((name) => readJson(path.join(directory, name))));
  for (const proposal of proposals) {
    assert.equal(validateLearningProposal(proposal), true);
    assert.equal(proposal.foreign_source.publisher_owner, 'normsexchange-gemini');
    assert.equal(proposal.foreign_source.repository, SOURCE_REPOSITORY);
    assert.equal(proposal.foreign_source.tag_object, SOURCE_TAG_OBJECT);
    assert.equal(proposal.foreign_source.tag_target, SOURCE_TAG_TARGET);
    assert.equal(proposal.foreign_source.tree, SOURCE_TREE);
    assert.equal(proposal.foreign_source.commit, SOURCE_TAG_TARGET);
    assert.equal(proposal.source_review.source_credential_review, 'unknown');
    assert.equal(proposal.privacy_review, 'pass');
    assert.equal(proposal.credential_review, 'pass');
  }
  assert.equal(proposals.filter((item) => item.disposition === 'promoted').length, 2);
  assert.equal(proposals.filter((item) => item.disposition === 'deferred').length, 3);
  assert.equal(proposals.filter((item) => item.disposition === 'rejected').length, 1);
});

test('foreign review artifacts contain no sensitive signatures or private local paths', async () => {
  for (const relative of await walk(REVIEW)) {
    const text = await readFile(path.join(REVIEW, relative), 'utf8');
    assert.deepEqual(scanSensitive(text), [], `sensitive marker in ${relative}`);
    assert.doesNotMatch(text, /[A-Za-z]:[\\/]Users[\\/]|(?:^|\s)\/(?:home|Users)\/[A-Za-z0-9._-]+\//m);
  }
});

test('promoted family rule preserves source provenance, claim states, autonomy, and external denials', async () => {
  const { manifest } = await validateFamily('wtb-researcher');
  assert.equal(manifest.family_version, '0.2.0');
  assert.equal(manifest.release.tag, 'blueprints-v0.2.0');
  assert.equal(manifest.external_capabilities_not_granted.includes('message publication'), true);
  const docs = await Promise.all(['KNOWLEDGE.md', 'PLAYBOOK.md', 'BOUNDARIES.md', 'EVALUATION.md'].map((name) => readFile(path.join(ROOT, 'blueprints/wtb-researcher', name), 'utf8'))).then((values) => values.join('\n'));
  for (const phrase of ['machine-generated', 'origin label never upgrades', 'snapshot-post-alignment', 'normsexchange-gemini', 'Internal autonomy', 'separate authority']) assert.match(docs, new RegExp(phrase, 'i'));
  const families = (await readdir(path.join(ROOT, 'blueprints'), { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  assert.deepEqual(families, ['wtb-researcher']);
});

test('held-out adverse fixtures cover conflicts without using business records', async () => {
  const fixture = await readJson(path.join(ROOT, 'blueprints/wtb-researcher/tests/foreign-learning-adverse.json'));
  assert.equal(fixture.reserved_fictional, true);
  assert.equal(fixture.scenarios.length, 7);
  const ids = fixture.scenarios.map((item) => item.id);
  for (const id of ['missing-origin-label', 'origin-label-as-evidence-upgrade', 'publisher-rule-implementation-conflict', 'foreign-instance-architecture-not-family', 'incomplete-foreign-family-not-created', 'stale-duplicate-transport-rejected', 'autonomy-preserved-no-external-authority']) assert.ok(ids.includes(id));
  assert.ok(fixture.scenarios.every((item) => /fictional|foreign|publisher|family|UI|agent/.test(item.input)));
});

test('prior annotated release objects and targets remain exact', () => {
  assert.deepEqual(verifyAnnotatedTag('blueprints-v0.1.0', ROOT, false), { object: '7a3a960ef5a3f338f8f755b272046e4f2069f3f0', target: 'b8c06ec288a1a83a00def84e401eb740b4af2793' });
  assert.deepEqual(verifyAnnotatedTag('blueprints-v0.1.1', ROOT, false), { object: 'd8e81b192ef512e3ffc7f553336c542a2210bbcc', target: '6213f271ea2d86a3da285787d7e26992fb659284' });
  const oldManifest = JSON.parse(execFileSync('git', ['-C', ROOT, 'show', 'blueprints-v0.1.1:blueprints/wtb-researcher/blueprint.json'], { encoding: 'utf8' }));
  assert.equal(oldManifest.release.package_digest, '708bd430ad513e55eab7d3a225c318ad9f50eb07565b0d746c08896285fe8c31');
});

test('future prompt renderer resolves exact release evidence without executing a prompt', async () => {
  const { manifest } = await validateFamily('wtb-researcher');
  const evidence = { object: 'a'.repeat(40), target: 'b'.repeat(40) };
  const prompts = await buildFuturePrompts(manifest, evidence);
  assert.equal(prompts.length, 6);
  for (const prompt of prompts) {
    assert.match(prompt.content, /DO NOT EXECUTE UNLESS/);
    assert.doesNotMatch(prompt.content, /\{\{/);
  }
  const combined = prompts.map((item) => item.content).join('\n');
  for (const value of [manifest.release.tag, manifest.release.package_digest, evidence.object, evidence.target]) assert.match(combined, new RegExp(value));
  for (const phrase of ['distinct environment identity', 'distinct individual-agent identity', 'sovereign owner', 'credential', 'private memory', 'active mission', 'automatic external access']) assert.match(combined, new RegExp(phrase, 'i'));
});

test('four fictional inheritance proofs are deterministic, equivalent, inactive, and permission-free', async () => {
  const { manifest } = await validateFamily('wtb-researcher');
  const evidence = { object: 'a'.repeat(40), target: 'b'.repeat(40) };
  const first = await Promise.all(['neutral', 'codex', 'gemini', 'claude'].map((adapter) => buildInheritanceProof(manifest, evidence, adapter)));
  const second = await Promise.all(['neutral', 'codex', 'gemini', 'claude'].map((adapter) => buildInheritanceProof(manifest, evidence, adapter)));
  assert.deepEqual(first.map((item) => item.proofDigest), second.map((item) => item.proofDigest));
  for (const proof of first) {
    assert.equal(proof.manifest.activation_state, 'proposed_only');
    assert.equal(proof.manifest.external_permissions_granted, false);
    assert.equal(proof.manifest.individual_memory_imported, false);
    assert.equal(proof.manifest.standing_mission, null);
    assert.equal(proof.bundle.external_authority_granted, false);
    assert.equal(proof.bundle.package_digest, manifest.release.package_digest);
    assert.deepEqual(scanSensitive(JSON.stringify(proof)), []);
  }
  for (const section of Object.keys(first[0].bundle.sections)) assert.deepEqual(first.map((item) => item.bundle.sections[section]), Array(4).fill(first[0].bundle.sections[section]));
});
