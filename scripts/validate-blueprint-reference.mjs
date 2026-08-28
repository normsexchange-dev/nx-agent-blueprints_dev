import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseArgs, readJson, sanitizedError, validateBlueprintReference } from './lib/blueprints.mjs';

async function main() {
  const reference = await readJson(parseArgs(process.argv.slice(2)).reference);
  validateBlueprintReference(reference);
  console.log(`validate-blueprint-reference: PASS family=${reference.family_id} release=${reference.annotated_tag} action=${reference.receiver_action}`);
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(`REFERENCE ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
