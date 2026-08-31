# Pairwise blueprint exchange

Communications `0.6.0` already supports generic `notification` or `protocol_notice` messages with JSON payloads and exact references. No communications change is needed. A family-specific payload may declare `blueprint_available`, `blueprint_update_proposed`, `learning_proposal_shared`, `evaluation_result_shared`, `blueprint_fork_notice`, `deprecation_notice`, or `retirement_notice`.

Every publication reference pins publisher owner/repository, 40-hex commit, package path, annotated tag, tag object, tag target, package digest, family ID/version, and provenance. Mutable references fail. The receiver may read, validate, evaluate, adopt, reject, fork, or respond from its own outbound channel. Validation never adopts automatically and never requires a foreign write.

This repository publishes no operational pairwise message and contains no channel identity or private topology.

The unreleased Communications 0.8 message-store candidate is a possible parallel transport for selected groups; it does not alter this release's 0.6 compatibility. A future compatibility release would still require an exact immutable Blueprint reference, receiver-owned adoption, and a separate activation decision. See `FRAMEWORK_LAYER_INTEROPERABILITY_dev.md`.
