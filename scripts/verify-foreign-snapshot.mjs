import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ROOT, assert, parseArgs, readJson, sanitizedError, sha256 } from './lib/blueprints.mjs';

function git(repository, args, encoding = 'utf8') {
  return execFileSync(process.env.GIT_EXECUTABLE || 'git', ['-c', `safe.directory=${path.resolve(repository).split(path.sep).join('/')}`, '-C', repository, ...args], {
    encoding,
    maxBuffer: 20 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function normalizedBlobDigest(repository, commit, file) {
  const raw = git(repository, ['show', `${commit}:${file}`], null);
  return sha256(raw.toString('utf8').replace(/\r\n/g, '\n'));
}

export async function verifyForeignSnapshot(repository, sourceFile = path.join(ROOT, 'reviews/gemini-snapshot-post-alignment/source.json')) {
  const source = await readJson(sourceFile);
  const post = source.authoritative_reference;
  const pre = source.previous_review_baseline;
  assert(git(repository, ['rev-parse', `refs/tags/${post.tag}`]).trim() === post.tag_object, 'foreign_post_tag_object_mismatch');
  assert(git(repository, ['cat-file', '-t', `refs/tags/${post.tag}`]).trim() === 'tag', 'foreign_post_tag_not_annotated');
  assert(git(repository, ['rev-list', '-n', '1', `refs/tags/${post.tag}`]).trim() === post.tag_target, 'foreign_post_tag_target_mismatch');
  assert(git(repository, ['rev-parse', `${post.tag_target}^{tree}`]).trim() === post.tree, 'foreign_post_tree_mismatch');
  assert(git(repository, ['rev-parse', `refs/tags/${pre.tag}`]).trim() === pre.tag_object, 'foreign_pre_tag_object_mismatch');
  assert(git(repository, ['cat-file', '-t', `refs/tags/${pre.tag}`]).trim() === 'tag', 'foreign_pre_tag_not_annotated');
  assert(git(repository, ['rev-list', '-n', '1', `refs/tags/${pre.tag}`]).trim() === pre.tag_target, 'foreign_pre_tag_target_mismatch');
  assert(git(repository, ['rev-parse', `${pre.tag_target}^{tree}`]).trim() === pre.tree, 'foreign_pre_tree_mismatch');
  git(repository, ['merge-base', '--is-ancestor', source.interface_introduction_commit, post.tag_target]);
  const changed = git(repository, ['diff', '--name-only', pre.tag_target, post.tag_target]).trim().split(/\r?\n/).filter(Boolean).sort();
  assert(JSON.stringify(changed) === JSON.stringify([...source.changed_paths].sort()), 'foreign_snapshot_changed_paths_mismatch');
  const treeEntries = git(repository, ['ls-tree', '-r', '--name-only', post.tag_target]).trim().split(/\r?\n/).filter(Boolean);
  assert(treeEntries.length === post.tree_entry_count, 'foreign_snapshot_tree_count_mismatch');
  for (const file of source.source_files) assert(normalizedBlobDigest(repository, post.tag_target, file.path) === file.sha256_lf, `foreign_snapshot_file_digest_mismatch:${file.path}`);
  return { repository: source.repository, tag: post.tag, object: post.tag_object, target: post.tag_target, tree: post.tree, files: source.source_files.length, changed_paths: changed.length };
}

async function main() {
  const result = await verifyForeignSnapshot(path.resolve(parseArgs(process.argv.slice(2)).repository));
  console.log(`verify-foreign-snapshot: PASS repository=${result.repository} tag=${result.tag} object=${result.object} target=${result.target} tree=${result.tree} files=${result.files} changed_paths=${result.changed_paths}`);
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(`FOREIGN SNAPSHOT ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
