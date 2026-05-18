# Botifarra Online — Technical Architecture & Development Guide

## Project Vision

Botifarra Online is a modern multiplayer implementation of the Catalan card game **Botifarra**.

The project is designed as a:

- mobile-first application
- lightweight web application
- future Android application
- future macOS desktop application

The main goals are:

- maintainability
- scalability
- strong developer experience
- reusable architecture
- authoritative multiplayer gameplay
- long-term extensibility

The project should be suitable for:

- a solo developer
- a small engineering team
- iterative feature delivery

---

# Core Product Goals

The application must support:

## User Accounts

- username/password authentication
- persistent user profiles
- game history
- rankings and statistics

## Multiplayer Gameplay

- real-time online Botifarra matches
- authoritative game server
- validated turns and scoring
- reconnect handling

## Matchmaking

- public matchmaking
- private invitation games
- pair/team matchmaking
- reconnect and abandonment handling

## Custom Games

- invite-only rooms
- configurable timers
- pause/resume
- private games
- optional bots

## Rankings

- global ranking
- individual ranking
- pair/team ranking
- fair skill-based ranking system

## Bots

- practice matches
- AI players
- future extensibility for smarter bots

---

# Development Philosophy

## Priorities

1. Simplicity
2. Maintainability
3. Developer productivity
4. Testability
5. Shared logic
6. Incremental scalability

The project intentionally avoids:

- premature microservices
- unnecessary cloud complexity
- over-engineering
- multiple backend languages

---

# Technology Stack

## Frontend

### Core Stack

- React
- TypeScript
- Vite

### Additional Libraries

- React Router
- TanStack Query
- Zustand
- Tailwind CSS (optional)
- Colyseus client

### Packaging Strategy

#### Web (Primary Target)

- Progressive Web App (PWA)

#### Android

- Capacitor

#### macOS Desktop

- Tauri

---

# Backend

## Core Stack

- Node.js
- TypeScript
- Fastify
- Colyseus

## Database

- PostgreSQL
- Prisma ORM

## Optional Future Infrastructure

- Redis / Valkey
- background workers
- analytics pipeline

---

# Windows Development Environment

The project is developed primarily on Windows using:

- Windows 11
- WSL2 Ubuntu
- Docker Desktop
- VS Code Remote WSL

## Important Rule

The repository MUST live inside the WSL filesystem.

Correct:

```bash
~/projects/botifarra
```

Avoid:

```text
C:\Users\...
```

---

# Architecture Overview

```text
                    ┌─────────────────────────┐
                    │ React/Vite PWA           │
                    │ Capacitor Android later  │
                    │ Tauri macOS later        │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
        REST API                            Real-time Game
   auth, profile, history,              Colyseus rooms
   rankings, settings                   WebSocket connection
              │                                   │
              └─────────────────┬─────────────────┘
                                │
                         Backend App
                    Node.js + TypeScript
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
        PostgreSQL                            Redis/Valkey
```

---

# Monorepo Structure

The project should use a monorepo architecture.

Recommended structure:

```text
botifarra/
  apps/
    web/
    server/

  packages/
    botifarra-core/
    shared/

  docker-compose.yml
  package.json
  pnpm-workspace.yaml
```

---

# Core Architectural Principle

## Shared Game Engine

The Botifarra rules MUST exist in a standalone package:

```text
packages/botifarra-core
```

This package must contain:

- game rules
- card logic
- legal move validation
- scoring
- game state transitions
- simulations
- bot interfaces

The package MUST:

- have no UI dependencies
- have no database dependencies
- have no WebSocket dependencies

The engine should be:

- deterministic
- pure where possible
- heavily tested

---

# TDD (Test-Driven Development) Strategy

## Critical Requirement

This project MUST be developed using a strict TDD strategy.

The development flow should always be:

```text
RED → GREEN → REFACTOR
```

Meaning:

1. Write a failing test
2. Implement the minimum code necessary
3. Refactor safely

---

# Why TDD Is Critical Here

Botifarra is fundamentally a:

- rules engine
- state machine
- multiplayer synchronization system

Without strong tests, the project will become:

- fragile
- difficult to evolve
- hard to debug

TDD is especially important for:

- scoring
- trick resolution
- legal move validation
- matchmaking
- reconnect handling
- rankings
- multiplayer synchronization

---

# Testing Strategy

## Unit Tests

The following MUST have exhaustive unit tests:

### botifarra-core

- deck creation
- shuffle logic
- dealing
- legal moves
- trick winner calculation
- scoring
- variant rules
- state transitions

