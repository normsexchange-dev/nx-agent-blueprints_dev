# Versioning and releases

- **PATCH**: nonbehavioral clarification, typo, formatting correction, or evaluation repair that does not change intended procedure.
- **MINOR**: backward-compatible knowledge, procedure, optional tool, evaluation, or specialization support.
- **MAJOR**: incompatible purpose, removed core behavior, changed required boundary, incompatible input/output contract, split, or redefinition.

Stable agents pin an exact annotated tag and never permanently reference `main` or `latest`. Each release validates the manifest, all declared file hashes, aggregate package digest, changelog, evaluations, annotated tag type, tag object, and target commit from a clean tagged checkout.

Git object identifiers cannot be literally embedded in the commit whose identifier they determine. The manifest therefore uses the explicit value `resolve-from-annotated-tag` for `tag_object` and `tag_target`. The release validator resolves and verifies both from the immutable annotated tag; release evidence records their exact 40-hex values. This avoids a false or cryptographically impossible self-reference while keeping the package deterministic.

The package digest is SHA-256 over sorted `path:NUL:file-sha256` entries for every declared package file except `blueprint.json`. The immutable annotated tag protects the manifest itself. A tag must point at the checked-out commit, and a clean tagged checkout must pass the complete suite.
