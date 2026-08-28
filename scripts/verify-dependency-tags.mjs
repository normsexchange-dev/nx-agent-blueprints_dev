import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { ROOT, assert, parseArgs, readJson, sanitizedError } from './lib/blueprints.mjs';

function git(repository, args) {
  const root = path.resolve(repository);
  return execFileSync(process.env.GIT_EXECUTABLE || 'git', ['-c', `safe.directory=${root.split(path.sep).join('/')}`, '-C', root, ...args], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']
  }).trim();
}

function verify(repository, dependency) {
  const reference = `refs/tags/${dependency.tag}`;
  assert(git(repository, ['cat-file', '-t', reference]) === 'tag', `dependency_tag_not_annotated:${dependency.tag}`);
  assert(git(repository, ['rev-parse', reference]) === dependency.tag_object, `dependency_tag_object_mismatch:${dependency.tag}`);
  assert(git(repository, ['rev-parse', `${reference}^{}`]) === dependency.tag_target, `dependency_tag_target_mismatch:${dependency.tag}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assert(options.communications && options.contract, 'dependency_checkout_paths_required');
  const dependencies = await readJson(path.join(ROOT, 'dependencies.json'));
  verify(options.communications, dependencies.communications);
  verify(options.contract, dependencies.sourcing_contract);
  console.log(`verify-dependency-tags: PASS communications=${dependencies.communications.tag} contract=${dependencies.sourcing_contract.tag}`);
}

main().catch((error) => { console.error(`DEPENDENCY VERIFICATION ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
