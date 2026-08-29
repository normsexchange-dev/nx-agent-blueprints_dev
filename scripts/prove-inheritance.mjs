import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ADAPTERS, SOURCE_REPOSITORY, canonicalJson, ensureEmptyDirectory, loadRenderedBundle, parseArgs, sanitizedError, sha256, validateFamily, verifyAnnotatedTag, writeJson } from './lib/blueprints.mjs';
import { buildMaterialization } from './materialize-agent.mjs';

export async function buildInheritanceProof(manifest, releaseEvidence, adapter) {
  const bundle = await loadRenderedBundle('wtb-researcher', adapter);
  const proposal = {
    schema_version: '1.0.0',
    destination_environment_id: `example-sovereign-${adapter}`,
    new_agent_id: `fixture-wtb-researcher-${adapter}`,
    parent_agent: null,
    environment_genesis: { canonical_release: { tag: 'communications-v0.6.0' } },
    family: {
      owner: 'normsexchange-dev', repository: SOURCE_REPOSITORY, tag: manifest.release.tag,
      tag_object: releaseEvidence.object, tag_target: releaseEvidence.target, package_digest: manifest.release.package_digest
    },
    runtime_adapter: adapter,
    specializations: [],
    creation_time: '2026-08-29T00:00:00Z',
    activate: false
  };
  const result = await buildMaterialization(proposal, bundle, releaseEvidence);
  const proofDigest = sha256(canonicalJson({ manifest: result.manifest, bundle: result.bundle, instructions: result.markdown }));
  return { ...result, proofDigest };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { manifest } = await validateFamily('wtb-researcher');
  const evidence = verifyAnnotatedTag(args.tag);
  const output = path.resolve(args.output);
  await ensureEmptyDirectory(output);
  const summary = [];
  for (const adapter of ADAPTERS) {
    const proof = await buildInheritanceProof(manifest, evidence, adapter);
    const directory = path.join(output, adapter);
    await mkdir(directory);
    await writeJson(path.join(directory, 'agent-manifest.json'), proof.manifest);
    await writeJson(path.join(directory, 'instruction-bundle.json'), proof.bundle);
    await writeFile(path.join(directory, proof.instructionName), proof.markdown, 'utf8');
    summary.push({ adapter, agent_id: proof.manifest.agent_id, activation_state: proof.manifest.activation_state, external_permissions_granted: proof.manifest.external_permissions_granted, package_digest: proof.bundle.package_digest, proof_digest: proof.proofDigest });
  }
  await writeJson(path.join(output, 'proof-summary.json'), { release: { tag: args.tag, tag_object: evidence.object, tag_target: evidence.target, package_digest: manifest.release.package_digest }, proofs: summary });
  console.log(`prove-inheritance: PASS tag=${args.tag} object=${evidence.object} target=${evidence.target} package_digest=${manifest.release.package_digest} adapters=${summary.length}`);
}

if (path.resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(`INHERITANCE PROOF ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
