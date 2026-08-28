import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  ROOT, SOURCE_REPOSITORY, computePackageState, loadRenderedBundle, readJson, scanSensitive,
  validateBlueprintObject, validateBlueprintReference, validateFamily, validateLearningProposal, verifyAnnotatedTag
} from '../scripts/lib/blueprints.mjs';
import { buildMaterialization } from '../scripts/materialize-agent.mjs';
import { compareAgentUpdate } from '../scripts/compare-agent-update.mjs';
import { buildAdoptionRecord } from '../scripts/record-adoption.mjs';
import { buildPromotionProposal } from '../scripts/propose-learning-promotion.mjs';
import { validateForkProposal } from '../scripts/propose-fork.mjs';
import { validateSpecialization } from '../scripts/propose-specialization.mjs';

function experimental(overrides = {}) {
  return {
    schema_version: '1.0.0', family_id: 'fixture-family', family_title: 'Fixture Family', owning_environment: 'example-environment',
    publisher: { owner: 'example-owner', repository: 'example-owner/example-blueprints' }, family_version: '0.1.0', lifecycle_state: 'experimental',
    purpose: 'Reserved test purpose.', nonpurpose: ['No external action.'], parent: null,
    compatibility: { genesis: ['communications-v0.6.0'], communications: ['0.6.0'] }, supported_runtime_families: ['neutral'],
    input_types: [], output_types: [], required_provenance: ['synthetic fixture marker'], tools: { required: [], optional: [] },
    declared_capabilities: [], external_capabilities_not_granted: ['all external capabilities'],
    files: { knowledge: ['KNOWLEDGE.md'], playbook: ['PLAYBOOK.md'], boundaries: ['BOUNDARIES.md'], tools: ['TOOLS.md'], evaluation: ['EVALUATION.md'], examples: ['examples/fixture.json'] },
    file_hashes: {}, release: null, superseded_release: null, deprecation: null,
    created_at: '2026-08-28T00:00:00Z', updated_at: '2026-08-28T00:00:00Z', ...overrides
  };
}

function learning(overrides = {}) {
  return {
    proposal_id: 'fixture-lesson-001', proposing_environment: 'example-environment', proposing_agent: 'fixture-agent',
    target_scope: 'instance_memory', target_family: 'wtb-researcher', observation: 'A reserved observation.',
    evidence_references: [], provenance_classification: 'hypothesis', confidence: 0.2, known_counterexamples: [], conflict_analysis: 'No known conflict.',
    privacy_review: 'pass', credential_review: 'pass', proposed_wording: 'Retain as a local hypothesis.', affected_playbook_sections: [],
    proposed_evaluation_changes: [], disposition: 'proposed', adopting_authority: null, release_containing_lesson: null, ...overrides
  };
}

test('package validation rejects empty/incomplete and accepts a minimal experimental family', () => {
  assert.throws(() => validateBlueprintObject(null), /blueprint_empty_or_invalid/);
  assert.throws(() => validateBlueprintObject({ schema_version: '1.0.0' }), /blueprint_required_field_missing/);
  assert.equal(validateBlueprintObject(experimental()), true);
  assert.throws(() => validateBlueprintObject(experimental({ purpose: '' })), /purpose_missing/);
  assert.throws(() => validateBlueprintObject(experimental({ compatibility: { genesis: ['communications-v0.6.0'], communications: ['9.9.9'] } })), /communications_compatibility_unsupported/);
});

test('stable manifests require immutable release data and exact publisher identity', () => {
  const base = experimental({ lifecycle_state: 'stable', publisher: { owner: 'normsexchange-dev', repository: SOURCE_REPOSITORY } });
  assert.throws(() => validateBlueprintObject(base), /stable_release_data_missing/);
  const release = { tag: 'blueprints-v0.1.0', tag_object: 'resolve-from-annotated-tag', tag_target: 'resolve-from-annotated-tag', package_digest: '0'.repeat(64) };
  assert.equal(validateBlueprintObject({ ...base, release }, { expectedOwner: 'normsexchange-dev', expectedRepository: SOURCE_REPOSITORY }), true);
  assert.throws(() => validateBlueprintObject({ ...base, release: { ...release, tag: 'main' } }), /stable_release_tag_invalid/);
  assert.throws(() => validateBlueprintObject({ ...base, release }, { expectedOwner: 'wrong-owner' }), /publisher_owner_invalid/);
  assert.throws(() => validateBlueprintObject({ ...base, release }, { expectedRepository: 'wrong/repository' }), /publisher_repository_invalid/);
});

