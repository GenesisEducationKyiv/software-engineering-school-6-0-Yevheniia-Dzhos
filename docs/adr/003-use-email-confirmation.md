# ADR-003: Require Email Confirmation for Subscriptions

## Status

Accepted

## Context

Users can subscribe to GitHub repository release notifications using email addresses.

Without verification, malicious users could:
- subscribe other users' email addresses
- spam users
- abuse the notification system

Alternative considered:
- instant subscriptions without confirmation

## Decision

Require email confirmation before activating subscriptions.

## Rationale

Email confirmation:
- validates email ownership
- prevents spam subscriptions
- reduces abuse risks
- improves trust in the notification system

## Consequences

### Positive
- better security
- reduced abuse
- verified subscriptions

### Negative
- additional user step
- slightly slower onboarding flow
