import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { RELEASE_TAG, ROOT, SOURCE_REPOSITORY, VERSION, assert, parseArgs, readJson, sanitizedError, validateFamily, walk } from './lib/blueprints.mjs';

const REQUIRED = [
  '.github/workflows/validate-blueprints.yml', '.gitattributes', '.gitignore', 'CHANGELOG.md', 'README.md', 'VERSION', 'dependencies.json',
  'registry/families.json', 'docs/INHERITANCE_ARCHITECTURE.md', 'docs/LEARNING_PROMOTION.md', 'docs/VERSIONING_AND_RELEASES.md',
  'docs/MATERIALIZATION_AND_ADOPTION.md', 'docs/FORKS_AND_SPECIALIZATIONS.md', 'docs/PAIRWISE_BLUEPRINT_EXCHANGE.md', 'docs/KNOWLEDGE_SECURITY.md',
  'schemas/family-blueprint.schema.json', 'schemas/family-registry.schema.json', 'schemas/learning-proposal.schema.json',
  'schemas/agent-instantiation-proposal.schema.json', 'schemas/agent-manifest.schema.json', 'schemas/adoption-record.schema.json',
  'schemas/fork.schema.json', 'schemas/specialization.schema.json', 'schemas/blueprint-reference.schema.json', 'schemas/rendered-bundle.schema.json',
  'scripts/lib/blueprints.mjs', 'scripts/prepare-package.mjs', 'scripts/validate-blueprints.mjs', 'scripts/validate-release.mjs',
  'scripts/render-family.mjs', 'scripts/materialize-agent.mjs', 'scripts/compare-agent-update.mjs', 'scripts/record-adoption.mjs',
  'scripts/validate-learning-proposal.mjs', 'scripts/propose-learning-promotion.mjs', 'scripts/propose-fork.mjs', 'scripts/propose-specialization.mjs',
  'scripts/validate-blueprint-reference.mjs', 'scripts/resolve-family.mjs', 'tests/blueprints.test.mjs'
];
const ALLOWED_REPOSITORIES = new Set([SOURCE_REPOSITORY, 'normsexchange-dev/nx-codex-communications_dev', 'normsexchange-dev/nx-sourcing-contracts_dev']);

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
  assert(registered.immutable_tags.length === 1 && registered.immutable_tags[0] === RELEASE_TAG, 'registry_immutable_tag_invalid');
  await validateFamily('wtb-researcher');

  const dependencies = await readJson(path.join(ROOT, 'dependencies.json'));
  assert(dependencies.communications.tag === 'communications-v0.6.0' && dependencies.communications.tag_object === '500db28fa1f0dc6b5768e717202cf5b2af0daf7b' && dependencies.communications.tag_target === '9a545b09ccffb5ac1f65633f0e0fe74794beca62', 'communications_dependency_invalid');
  assert(dependencies.sourcing_contract.tag === 'contract-v0.2.0' && dependencies.sourcing_contract.tag_object === 'a3c60a04ef20ecbb70d0a705d4256f2e70651f39' && dependencies.sourcing_contract.tag_target === '712c07d76b1d1b60b04a8bf4dc2f041536e4a11f', 'sourcing_contract_dependency_invalid');

  const prompts = files.filter((item) => item.startsWith('prompts/') && item.endsWith('.txt'));
  assert(prompts.length === 15, 'copy_ready_prompt_count_invalid');
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
  console.log(`validate-blueprints: PASS files=${files.length} schemas=${schemas.length} prompts=${prompts.length} family=wtb-researcher version=${VERSION} branch=${branch}`);
}

main().catch((error) => { console.error(`VALIDATION ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