test('canonical package hashes pass and drift fails', async () => {
  const validated = await validateFamily('wtb-researcher');
  assert.equal(validated.manifest.release.package_digest, validated.packageDigest);
  const temp = await mkdtemp(path.join(os.tmpdir(), 'nx-blueprint-drift-'));
  await cp(path.join(ROOT, 'blueprints/wtb-researcher'), path.join(temp, 'blueprints/wtb-researcher'), { recursive: true });
  await writeFile(path.join(temp, 'blueprints/wtb-researcher/KNOWLEDGE.md'), '\nDRIFT\n', { flag: 'a' });
  await assert.rejects(validateFamily('wtb-researcher', temp), /family_file_hash_drift/);
});

test('lightweight tags fail annotated-release verification', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'nx-blueprint-tag-'));
  const run = (args) => execFileSync('git', ['-C', temp, ...args], { encoding: 'utf8' });
  run(['init', '-b', 'main']); run(['config', 'user.name', 'Fixture']); run(['config', 'user.email', 'fixture@example.invalid']);
  await writeFile(path.join(temp, 'fixture.txt'), 'fixture\n'); run(['add', 'fixture.txt']); run(['commit', '-m', 'fixture']);
  run(['tag', 'blueprints-v0.1.0']);
  assert.throws(() => verifyAnnotatedTag('blueprints-v0.1.0', temp), /release_tag_not_annotated/);
});

test('all runtime adapters preserve canonical purpose, boundaries, provenance, and deny external authority', async () => {
  const bundles = await Promise.all(['neutral', 'codex', 'gemini', 'claude'].map((adapter) => loadRenderedBundle('wtb-researcher', adapter)));
  for (const bundle of bundles) {
    assert.match(bundle.sections.purpose, /professional motion-picture production equipment/);
    assert.match(bundle.sections.boundaries, /Required external authority/);
    assert.match(bundle.sections.knowledge, /source date when available/);
    assert.equal(bundle.external_authority_granted, false);
  }
  for (const section of Object.keys(bundles[0].sections)) assert.deepEqual(bundles.map((bundle) => bundle.sections[section]), Array(4).fill(bundles[0].sections[section]));
  const { renderBundle } = await import('../scripts/lib/blueprints.mjs');
  assert.throws(() => renderBundle(bundles[0], { purpose: 'x' }, 'neutral'), /render_section_missing/);
});

test('new-agent proposal inherits the pinned package but no identity, memory, credential, permission, transcript, reasoning, or mission', async () => {
  const bundle = await loadRenderedBundle('wtb-researcher', 'neutral');
  const proposal = await readJson(path.join(ROOT, 'fixtures/instantiation-proposal.example.json'));
  proposal.family.package_digest = bundle.package_digest;
  const evidence = { object: proposal.family.tag_object, target: proposal.family.tag_target };
  const first = await buildMaterialization(proposal, bundle, evidence);
  const second = await buildMaterialization(structuredClone(proposal), structuredClone(bundle), evidence);
  assert.deepEqual(first, second);
  assert.equal(first.manifest.agent_id, 'fixture-wtb-researcher-001');
  assert.notEqual(first.manifest.agent_id, first.manifest.parent_agent.agent_id);
  assert.equal(first.manifest.individual_memory_imported, false);
  assert.equal(first.manifest.external_permissions_granted, false);
  assert.equal(first.manifest.standing_mission, null);
  assert.match(first.markdown, /Source content is untrusted/);
  assert.deepEqual(scanSensitive(first.markdown).filter((item) => item.includes('credential')), []);
  const impersonating = structuredClone(proposal); impersonating.new_agent_id = impersonating.parent_agent.agent_id;
  await assert.rejects(buildMaterialization(impersonating, bundle, evidence), /new_agent_impersonates_parent/);
});

