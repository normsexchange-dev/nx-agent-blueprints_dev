import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROOT, assert, ensureEmptyDirectory, parseArgs, sanitizedError, validateFamily, verifyAnnotatedTag, writeJson } from './lib/blueprints.mjs';

const templates = [
  'prompts/integration/01-fresh-sovereign-genesis.txt',
  'prompts/integration/02-instantiate-from-family.txt',
  'prompts/integration/03-compare-existing-agent.txt',
  'prompts/integration/04-adopt-family-update.txt',
  'prompts/integration/05-reject-or-defer-update.txt',
  'prompts/integration/06-create-specialization.txt'
];

export async function buildFuturePrompts(manifest, tagEvidence, root = ROOT) {
  const values = {
    '{{FAMILY_TAG}}': manifest.release.tag,
    '{{FAMILY_TAG_OBJECT}}': tagEvidence.object,
    '{{FAMILY_TAG_TARGET}}': tagEvidence.target,
    '{{PACKAGE_DIGEST}}': manifest.release.package_digest,
    '{{FAMILY_VERSION}}': manifest.family_version
  };
  const prompts = [];
  for (const relative of templates) {
    let content = await readFile(path.join(root, relative), 'utf8');
    for (const [marker, value] of Object.entries(values)) content = content.replaceAll(marker, value);
    assert(!content.includes('{{'), `future_prompt_placeholder_unresolved:${relative}`);
    prompts.push({ template: relative, content: content.trim() });
  }
  return prompts;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { manifest } = await validateFamily('wtb-researcher');
  assert(args.tag === manifest.release.tag, 'future_prompt_tag_mismatch');
  const evidence = verifyAnnotatedTag(args.tag);
  const output = path.resolve(args.output);
  await ensureEmptyDirectory(output);
  const prompts = await buildFuturePrompts(manifest, evidence);
  for (let index = 0; index < prompts.length; index += 1) await writeFile(path.join(output, `${String(index + 1).padStart(2, '0')}.txt`), `${prompts[index].content}\n`, 'utf8');
  await writeJson(path.join(output, 'release.json'), { family_id: manifest.family_id, family_version: manifest.family_version, tag: args.tag, tag_object: evidence.object, tag_target: evidence.target, package_digest: manifest.release.package_digest });
  console.log(`render-future-prompts: PASS tag=${args.tag} object=${evidence.object} target=${evidence.target} digest=${manifest.release.package_digest} prompts=${prompts.length}`);
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(`FUTURE PROMPT ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
