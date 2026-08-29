import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SOURCE_REPOSITORY = 'normsexchange-dev/nx-agent-blueprints_dev';
export const RELEASE_TAG = 'blueprints-v0.2.0';
export const VERSION = '0.2.0';
export const PRECEDENCE = [
  'platform/system constraints',
  'repository-owner policy and capability authority',
  'environment constitution',
  'agent-family blueprint',
  'specialization or role',
  'standing mission',
  'current goal',
  'individual memory'
];
export const ADAPTERS = ['neutral', 'codex', 'gemini', 'claude'];
export const DISPOSITIONS = ['adopt', 'reject', 'defer', 'remain_on_current', 'fork', 'create_specialization'];
export const LEARNING_SCOPES = ['instance_memory', 'family_knowledge', 'environment_policy', 'cross_environment_standard', 'mission_specific', 'rejected_or_unverified'];
export const KNOWLEDGE_CLASSES = ['instruction', 'verified_fact', 'heuristic', 'example', 'hypothesis', 'known_exception', 'deprecated_rule', 'synthetic'];

export function assert(condition, code) {
  if (!condition) throw new Error(code);
}

export async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export async function walk(directory, relative = '') {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['.git', 'node_modules', '.tmp', '.dependency-checkouts'].includes(entry.name)) continue;
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isDirectory()) output.push(...await walk(path.join(directory, entry.name), child));
    else if (entry.isFile()) output.push(child.replaceAll('\\', '/'));
  }
  return output.sort();
}

export function familyPath(familyId, root = ROOT) {
  assert(/^[a-z][a-z0-9-]+$/.test(familyId), 'family_id_invalid');
  return path.join(root, 'blueprints', familyId);
}

export async function computePackageState(directory) {
  const files = (await walk(directory)).filter((item) => item !== 'blueprint.json');
  const fileHashes = {};
  for (const relative of files) fileHashes[relative] = sha256(await readFile(path.join(directory, relative)));
  const packageDigest = sha256(Object.entries(fileHashes).map(([name, digest]) => `${name}\0${digest}`).join('\n'));
  return { fileHashes, packageDigest };
}

function nonemptyStrings(value, code) {
  assert(Array.isArray(value) && value.length > 0 && value.every((item) => typeof item === 'string' && item.length > 0), code);
}

export function validateBlueprintObject(manifest, options = {}) {
  assert(manifest && typeof manifest === 'object' && !Array.isArray(manifest), 'blueprint_empty_or_invalid');
  for (const key of ['schema_version', 'family_id', 'family_title', 'owning_environment', 'publisher', 'family_version', 'lifecycle_state', 'purpose', 'nonpurpose', 'parent', 'compatibility', 'supported_runtime_families', 'input_types', 'output_types', 'required_provenance', 'tools', 'declared_capabilities', 'external_capabilities_not_granted', 'files', 'file_hashes', 'release', 'superseded_release', 'deprecation', 'created_at', 'updated_at']) assert(Object.hasOwn(manifest, key), `blueprint_required_field_missing:${key}`);
  assert(manifest.schema_version === '1.0.0', 'blueprint_schema_version_unsupported');
  assert(/^[a-z][a-z0-9-]+$/.test(manifest.family_id), 'family_id_invalid');
  assert(/^\d+\.\d+\.\d+$/.test(manifest.family_version), 'family_version_invalid');
  assert(['experimental', 'stable', 'deprecated', 'retired'].includes(manifest.lifecycle_state), 'lifecycle_state_invalid');
  assert(typeof manifest.purpose === 'string' && manifest.purpose.trim(), 'purpose_missing');
  nonemptyStrings(manifest.nonpurpose, 'nonpurpose_missing');
  nonemptyStrings(manifest.compatibility?.genesis, 'genesis_compatibility_missing');
  nonemptyStrings(manifest.compatibility?.communications, 'communications_compatibility_missing');
  assert(manifest.compatibility.communications.includes('0.6.0'), 'communications_compatibility_unsupported');
  assert(manifest.compatibility.genesis.includes('communications-v0.6.0'), 'genesis_compatibility_unsupported');
  assert(manifest.supported_runtime_families.every((item) => ADAPTERS.includes(item)), 'runtime_family_unsupported');
  nonemptyStrings(manifest.required_provenance, 'required_provenance_missing');
  nonemptyStrings(manifest.external_capabilities_not_granted, 'ungranted_capabilities_missing');
  for (const field of ['knowledge', 'playbook', 'boundaries', 'tools', 'evaluation', 'examples']) nonemptyStrings(manifest.files?.[field], `${field}_files_missing`);
  if (options.expectedOwner) assert(manifest.publisher?.owner === options.expectedOwner, 'publisher_owner_invalid');
  if (options.expectedRepository) assert(manifest.publisher?.repository === options.expectedRepository, 'publisher_repository_invalid');
  if (manifest.lifecycle_state === 'stable') {
    assert(manifest.release && typeof manifest.release === 'object', 'stable_release_data_missing');
    assert(/^blueprints-v\d+\.\d+\.\d+$/.test(manifest.release.tag), 'stable_release_tag_invalid');
    assert(!['main', 'latest'].includes(manifest.release.tag), 'mutable_release_reference');
    for (const field of ['tag_object', 'tag_target']) assert(manifest.release[field] === 'resolve-from-annotated-tag' || /^[a-f0-9]{40}$/.test(manifest.release[field]), `stable_release_${field}_invalid`);
    assert(/^[a-f0-9]{64}$/.test(manifest.release.package_digest), 'stable_release_digest_invalid');
  }
  return true;
}