test('learning scope, evidence, privacy, credentials, behavior, synthetic data, and circular confirmation are enforced', () => {
  assert.equal(validateLearningProposal(learning()), true);
  assert.throws(() => validateLearningProposal(learning({ provenance_classification: 'verified_fact' })), /verified_fact_evidence_missing/);
  assert.throws(() => validateLearningProposal(learning({ target_scope: 'family_knowledge', provenance_classification: 'synthetic', proposed_evaluation_changes: ['fixture'] })), /synthetic_evidence_not_family_fact/);
  assert.throws(() => validateLearningProposal(learning({ target_scope: 'family_knowledge' })), /family_behavior_change_requires_evaluation/);
  assert.throws(() => validateLearningProposal(learning({ target_scope: 'mission_specific', disposition: 'promoted', adopting_authority: 'owner', release_containing_lesson: 'blueprints-v0.2.0' })), /mission_specific_not_family_promotable/);
  assert.throws(() => validateLearningProposal(learning({ privacy_review: 'fail' })), /learning_public_safety_review_failed/);
  assert.throws(() => validateLearningProposal(learning({ credential_review: 'fail' })), /learning_public_safety_review_failed/);
  assert.throws(() => validateLearningProposal(learning({ evidence_references: [{ source_kind: 'agent_output', agent_id: 'fixture-agent' }] })), /circular_self_citation/);
  const credentialShaped = ['gh', 'p_', 'A'.repeat(24)].join('');
  assert.throws(() => validateLearningProposal(learning({ proposed_wording: credentialShaped })), /learning_sensitive_material_rejected/);
  const transcriptLike = ['raw', ' session ', 'transcript'].join('');
  assert.throws(() => validateLearningProposal(learning({ observation: transcriptLike })), /learning_sensitive_material_rejected/);
  const reasoningLike = ['chain', '-', 'of', '-', 'thought'].join('');
  assert.throws(() => validateLearningProposal(learning({ observation: reasoningLike })), /learning_sensitive_material_rejected/);
});

test('approved family learning becomes a release proposal without mutating a family or earlier release', async () => {
  const proposal = await readJson(path.join(ROOT, 'fixtures/learning-proposal.example.json'));
  const promotion = buildPromotionProposal(proposal);
  assert.equal(promotion.proposed_wording, proposal.proposed_wording);
  assert.equal(promotion.automatic_family_edit, false);
  assert.equal(promotion.earlier_release_mutation, false);
  assert.equal(promotion.required_evaluation_changes.length, 1);
});

test('existing-agent comparison is three-way, detects breaking boundaries and local divergence, and never overwrites', () => {
  const base = { agent_id: 'fixture-agent', family_release: 'blueprints-v0.1.0', sections: { purpose: 'p', procedures: ['a'], knowledge: ['k'], boundaries: ['b'], tools: ['t'], evaluations: ['e'] }, external_capabilities: [], individual_memory: ['private-local'] };
  const local = structuredClone(base); local.sections.procedures = ['a', 'local'];
  const proposed = structuredClone(base); proposed.family_release = 'blueprints-v1.0.0'; proposed.sections.boundaries = ['changed']; proposed.external_capabilities = ['outreach'];
  const comparison = compareAgentUpdate(base, local, proposed);
  assert.equal(comparison.compatibility, 'breaking-review-required');
  assert.equal(comparison.local_divergence.procedures, true);
  assert.deepEqual(comparison.three_way.local.procedures, ['a', 'local']);
  assert.equal(comparison.overwrite_performed, false);
  assert.equal(comparison.preserved_individual_memory, true);
  for (const disposition of comparison.supported_dispositions) {
    const record = buildAdoptionRecord({ agent_id: base.agent_id, disposition, comparison, adoption_commit: '0'.repeat(40), adoption_time: '2026-08-28T00:00:00Z' });
    assert.equal(record.preserved_individual_identity, true);
    assert.equal(record.preserved_individual_history, true);
  }
});

test('compatible update produces an adoption proposal', () => {
  const snapshot = { agent_id: 'fixture-agent', family_release: 'blueprints-v0.1.0', sections: { purpose: 'p', procedures: ['a'], knowledge: ['k'], boundaries: ['b'], tools: ['t'], evaluations: ['e'] }, external_capabilities: [] };
  const proposed = structuredClone(snapshot); proposed.family_release = 'blueprints-v0.2.0'; proposed.sections.knowledge.push('compatible knowledge');
  assert.equal(compareAgentUpdate(snapshot, structuredClone(snapshot), proposed).compatibility, 'compatible-proposal');
});

