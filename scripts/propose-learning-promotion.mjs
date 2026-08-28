import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assert, parseArgs, sanitizedError, validateLearningProposal } from './lib/blueprints.mjs';

export function buildPromotionProposal(proposal) {
  validateLearningProposal(proposal);
  assert(proposal.target_scope === 'family_knowledge', 'promotion_target_not_family_knowledge');
  assert(proposal.disposition === 'approved', 'promotion_requires_approved_proposal');
  return {
    schema_version: '1.0.0', source_proposal_id: proposal.proposal_id, target_family: proposal.target_family,
    proposed_wording: proposal.proposed_wording, affected_playbook_sections: proposal.affected_playbook_sections,
    required_evaluation_changes: proposal.proposed_evaluation_changes,
    release_action: 'create-new-immutable-family-release-after-review', automatic_family_edit: false,
    automatic_adoption: false, earlier_release_mutation: false
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const output = buildPromotionProposal(JSON.parse(await readFile(args.proposal, 'utf8')));
  await writeFile(path.resolve(args.output), `${JSON.stringify(output, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  console.log(`propose-learning-promotion: PASS source=${output.source_proposal_id} family_edit=false output=${args.output}`);
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(`PROMOTION ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
