# Framework Layer Interoperability — Development Note

This document describes unreleased integration work. The immutable Blueprint release remains `blueprints-v0.2.0`, with its exact Communications 0.6 dependency. It does not claim compatibility with a tag that does not exist.

## Platform-neutral core and publisher examples

The blueprint contract—family packaging, provenance, evaluation, adoption, specialization, fork, and release—is platform neutral. A blueprint is optional; an environment does not need a family package to be sovereign or to use the Communications transport.

`wtb-researcher` is a Norms Exchange-owned reference family with marketplace-specific boundaries. Its purpose, sourcing contract, `norms_verified` state, Shopify prohibitions, and business vocabulary demonstrate the generic contract; they are not required features of PeopleBot or of every blueprint publisher.

Another publisher may define unrelated families under its own namespace and constitution. Reading this repository transfers no family ownership, agent identity, mission, memory, capability, credential, or authority.

## Layer boundaries

| Layer | Supplies | Does not supply |
|---|---|---|
| Communications | genesis, discovery contract, message transport, immutable references | runtime persistence, family adoption, action authority |
| Environment Profile | operating functions, capability evidence, recovery, adapters | family knowledge, mission, credentials, model budget |
| Agent Blueprint | reusable job knowledge, evaluation, versioned provenance | runtime, identity, activation, repository access |
| Mission and goal | standing purpose and bounded current authority | platform capability or credential possession |

An apparently actionable blueprint message is still a request. The receiving environment validates its own authority, profile capability, credential custody, usage gate, and current goal before acting.

## Communications compatibility

The released 0.2 family remains bound to released pairwise Communications 0.6 semantics. The Communications 0.8 development candidate proposes publisher-owned group message stores. If both candidates later release, a blueprint publication notice may travel through a publisher's store using an immutable blueprint reference. Repository membership would define visibility, but transport would not adopt or activate the family.

Unknown blueprint semantics are retained for later evaluation. An inaccessible source reference remains unverified. A reader continues scanning later messages and never invents the missing package, evidence, or authority.

No public reference exchange, Communications 0.8 tag, Environment Profiles 1.1 tag, or Blueprint compatibility release is claimed here.

## Relationship to A2A and discovery

A2A can expose agent discovery and task-oriented network interaction. NX blueprints describe durable, versioned knowledge inheritance. They are complementary; this repository does not implement A2A or publish an Agent Card.

Likewise, a public discovery file or `peoplebot.me` can help a person or tool find documentation. Discovery is not initialization, installation, activation, adoption, messaging, or external-action authority.
