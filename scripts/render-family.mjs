import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { loadRenderedBundle, parseArgs, sanitizedError, writeJson } from './lib/blueprints.mjs';

const names = { neutral: 'AGENT_INSTRUCTIONS.md', codex: 'AGENTS.md', gemini: 'GEMINI.md', claude: 'CLAUDE.md' };

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const bundle = await loadRenderedBundle(args.family, args.adapter);
  await mkdir(args.output, { recursive: true });
  const markdown = [`# ${bundle.family_id} ${bundle.family_version}`, '', `Source: ${bundle.source_release}`, `Package digest: ${bundle.package_digest}`, '', '## Instruction precedence', '', ...bundle.precedence.map((item, index) => `${index + 1}. ${item}`), '', ...Object.entries(bundle.sections).flatMap(([key, value]) => [`## ${key}`, '', value.trim(), '']), 'External authority granted: false', ''].join('\n');
  await writeFile(path.join(args.output, names[args.adapter]), markdown, 'utf8');
  await writeJson(path.join(args.output, 'instruction-bundle.json'), bundle);
  console.log(`render-family: PASS family=${args.family} adapter=${args.adapter} output=${args.output}`);
}

main().catch((error) => { console.error(`RENDER ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
