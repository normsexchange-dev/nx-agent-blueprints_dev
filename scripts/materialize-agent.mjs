import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PRECEDENCE, SOURCE_REPOSITORY, assert, loadRenderedBundle, parseArgs, readJson, sanitizedError, validateFamily, verifyAnnotatedTag } from './lib/blueprints.mjs';

const adapterNames = { neutral: 'AGENT_INSTRUCTIONS.md', codex: 'AGENTS.md', gemini: 'GEMINI.md', claude: 'CLAUDE.md' };

export async function buildMaterialization(proposal, bundle, releaseEvidence) {
  assert(proposal?.schema_version === '1.0.0' && proposal.activate === false, 'instantiation_proposal_invalid');
  assert(proposal.environment_genesis?.canonical_release?.tag === 'communications-v0.6.0', 'genesis_release_incompatible');
  assert(proposal.destination_environment_id && proposal.new_agent_id && proposal.creation_time, 'instantiation_identity_or_time_missing');
  assert(!proposal.parent_agent || proposal.parent_agent.agent_id !== proposal.new_agent_id, 'new_agent_impersonates_parent');
  assert(proposal.family?.owner === 'normsexchange-dev' && proposal.family.repository === SOURCE_REPOSITORY, 'family_publisher_invalid');
  assert(proposal.family.tag === bundle.source_release && proposal.family.package_digest === bundle.package_digest, 'family_release_or_digest_mismatch');
  assert(proposal.family.tag_object === releaseEvidence.object && proposal.family.tag_target === releaseEvidence.target, 'family_tag_evidence_mismatch');
  assert(bundle.adapter === proposal.runtime_adapter && bundle.external_authority_granted === false, 'rendered_bundle_authority_or_adapter_invalid');
  const manifest = {
    schema_version: '1.0.0', agent_id: proposal.new_agent_id, environment_id: proposal.destination_environment_id,
    parent_agent: proposal.parent_agent ? { agent_id: proposal.parent_agent.agent_id, relationship: 'lineage-reference-only' } : null,
    family_provenance: { ...proposal.family, version: bundle.family_version }, specializations: proposal.specializations || [],
    instruction_precedence: PRECEDENCE, individual_memory_imported: false, external_permissions_granted: false,
    standing_mission: null, activation_state: 'proposed_only', created_at: proposal.creation_time
  };
  const markdown = [`# Proposed ${bundle.family_id} agent instructions`, '', `Agent identity: ${proposal.new_agent_id}`, `Family release: ${bundle.source_release}`, `Package digest: ${bundle.package_digest}`, '', '## Instruction precedence', '', ...PRECEDENCE.map((item, index) => `${index + 1}. ${item}`), '', ...Object.entries(bundle.sections).flatMap(([key, value]) => [`## ${key}`, '', value.trim(), '']), 'External authority granted: false', 'Standing mission: none', 'Activation state: proposed only', ''].join('\n');
  return { manifest, bundle, markdown, instructionName: adapterNames[proposal.runtime_adapter] };
}

async function writeIdempotent(output, files) {
  const { mkdir } = await import('node:fs/promises');
  await mkdir(output, { recursive: true });
  const existing = await readdir(output);
  const expected = Object.keys(files).sort();
  if (existing.length) {
    assert(JSON.stringify(existing.sort()) === JSON.stringify(expected), 'materialization_output_locally_evolved');
    for (const [name, content] of Object.entries(files)) assert(await readFile(path.join(output, name), 'utf8') === content, 'materialization_output_locally_evolved');
    return 'idempotent';
  }
  for (const [name, content] of Object.entries(files)) await writeFile(path.join(output, name), content, 'utf8');
  return 'created-proposal';
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const proposal = await readJson(args.proposal);
  const { manifest } = await validateFamily('wtb-researcher');
  assert(proposal.family.tag === manifest.release.tag, 'family_tag_mismatch');
  const releaseEvidence = verifyAnnotatedTag(proposal.family.tag);
  const bundle = await loadRenderedBundle('wtb-researcher', proposal.runtime_adapter);
  const result = await buildMaterialization(proposal, bundle, releaseEvidence);
  const files = {
    'agent-manifest.json': `${JSON.stringify(result.manifest, null, 2)}\n`,
    'instruction-bundle.json': `${JSON.stringify(result.bundle, null, 2)}\n`,
    [result.instructionName]: result.markdown
  };
  const status = await writeIdempotent(path.resolve(args.output), files);
  console.log(`materialize-agent: PASS status=${status} activation=proposed_only output=${args.output}`);
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(`MATERIALIZATION ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