### Ranking System

- rating updates
- pair rankings
- edge cases

### Matchmaking

- queue handling
- balancing
- reconnect handling

---

# Integration Tests

Integration tests should cover:

- game room lifecycle
- API endpoints
- authentication
- matchmaking
- persistence
- reconnect flows

---

# End-to-End Tests

Use:

- Playwright

Test:

- login
- queueing
- joining games
- playing complete matches
- reconnects
- rankings

---

# Recommended Testing Stack

## Unit + Integration

- Vitest

## E2E

- Playwright

## API Testing

- Supertest

---

# Development Rules

## Rule 1 — No Untested Core Logic

No game rules should be implemented without tests first.

Especially:

- scoring
- legal move validation
- trick resolution
- ranking calculations

---

## Rule 2 — Shared Types

Frontend and backend MUST share types through:

```text
packages/shared
```

Avoid duplicating:

- DTOs
- events
- commands
- enums

---

## Rule 3 — Authoritative Server

Clients must NEVER decide:

- whether a move is valid
- whether scoring is correct
- whether a player can act

The server is always authoritative.

---

## Rule 4 — Event-Driven Gameplay

Gameplay should use:

- commands
- validated state transitions
- emitted events

---

# Game State Design

Recommended flow:

```text
Client Command
    ↓
Server Validation
    ↓
State Transition
    ↓
Persist Event
    ↓
Broadcast Safe State
```

---

# Multiplayer Design

## Real-Time Transport

- WebSockets via Colyseus

## Server Responsibilities

- turn validation
- state synchronization
- reconnect handling
- hidden information management
- anti-cheat validation

---

# Matchmaking Modes

## Public Queue

Automatic matchmaking.

## Pair Queue

Two-player teams queue together.

## Private Games

Invite-based rooms.

## Custom Games

Custom rules/timers/settings.

---

# Database Design

## Main Entities

### Users

- profiles
- auth
- statistics

### Matches

- metadata
- status
- lifecycle

### Match Players

- seats
- teams
- results

### Events

- command/event log
- replay support
- debugging

### Rankings

- individual ratings
- pair ratings

---

# Ranking System

Recommended algorithm:

- TrueSkill-style ranking

Why:

- supports team games
- supports uncertainty
- handles evolving skill

Separate rankings:

- ranked
- casual
- pair
- individual

---

# Bot Architecture

Bots should use the same command interface as players.

Recommended progression:

## Level 1

Random legal moves.

## Level 2

Heuristic rules.

## Level 3

Simulation/search-based.

Bots should:

- never bypass validation
- interact through standard game commands

---

# Deployment Strategy

## MVP

### Frontend

- Vercel
- Netlify
- Cloudflare Pages

### Backend

- Fly.io
- Railway
- Render
- VPS

### Database

- PostgreSQL

---

# Packaging Strategy

## Phase 1

PWA only.

## Phase 2

Android via Capacitor.

## Phase 3

macOS desktop via Tauri.

---

# MVP Development Roadmap

## Phase 0 — Foundation

- monorepo
- docker
- React app
- backend
- Prisma
- CI

## Phase 1 — Game Engine

- rules
- scoring
- legal moves
- tests

## Phase 2 — Authentication

- register/login
- sessions
- profiles

## Phase 3 — Multiplayer

- Colyseus rooms
- game synchronization
- reconnects

## Phase 4 — Persistence

- match history
- events
- rankings

## Phase 5 — Matchmaking

- queues
- invites
- custom games

## Phase 6 — Bots

- random bot
- heuristic bot

## Phase 7 — Packaging

- Android
- macOS

---

# Recommended Initial Commands

## Install Dependencies

```bash
pnpm install
```

## Start Development

```bash
pnpm dev
```

## Run Tests

```bash
pnpm test
```

## Run E2E Tests

```bash
pnpm test:e2e
```

---

# Initial Priority

The FIRST major implementation goal should be:

```text
A fully tested standalone Botifarra rules engine.
```

Before:

- UI polish
- matchmaking
- mobile packaging
- rankings
- bots

The game engine is the foundation of the entire project.

---

# Final Philosophy

This project should prioritize:

- correctness
- testability
- shared logic
- maintainability
- incremental complexity

The architecture should remain:

- understandable
- modular
- strongly typed
- heavily tested

The goal is not only to build a Botifarra game.

The goal is to build:

- a reliable multiplayer platform
- a reusable game architecture
- a maintainable long-term codebase
- a high-quality engineering project
