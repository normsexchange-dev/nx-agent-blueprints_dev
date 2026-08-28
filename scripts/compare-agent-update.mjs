import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assert, parseArgs, sanitizedError } from './lib/blueprints.mjs';

const SECTIONS = ['purpose', 'procedures', 'knowledge', 'boundaries', 'tools', 'evaluations'];

export function compareAgentUpdate(current, local, proposed) {
  for (const value of [current, local, proposed]) assert(value && value.agent_id && value.family_release && value.sections, 'agent_snapshot_invalid');
  assert(current.agent_id === local.agent_id && local.agent_id === proposed.agent_id, 'individual_identity_changed');
  const changes = {};
  const localDivergence = {};
  for (const section of SECTIONS) {
    changes[section] = { from: current.sections[section] ?? null, to: proposed.sections[section] ?? null, changed: JSON.stringify(current.sections[section]) !== JSON.stringify(proposed.sections[section]) };
    localDivergence[section] = JSON.stringify(current.sections[section]) !== JSON.stringify(local.sections[section]);
  }
  const newlyRequiredExternalCapabilities = (proposed.external_capabilities || []).filter((item) => !(current.external_capabilities || []).includes(item));
  const breaking = changes.purpose.changed || changes.boundaries.changed || newlyRequiredExternalCapabilities.length > 0;
  return {
    schema_version: '1.0.0', agent_id: current.agent_id, previous_release: current.family_release, proposed_release: proposed.family_release,
    compatibility: breaking ? 'breaking-review-required' : 'compatible-proposal', privacy_findings: proposed.privacy_findings || [],
    newly_required_external_capabilities: newlyRequiredExternalCapabilities, changes, local_divergence: localDivergence,
    three_way: { base: current.sections, local: local.sections, proposed: proposed.sections },
    supported_dispositions: ['adopt', 'reject', 'defer', 'remain_on_current', 'fork', 'create_specialization'],
    overwrite_performed: false, preserved_individual_identity: true, preserved_individual_memory: true
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const values = await Promise.all(['current', 'local', 'proposed'].map((name) => readFile(args[name], 'utf8').then(JSON.parse)));
  const comparison = compareAgentUpdate(...values);
  await writeFile(path.resolve(args.output), `${JSON.stringify(comparison, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  console.log(`compare-agent-update: PASS compatibility=${comparison.compatibility} overwrite=false output=${args.output}`);
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(`COMPARE ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
