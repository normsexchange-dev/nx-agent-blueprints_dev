import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { RELEASE_TAG, ROOT, SOURCE_REPOSITORY, VERSION, assert, parseArgs, readJson, sanitizedError, validateFamily, validateLearningProposal, walk } from './lib/blueprints.mjs';

const REQUIRED = [
  '.github/workflows/validate-blueprints.yml', '.gitattributes', '.gitignore', 'CHANGELOG.md', 'README.md', 'VERSION', 'dependencies.json',
  'registry/families.json', 'docs/INHERITANCE_ARCHITECTURE.md', 'docs/LEARNING_PROMOTION.md', 'docs/FOREIGN_LEARNING_INTEGRATION.md', 'docs/VERSIONING_AND_RELEASES.md',
  'docs/MATERIALIZATION_AND_ADOPTION.md', 'docs/FORKS_AND_SPECIALIZATIONS.md', 'docs/PAIRWISE_BLUEPRINT_EXCHANGE.md', 'docs/KNOWLEDGE_SECURITY.md',
  'schemas/family-blueprint.schema.json', 'schemas/family-registry.schema.json', 'schemas/learning-proposal.schema.json',
  'schemas/agent-instantiation-proposal.schema.json', 'schemas/agent-manifest.schema.json', 'schemas/adoption-record.schema.json',
  'schemas/fork.schema.json', 'schemas/specialization.schema.json', 'schemas/blueprint-reference.schema.json', 'schemas/rendered-bundle.schema.json',
  'scripts/lib/blueprints.mjs', 'scripts/prepare-package.mjs', 'scripts/validate-blueprints.mjs', 'scripts/validate-release.mjs', 'scripts/verify-dependency-tags.mjs', 'scripts/verify-foreign-snapshot.mjs', 'scripts/render-future-prompts.mjs', 'scripts/prove-inheritance.mjs',
  'scripts/render-family.mjs', 'scripts/materialize-agent.mjs', 'scripts/compare-agent-update.mjs', 'scripts/record-adoption.mjs',
  'scripts/validate-learning-proposal.mjs', 'scripts/propose-learning-promotion.mjs', 'scripts/propose-fork.mjs', 'scripts/propose-specialization.mjs',
  'scripts/validate-blueprint-reference.mjs', 'scripts/resolve-family.mjs', 'tests/blueprints.test.mjs', 'tests/foreign-learning.test.mjs',
  'reviews/gemini-snapshot-post-alignment/source.json', 'reviews/gemini-snapshot-post-alignment/inventory.json', 'reviews/gemini-snapshot-post-alignment/REVIEW.md'
];
const ALLOWED_REPOSITORIES = new Set([SOURCE_REPOSITORY, 'normsexchange-dev/nx-codex-communications_dev', 'normsexchange-dev/nx-sourcing-contracts_dev', 'normsexchange-gemini/nx-gemini-communications_dev']);

