import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DISPOSITIONS, assert, parseArgs, sanitizedError } from './lib/blueprints.mjs';

export function buildAdoptionRecord(input) {
  assert(input?.comparison?.overwrite_performed === false, 'comparison_overwrite_boundary_invalid');
  assert(DISPOSITIONS.includes(input.disposition), 'adoption_disposition_invalid');
  assert(input.agent_id === input.comparison.agent_id, 'adoption_identity_mismatch');
  return {
    schema_version: '1.0.0', agent_id: input.agent_id, disposition: input.disposition,
    previous_release: input.comparison.previous_release, proposed_release: input.comparison.proposed_release,
    adopted_release: input.disposition === 'adopt' ? input.comparison.proposed_release : null,
    adoption_commit: input.disposition === 'adopt' ? input.adoption_commit : null, adoption_time: input.adoption_time,
    compatibility_result: input.comparison.compatibility,
    unresolved_divergence: Object.entries(input.comparison.local_divergence).filter(([, changed]) => changed).map(([section]) => section),
    preserved_individual_identity: true, preserved_individual_history: true
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const input = JSON.parse(await readFile(args.input, 'utf8'));
  const record = buildAdoptionRecord(input);
  await writeFile(path.resolve(args.output), `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  console.log(`record-adoption: PASS disposition=${record.disposition} append_only=true output=${args.output}`);
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(`ADOPTION ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
