# NX Agent Blueprints

NX Agent Blueprints is a public, vendor-neutral contract for publishing durable agent-family knowledge without publishing credentials, private memory, operational history, or authority. Release `0.2.0` adds a governed foreign-learning review path while remaining a nonoperational reference foundation for sovereign environments.

The inheritance chain is:

1. canonical genesis;
2. environment constitution;
3. agent-family blueprint;
4. specialization or role;
5. standing mission;
6. current goal;
7. individual memory.

Lower layers add context but cannot silently override higher-authority boundaries. Promoted family knowledge moves through a deliberate proposal, scope classification, provenance/privacy/credential review, conflict review, package change, evaluation update, and immutable release. Individual memory and raw conversations are never inherited automatically.

## What this repository contains

- strict public schemas for families, learning, materialization, adoption, forks, specializations, and publication references;
- deterministic standard-library-only validators, renderers, proposal tools, and a reference materializer;
- a registry resolving stable releases to immutable annotated tags;
- one inactive `wtb-researcher` reference family using only reserved fictional fixtures;
- fifteen core workflow prompts and six foreign-learning integration prompts.
- an immutable-source verifier and a public-safe review record for the Gemini `snapshot-post-alignment` evidence.

The blueprint grants no external capability. It does not activate a mission, create an agent, contact anyone, admit business data, modify commerce systems, or grant repository access.

## Validate and test

```sh
node scripts/validate-blueprints.mjs --branch main
node --test tests/*.test.mjs
```

Release validation must run from an exact checkout of annotated tag `blueprints-v0.2.0`:

```sh
node scripts/validate-release.mjs --tag blueprints-v0.2.0
```

No package install, model call, network request, credential, or mutable `main` reference is required.

Foreign learning is reviewed from an exact annotated source snapshot without executing foreign code. A source environment retains ownership of its history, instance memory, policies, and applications; a Norms release retains both source-publisher provenance and the independent adopting review. See `docs/FOREIGN_LEARNING_INTEGRATION.md`.

## Runtime rendering and proposed materialization

All adapters render from the same canonical family package:

```sh
node scripts/render-family.mjs --family wtb-researcher --adapter neutral --output <empty-directory>
```

The materializer accepts exact, prevalidated genesis and release inputs and writes only a proposed agent bundle into an explicit empty output directory. It never activates the proposal.

From an exact release-tag checkout, `scripts/prove-inheritance.mjs` renders deterministic, fictional, inactive proposals for neutral, Codex, Gemini, and Claude adapters and records one proof digest per adapter. `scripts/render-future-prompts.mjs` resolves the six integration templates against the actual annotated tag object, target, and family package digest.

## Sovereignty

The registry is discovery, not authority. A sovereign environment may evaluate, adopt, reject, defer, fork, specialize, deprecate, or retire a family under its own constitution. It cannot rewrite another publisher's release. Norms Exchange control applies only to Norms-owned artifacts, identities operating inside Norms-owned boundaries, and capabilities or information crossing into those boundaries.
Vendor-neutral sovereign agent-family blueprints, learning inheritance, deterministic validation, and public reference families.
