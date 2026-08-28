import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assert, parseArgs, sanitizedError } from './lib/blueprints.mjs';

export function validateSpecialization(value) {
  for (const key of ['specialization_id', 'base_family', 'base_release', 'additional_purpose', 'additional_knowledge', 'additional_procedures', 'precedence', 'declared_overrides']) assert(Object.hasOwn(value || {}, key), `specialization_field_missing:${key}`);
  assert(/^blueprints-v\d+\.\d+\.\d+$/.test(value.base_release), 'specialization_base_not_immutable');
  assert(value.precedence === 'specialization-may-narrow-but-not-silently-override-family', 'specialization_precedence_invalid');
  const contradictions = [...value.additional_knowledge, ...value.additional_procedures].filter((item) => /^OVERRIDE:/i.test(item));
  assert(contradictions.every((item) => value.declared_overrides.includes(item.slice(item.indexOf(':') + 1).trim())), 'specialization_undeclared_contradiction');
  return { schema_version: '1.0.0', ...value };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const proposal = validateSpecialization(JSON.parse(await readFile(args.input, 'utf8')));
  await writeFile(path.resolve(args.output), `${JSON.stringify(proposal, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  console.log(`propose-specialization: PASS specialization=${proposal.specialization_id} output=${args.output}`);
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(`SPECIALIZATION ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
