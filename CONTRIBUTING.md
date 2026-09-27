# Contributing to EKKO

Thank you for helping build EKKO.

EKKO is intended to remain useful to churches with different sizes, traditions, budgets, streaming providers, and deployment preferences. Contributions should preserve that neutrality.

## Before contributing

1. Search existing issues and pull requests.
2. For substantial product or architecture changes, open an issue before implementation.
3. Keep church-specific branding and assumptions out of the core platform.
4. Keep the live-video path independent from chat, reactions, and presence where practical.
5. Preserve tenant boundaries: data belonging to one church must never leak to another.

## Development

This repository uses a pnpm workspace for TypeScript applications and shared packages. Native TV code may use its platform-native build system while sharing protocol contracts with the rest of EKKO.

## Pull requests

A good pull request should:

- explain the problem and the chosen approach;
- stay focused on one coherent change;
- include tests when behavior changes;
- update relevant documentation;
- avoid committing credentials, stream keys, private playlist URLs, or user data.

## Product invariants

The initial live experience intentionally has no pause, seek, rewind, or playback-speed UI.

TV may send reactions and read chat, but does not provide chat text input.

Web and mobile may both read and send chat and reactions.

Repeated reactions are intentional behavior, not duplicate submissions to suppress.

## License

By contributing, you agree that your contributions are licensed under the Apache License 2.0.