export async function validateFamily(familyId, root = ROOT) {
  const directory = familyPath(familyId, root);
  const required = ['blueprint.json', 'PURPOSE.md', 'PLAYBOOK.md', 'KNOWLEDGE.md', 'BOUNDARIES.md', 'TOOLS.md', 'EVALUATION.md', 'CHANGELOG.md'];
  const files = await walk(directory);
  for (const name of required) assert(files.includes(name), `family_required_file_missing:${name}`);
  for (const directoryName of ['schemas', 'examples', 'tests']) assert(files.some((name) => name.startsWith(`${directoryName}/`)), `family_required_directory_empty:${directoryName}`);
  const manifest = await readJson(path.join(directory, 'blueprint.json'));
  validateBlueprintObject(manifest, { expectedOwner: 'normsexchange-dev', expectedRepository: SOURCE_REPOSITORY });
  const state = await computePackageState(directory);
  assert(canonicalJson(manifest.file_hashes) === canonicalJson(state.fileHashes), 'family_file_hash_drift');
  assert(manifest.release.package_digest === state.packageDigest, 'family_package_digest_drift');
  for (const group of Object.values(manifest.files)) for (const relative of group) assert(files.includes(relative), `declared_family_file_missing:${relative}`);
  return { manifest, ...state };
}

