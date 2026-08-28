import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assert, parseArgs, sanitizedError } from './lib/blueprints.mjs';

export function validateForkProposal(value) {
  for (const key of ['source_family', 'source_release', 'source_digest', 'new_owner', 'new_family_id', 'divergence_reason', 'inherited_files', 'replaced_files']) assert(Object.hasOwn(value || {}, key), `fork_field_missing:${key}`);
  assert(/^blueprints-v\d+\.\d+\.\d+$/.test(value.source_release) && /^[a-f0-9]{64}$/.test(value.source_digest), 'fork_source_not_immutable');
  assert(value.new_family_id !== value.source_family, 'fork_family_id_not_distinct');
  assert(value.new_owner && value.divergence_reason, 'fork_owner_or_reason_missing');
  return { schema_version: '1.0.0', ...value, source_mutation: false };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const proposal = validateForkProposal(JSON.parse(await readFile(args.input, 'utf8')));
  await writeFile(path.resolve(args.output), `${JSON.stringify(proposal, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  console.log(`propose-fork: PASS family=${proposal.new_family_id} source_mutation=false output=${args.output}`);
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(`FORK ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
