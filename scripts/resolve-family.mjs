import path from 'node:path';
import { ROOT, assert, parseArgs, readJson, sanitizedError } from './lib/blueprints.mjs';

async function main() {
  const family = parseArgs(process.argv.slice(2)).family;
  const registry = await readJson(path.join(ROOT, 'registry/families.json'));
  const entry = registry.families.find((item) => item.family_id === family);
  assert(entry && entry.lifecycle_state === 'stable' && entry.current_stable_version, 'stable_family_not_found');
  const tag = entry.immutable_tags.at(-1);
  console.log(JSON.stringify({ family_id: family, version: entry.current_stable_version, owner: entry.owner, repository: entry.source_repository, immutable_tag: tag }, null, 2));
}

main().catch((error) => { console.error(`RESOLVE ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
