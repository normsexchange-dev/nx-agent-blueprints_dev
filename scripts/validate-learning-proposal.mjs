import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseArgs, readJson, sanitizedError, validateLearningProposal } from './lib/blueprints.mjs';

async function main() {
  const proposal = await readJson(parseArgs(process.argv.slice(2)).proposal);
  validateLearningProposal(proposal);
  console.log(`validate-learning-proposal: PASS proposal=${proposal.proposal_id} scope=${proposal.target_scope} disposition=${proposal.disposition}`);
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(`LEARNING VALIDATION ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