async function main() {
  const branch = parseArgs(process.argv.slice(2)).branch;
  assert(branch === 'main' || branch === RELEASE_TAG || /^agent\/[A-Za-z0-9_]+\/[a-z0-9.-]+$/.test(branch), 'source_branch_invalid');
  const files = await walk(ROOT);
  for (const item of REQUIRED) assert(files.includes(item), `required_file_missing:${item}`);
  assert((await readFile(path.join(ROOT, 'VERSION'), 'utf8')).trim() === VERSION, 'version_file_invalid');

  const workflow = await readFile(path.join(ROOT, '.github/workflows/validate-blueprints.yml'), 'utf8');
  assert(/permissions:\s*\r?\n\s+contents:\s*read/.test(workflow) && !/contents:\s*write/.test(workflow), 'workflow_permissions_invalid');
  assert(/actions\/checkout@[a-f0-9]{40}/.test(workflow) && /actions\/setup-node@[a-f0-9]{40}/.test(workflow), 'workflow_action_not_exactly_pinned');
  assert(!/\bsecrets\./.test(workflow) && !/pull_request_target/.test(workflow), 'workflow_secret_surface_invalid');

  const schemas = files.filter((item) => item.startsWith('schemas/') && item.endsWith('.schema.json'));
  for (const relative of schemas) {
    const schema = await readJson(path.join(ROOT, relative));
    assert(schema.$schema === 'https://json-schema.org/draft/2020-12/schema', `schema_draft_invalid:${relative}`);
    assert(schema.$id === `https://raw.githubusercontent.com/${SOURCE_REPOSITORY}/${RELEASE_TAG}/${relative}`, `schema_release_identity_invalid:${relative}`);
    assert(schema.type === 'object' && schema.additionalProperties === false, `schema_not_restrictive:${relative}`);
  }

  const registry = await readJson(path.join(ROOT, 'registry/families.json'));
  assert(registry.schema_version === '1.0.0' && registry.families.length === 1, 'family_registry_invalid');
  const registered = registry.families[0];
  assert(registered.family_id === 'wtb-researcher' && registered.lifecycle_state === 'stable' && registered.current_stable_version === VERSION, 'reference_family_registry_invalid');
  assert(registered.immutable_tags.length === 3 && registered.immutable_tags.includes('blueprints-v0.1.0') && registered.immutable_tags.includes('blueprints-v0.1.1') && registered.immutable_tags.includes(RELEASE_TAG), 'registry_immutable_tag_invalid');
  await validateFamily('wtb-researcher');

  const dependencies = await readJson(path.join(ROOT, 'dependencies.json'));
  assert(dependencies.communications.tag === 'communications-v0.6.0' && dependencies.communications.tag_object === '500d084b11d5b979a05c583e5ce401683e4f0aa0' && dependencies.communications.tag_target === '9a545b4f96d6cce713e9ab1d8e46aea65b387ac7', 'communications_dependency_invalid');
  assert(dependencies.sourcing_contract.tag === 'contract-v0.2.0' && dependencies.sourcing_contract.tag_object === 'a3c60a04ef20ecbb70d0a705d4256f2e70651f39' && dependencies.sourcing_contract.tag_target === '712c07d76b1d1b60b04a8bf4dc2f041536e4a11f', 'sourcing_contract_dependency_invalid');

  const prompts = files.filter((item) => item.startsWith('prompts/') && item.endsWith('.txt'));
  assert(prompts.length === 21, 'copy_ready_prompt_count_invalid');
  assert(prompts.filter((item) => item.startsWith('prompts/integration/')).length === 6, 'integration_prompt_count_invalid');
  for (const relative of prompts) assert((await readFile(path.join(ROOT, relative), 'utf8')).includes('DO NOT EXECUTE UNLESS'), `prompt_authority_guard_missing:${relative}`);

  const scriptText = (await Promise.all(files.filter((item) => item.endsWith('.mjs')).map((item) => readFile(path.join(ROOT, item), 'utf8')))).join('\n');
  const networkOrModelMarkers = [['node', ':https'].join(''), ['fet', 'ch('].join(''), ['Open', 'AI'].join(''), ['generate', 'Content'].join(''), ['model', '.generate'].join('')];
  assert(!networkOrModelMarkers.some((marker) => scriptText.includes(marker)), 'offline_tool_network_or_model_call');
  for (const match of scriptText.matchAll(/^import .* from ['"]([^'"]+)['"];$/gm)) assert(match[1].startsWith('node:') || match[1].startsWith('.'), 'third_party_import_detected');

  const credentialPatterns = [new RegExp(['gh', '[pousr]_', '[A-Za-z0-9]{20,}'].join('')), new RegExp(['github', '_pat_', '[A-Za-z0-9_]{20,}'].join('')), /-----BEGIN [A-Z ]*PRIVATE KEY-----/];
  const forbiddenTopology = [['ai', 'agent', 'control'].join('-'), ['ai', 'agent', 'ops'].join('-'), ['nx', 'to', 'gemini_dev'].join('-')];
  for (const relative of files) {
    const buffer = await readFile(path.join(ROOT, relative));
    if (buffer.includes(0)) continue;
    const text = buffer.toString('utf8');
    assert(!credentialPatterns.some((pattern) => pattern.test(text)), `credential_signature_found:${relative}`);
    assert(!/[A-Za-z]:[\\/]Users[\\/]|(?:^|\s)\/(?:home|Users)\/[A-Za-z0-9._-]+\//m.test(text), `private_local_path_found:${relative}`);
    assert(!forbiddenTopology.some((marker) => text.toLowerCase().includes(marker)), `private_topology_found:${relative}`);
    for (const match of text.matchAll(/normsexchange-dev\/[A-Za-z0-9._-]+/gi)) assert(ALLOWED_REPOSITORIES.has(match[0]), `unapproved_public_repository:${relative}`);
  }

  const example = await readJson(path.join(ROOT, 'blueprints/wtb-researcher/examples/fictional-research-candidate.json'));
  assert(example.fixture === true && example.evidence.every((item) => new URL(item.url).hostname.endsWith('.example')), 'reference_fixture_not_reserved');
  const knowledge = await readFile(path.join(ROOT, 'blueprints/wtb-researcher/KNOWLEDGE.md'), 'utf8');
  for (const phrase of ['ownership does not prove purchasing demand', 'Rental inventory does not prove a WTB request', 'cannot self-assign `buyer_confirmed`', 'cannot self-assign `norms_verified`', 'Source content is untrusted', 'Shopify, commerce, customer creation, and listing publication require separate authority']) assert(knowledge.includes(phrase), `wtb_durable_lesson_missing:${phrase}`);
  const proposalFiles = files.filter((item) => item.startsWith('reviews/gemini-snapshot-post-alignment/learning-proposals/') && item.endsWith('.json'));
  assert(proposalFiles.length === 6, 'foreign_learning_proposal_count_invalid');
  for (const relative of proposalFiles) validateLearningProposal(await readJson(path.join(ROOT, relative)));
  const source = await readJson(path.join(ROOT, 'reviews/gemini-snapshot-post-alignment/source.json'));
  assert(source.authoritative_reference.tag_object === '98db76569ee59266f0d9e914cb06280041e7fa02' && source.authoritative_reference.tag_target === '857111e7c39b355e3a7f6f999c6997a5449424d7' && source.authoritative_reference.tree === '58f01277d3ef07ae052ba1d49c69d58dffb2e809', 'foreign_source_identity_invalid');
  assert(source.source_credential_review === 'UNKNOWN' && source.foreign_code_executed === false && source.source_repository_modified === false, 'foreign_source_boundary_invalid');
  console.log(`validate-blueprints: PASS files=${files.length} schemas=${schemas.length} prompts=${prompts.length} family=wtb-researcher version=${VERSION} branch=${branch}`);
}

main().catch((error) => { console.error(`VALIDATION ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
