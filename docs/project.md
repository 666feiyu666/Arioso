# Arioso Documentation

Arioso is an agentic music-composition workspace. An agent first turns a human
idea into an explicit musical plan, then a music-generation model realizes that
plan as audio. This file is the documentation entry point; long-term product
intent and the implemented repository state are deliberately kept separate.

## Document map

- [`abstract.md`](abstract.md) defines the stable product idea, target
  architecture, and long-term boundaries. Read it to understand what Arioso is
  intended to become.
- [`current.md`](current.md) records what the repository implements now and how
  it differs from the target. Read it before planning an architectural change.
- [`development.md`](development.md) contains the commands and working practices
  for developing and testing the current implementation.

## Maintenance rule

Change `abstract.md` only when the product model, target workflow, or
architectural boundaries change. Do not fill it with temporary model names,
current class names, API routes, or short-lived implementation limitations.

Update `current.md` when code changes alter the implemented workflow, data
model, persistence, interfaces, or known gaps. Source code, tests, configuration,
and command help remain authoritative when the snapshot is stale.

Keep this file short. It should explain the documentation structure rather than
duplicate either architecture document.
