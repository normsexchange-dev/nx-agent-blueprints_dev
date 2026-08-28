import { prepareFamily, sanitizedError } from './lib/blueprints.mjs';

prepareFamily('wtb-researcher')
  .then(({ packageDigest, fileHashes }) => console.log(`prepare-package: PASS family=wtb-researcher files=${Object.keys(fileHashes).length} digest=${packageDigest}`))
  .catch((error) => { console.error(`PREPARE ERROR ${sanitizedError(error)}`); process.exitCode = 2; });
