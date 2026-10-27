# Project Guidelines

## Setup
Run dependencies installation and standard scripts.

## Critical backend invariants
- All database mutations must occur within a transaction.
- Parameterized queries must be used exclusively; raw SQL string concatenation is strictly forbidden.
- Secrets and tokens must never be logged or serialized in error objects.
- All external API calls must configure explicit timeouts.

## Migrations
- Migrations must be backward-compatible with active running versions.
- Never drop a database column without a deprecation release phase.
