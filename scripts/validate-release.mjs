import { git, parseArgs, sanitizedError, validateFamily, verifyAnnotatedTag } from './lib/blueprints.mjs';

async function main() {
  const tag = parseArgs(process.argv.slice(2)).tag;
  const { manifest, packageDigest } = await validateFamily('wtb-researcher');
  if (manifest.release.tag !== tag) throw new Error('manifest_release_tag_mismatch');
  const { object, target } = verifyAnnotatedTag(tag);
  if (git(['status', '--porcelain'])) throw new Error('release_checkout_not_clean');
  console.log(`validate-release: PASS tag=${tag} object=${object} target=${target} digest=${packageDigest}`);
}

main().catch((error) => { console.error(`RELEASE VALIDATION ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