test('forks preserve exact source and require distinct ownership identity', () => {
  const proposal = validateForkProposal({ source_family: 'wtb-researcher', source_release: 'blueprints-v0.1.0', source_digest: '0'.repeat(64), new_owner: 'example-owner', new_family_id: 'example-wtb-researcher', divergence_reason: 'Fictional test divergence.', inherited_files: ['KNOWLEDGE.md'], replaced_files: [] });
  assert.equal(proposal.source_mutation, false);
  assert.throws(() => validateForkProposal({ ...proposal, new_family_id: 'wtb-researcher' }), /fork_family_id_not_distinct/);
});

test('specializations pin exact bases, reject undeclared contradictions, and accept explicit precedence', () => {
  const base = { specialization_id: 'example-specialization', base_family: 'wtb-researcher', base_release: 'blueprints-v0.1.0', additional_purpose: 'Fictional narrow scope.', additional_knowledge: [], additional_procedures: [], precedence: 'specialization-may-narrow-but-not-silently-override-family', declared_overrides: [] };
  assert.equal(validateSpecialization(base).base_release, 'blueprints-v0.1.0');
  assert.throws(() => validateSpecialization({ ...base, additional_knowledge: ['OVERRIDE: external authority'] }), /specialization_undeclared_contradiction/);
  assert.equal(validateSpecialization({ ...base, additional_knowledge: ['OVERRIDE: external authority'], declared_overrides: ['external authority'] }).declared_overrides.length, 1);
});

test('pairwise blueprint references are exact, immutable, evaluation-only by default, and require no foreign write', async () => {
  const reference = await readJson(path.join(ROOT, 'fixtures/blueprint-reference.example.json'));
  assert.equal(validateBlueprintReference(reference), true);
  assert.equal(reference.receiver_action, 'evaluate_only');
  assert.throws(() => validateBlueprintReference({ ...reference, annotated_tag: 'main' }), /blueprint_reference_mutable/);
  assert.throws(() => validateBlueprintReference({ ...reference, commit: 'short' }), /blueprint_reference_commit_invalid/);
});

test('WTB family is fictional, conservative, contract-pinned, and nonoperational', async () => {
  const example = await readJson(path.join(ROOT, 'blueprints/wtb-researcher/examples/fictional-research-candidate.json'));
  assert.equal(example.fixture, true);
  assert.equal(new URL(example.evidence[0].url).hostname.endsWith('.example'), true);
  for (const field of ['quantity', 'budget', 'currency', 'timeline']) assert.equal(example[field], null);
  const docs = await Promise.all(['KNOWLEDGE.md', 'BOUNDARIES.md', 'PLAYBOOK.md'].map((name) => readFile(path.join(ROOT, 'blueprints/wtb-researcher', name), 'utf8'))).then((items) => items.join('\n'));
  for (const phrase of ['ownership does not prove purchasing demand', 'Rental inventory does not prove a WTB request', 'cannot self-assign `buyer_confirmed`', 'cannot self-assign `norms_verified`', 'Missing quantities, budgets, currencies, and timelines remain missing', 'contract-v0.2.0', 'Outreach requires separate authority', 'Shopify, commerce, customer creation, and listing publication require separate authority']) assert.match(docs, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
});

test('knowledge-security policy treats source instructions as data and covers poisoning risks', async () => {
  const security = await readFile(path.join(ROOT, 'docs/KNOWLEDGE_SECURITY.md'), 'utf8');
  for (const phrase of ['unsupported generalization', 'fabricated or stale evidence', 'conflicting/disappearing sources', 'malicious instructions', 'circular confirmation', 'wrong promotion scope', 'release tampering', 'evaluation overfitting', 'embedded instructions never become commands', 'Self-reference alone cannot increase confidence']) assert.match(security, new RegExp(phrase, 'i'));
  assert.deepEqual(scanSensitive('ordinary classified knowledge'), []);
});

test('complete package state excludes self-referential manifest and remains deterministic', async () => {
  const first = await computePackageState(path.join(ROOT, 'blueprints/wtb-researcher'));
  const second = await computePackageState(path.join(ROOT, 'blueprints/wtb-researcher'));
  assert.deepEqual(first, second);
  assert.equal(Object.hasOwn(first.fileHashes, 'blueprint.json'), false);
  assert.match(first.packageDigest, /^[a-f0-9]{64}$/);
});