export async function prepareFamily(familyId, root = ROOT) {
  const directory = familyPath(familyId, root);
  const manifestFile = path.join(directory, 'blueprint.json');
  const manifest = await readJson(manifestFile);
  const state = await computePackageState(directory);
  manifest.file_hashes = state.fileHashes;
  manifest.release.package_digest = state.packageDigest;
  await writeFile(manifestFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return state;
}

export function git(args, root = ROOT) {
  return execFileSync(process.env.GIT_EXECUTABLE || 'git', ['-c', `safe.directory=${root.split(path.sep).join('/')}`, '-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function verifyAnnotatedTag(tag, root = ROOT, requireHead = true) {
  assert(/^blueprints-v\d+\.\d+\.\d+$/.test(tag), 'release_tag_invalid');
  const object = git(['rev-parse', `refs/tags/${tag}`], root);
  assert(git(['cat-file', '-t', `refs/tags/${tag}`], root) === 'tag', 'release_tag_not_annotated');
  const target = git(['rev-list', '-n', '1', `refs/tags/${tag}`], root);
  if (requireHead) assert(git(['rev-parse', 'HEAD'], root) === target, 'release_checkout_not_tag_target');
  return { object, target };
}

export function renderBundle(manifest, sections, adapter) {
  assert(ADAPTERS.includes(adapter), 'adapter_unsupported');
  for (const key of ['purpose', 'playbook', 'knowledge', 'boundaries', 'tools', 'evaluation']) assert(typeof sections[key] === 'string' && sections[key].trim(), `render_section_missing:${key}`);
  return {
    schema_version: '1.0.0', family_id: manifest.family_id, family_version: manifest.family_version,
    source_release: manifest.release.tag, package_digest: manifest.release.package_digest, adapter,
    precedence: PRECEDENCE, sections, external_authority_granted: false
  };
}

export async function loadRenderedBundle(familyId, adapter, root = ROOT) {
  const { manifest } = await validateFamily(familyId, root);
  const directory = familyPath(familyId, root);
  const names = { purpose: 'PURPOSE.md', playbook: 'PLAYBOOK.md', knowledge: 'KNOWLEDGE.md', boundaries: 'BOUNDARIES.md', tools: 'TOOLS.md', evaluation: 'EVALUATION.md' };
  const sections = {};
  for (const [key, name] of Object.entries(names)) sections[key] = await readFile(path.join(directory, name), 'utf8');
  return renderBundle(manifest, sections, adapter);
}

export function scanSensitive(text) {
  const patterns = [
    ['credential', new RegExp(['gh', '[pousr]_', '[A-Za-z0-9]{20,}'].join(''))],
    ['fine_grained_credential', new RegExp(['github', '_pat_', '[A-Za-z0-9_]{20,}'].join(''))],
    ['private_key', new RegExp(['BEGIN', ' [A-Z ]*', 'PRIVATE KEY'].join(''))],
    ['private_local_path', /[A-Za-z]:[\\/]Users[\\/]|(?:^|\s)\/(?:home|Users)\/[A-Za-z0-9._-]+\//m],
    ['raw_transcript', /\braw (?:session )?transcript\b|\bconversation dump\b/i],
    ['private_reasoning', /\bchain[- ]of[- ]thought\b|\bprivate reasoning dump\b/i]
  ];
  return patterns.filter(([, pattern]) => pattern.test(text)).map(([name]) => name);
}

export function validateLearningProposal(proposal) {
  assert(proposal && typeof proposal === 'object', 'learning_proposal_invalid');
  for (const key of ['proposal_id', 'proposing_environment', 'proposing_agent', 'target_scope', 'observation', 'evidence_references', 'provenance_classification', 'confidence', 'known_counterexamples', 'conflict_analysis', 'privacy_review', 'credential_review', 'proposed_wording', 'affected_playbook_sections', 'proposed_evaluation_changes', 'disposition']) assert(Object.hasOwn(proposal, key), `learning_field_missing:${key}`);
  assert(LEARNING_SCOPES.includes(proposal.target_scope), 'learning_scope_invalid');
  assert(KNOWLEDGE_CLASSES.includes(proposal.provenance_classification), 'learning_provenance_invalid');
  assert(proposal.privacy_review === 'pass' && proposal.credential_review === 'pass', 'learning_public_safety_review_failed');
  assert(scanSensitive(JSON.stringify(proposal)).length === 0, 'learning_sensitive_material_rejected');
  if (proposal.foreign_source) {
    for (const key of ['environment_id', 'publisher_owner', 'repository', 'repository_id', 'visibility', 'commit', 'tree', 'tag', 'tag_object', 'tag_target', 'source_paths']) assert(Object.hasOwn(proposal.foreign_source, key), `foreign_source_field_missing:${key}`);
    assert(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(proposal.foreign_source.repository), 'foreign_source_repository_invalid');
    assert(['public', 'private'].includes(proposal.foreign_source.visibility), 'foreign_source_visibility_invalid');
    for (const key of ['commit', 'tree', 'tag_object', 'tag_target']) assert(/^[a-f0-9]{40}$/.test(proposal.foreign_source[key]), `foreign_source_${key}_invalid`);
    assert(proposal.foreign_source.commit === proposal.foreign_source.tag_target, 'foreign_source_commit_target_mismatch');
    nonemptyStrings(proposal.foreign_source.source_paths, 'foreign_source_paths_missing');
    assert(proposal.source_review && typeof proposal.source_review === 'object', 'foreign_source_review_missing');
    for (const key of ['original_publisher', 'source_classification', 'first_known_at', 'last_reviewed_at', 'privacy_classification', 'source_credential_review', 'synthetic_or_simulated_status', 'independently_validated', 'adverse_evaluations', 'compatibility_impact', 'broader_scope_limitations']) assert(Object.hasOwn(proposal.source_review, key), `foreign_source_review_field_missing:${key}`);
    assert(['pass', 'fail', 'pending', 'unknown'].includes(proposal.source_review.source_credential_review), 'foreign_source_credential_review_invalid');
    assert(['none', 'synthetic', 'simulated', 'mixed', 'unknown'].includes(proposal.source_review.synthetic_or_simulated_status), 'foreign_source_synthetic_review_invalid');
    assert(['patch', 'minor', 'major', 'none', 'deferred'].includes(proposal.source_review.compatibility_impact), 'foreign_source_compatibility_invalid');
    assert(typeof proposal.source_review.independently_validated === 'boolean', 'foreign_source_independent_review_invalid');
    nonemptyStrings(proposal.source_review.adverse_evaluations, 'foreign_source_adverse_evaluations_missing');
    assert(typeof proposal.source_review.broader_scope_limitations === 'string' && proposal.source_review.broader_scope_limitations.length > 0, 'foreign_source_scope_limit_missing');
  }
  const independentEvidence = proposal.evidence_references.some((reference) => reference.source_kind !== 'agent_output' || reference.agent_id !== proposal.proposing_agent);
  if (proposal.evidence_references.length > 0) assert(independentEvidence, 'circular_self_citation_not_independent_evidence');
  if (proposal.provenance_classification === 'verified_fact') assert(proposal.evidence_references.length > 0, 'verified_fact_evidence_missing');
  if (proposal.target_scope === 'family_knowledge') {
    assert(proposal.provenance_classification !== 'synthetic', 'synthetic_evidence_not_family_fact');
    assert(proposal.proposed_evaluation_changes.length > 0, 'family_behavior_change_requires_evaluation');
  }
  if (proposal.target_scope === 'mission_specific') assert(proposal.disposition !== 'promoted', 'mission_specific_not_family_promotable');
  if (proposal.disposition === 'promoted') assert(proposal.adopting_authority && /^blueprints-v\d+\.\d+\.\d+$/.test(proposal.release_containing_lesson || ''), 'promoted_lesson_release_or_authority_missing');
  return true;
}

export function validateBlueprintReference(reference) {
  assert(reference && typeof reference === 'object', 'blueprint_reference_invalid');
  for (const key of ['publisher_owner', 'publisher_repository', 'commit', 'package_path', 'annotated_tag', 'tag_object', 'tag_target', 'package_digest', 'family_id', 'family_version', 'provenance']) assert(Object.hasOwn(reference, key), `blueprint_reference_missing:${key}`);
  for (const key of ['commit', 'tag_object', 'tag_target']) assert(/^[a-f0-9]{40}$/.test(reference[key]), `blueprint_reference_${key}_invalid`);
  assert(/^blueprints-v\d+\.\d+\.\d+$/.test(reference.annotated_tag) && !['main', 'latest'].includes(reference.annotated_tag), 'blueprint_reference_mutable');
  assert(/^[a-f0-9]{64}$/.test(reference.package_digest), 'blueprint_reference_digest_invalid');
  assert(Array.isArray(reference.provenance) && reference.provenance.length > 0, 'blueprint_reference_provenance_missing');
  return true;
}

export async function ensureEmptyDirectory(directory) {
  await mkdir(directory, { recursive: true });
  assert((await readdir(directory)).length === 0, 'output_directory_not_empty');
}

export async function writeJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function parseArgs(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i += 2) {
    assert(argv[i]?.startsWith('--') && i + 1 < argv.length, 'arguments_must_be_name_value_pairs');
    result[argv[i].slice(2)] = argv[i + 1];
  }
  return result;
}

export function sanitizedError(error) {
  return String(error?.message || error).replace(/[\r\n]+/g, ' ').slice(0, 300);
}
