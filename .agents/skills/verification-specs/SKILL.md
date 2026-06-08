---
name: verification-specs
description: Transform PRD, UI/UX design documents, and system architecture into a comprehensive, implementation-ready verification specification package
metadata:
  stage: 5
  audience: qa
---

# OBJECTIVE

Perform cross-domain validation between product requirements, UI/UX design, and system architecture to ensure system consistency, testability, and completeness before implementation begins.

# INPUTS

docs/Vision.md

docs/Constraints.md

docs/Research_Report.md

docs/PRD.md

docs/User-Flows.md

docs/Screen-Specs.md

docs/Visual-Guidelines.md

docs/UI-Layouts.md

docs/Architecture.md

docs/API-Specs.md

docs/Database.md

docs/Module_Map.md

Optional:

docs/Review-Findings.md

docs/Test-Strategy.md

docs/Functional-Test-Cases.md

docs/Integration-Test-Cases.md

docs/E2E-Test-Scenarios.md

docs/Acceptance-Criteria.md

# OUTPUTS

docs/Review-Findings.md

docs/Test-Strategy.md

docs/Functional-Test-Cases.md

docs/Integration-Test-Cases.md

docs/E2E-Test-Scenarios.md

docs/Acceptance-Criteria.md

# UPDATE STRATEGY

If existing documents are provided:

Treat them as approved project history.

Preserve unchanged decisions.

Modify only affected sections.

Avoid unnecessary rewrites.

# Review-Findings.md MUST INCLUDE

Cross-system consistency audit (PRD vs Design vs Architecture mismatches)

Missing features, inconsistent flows, and data model inconsistencies

Undefined or unused APIs across UI and architecture layers

Security, edge-case gaps, performance risks, and bottlenecks

Structured issue list categorized by severity levels (Critical, High, Medium, Low)

# Test-Strategy.md MUST INCLUDE

Testing scope, testing levels (Unit, Integration, E2E, System), and coverage targets

Risk-based testing priorities and critical user flows identification

Automation strategy and Test-Driven Development (TDD) guidance for Coding Agents

# Functional-Test-Cases.md MUST INCLUDE

Feature-level test cases, input validation, and UI interaction tests

State transition tests (loading, error, success, empty states) and feature-specific edge cases

Structured format per test case: Feature Name, Preconditions, Steps, Expected Result, Priority

# Integration-Test-Cases.md MUST INCLUDE

API-to-Frontend and API-to-Database consistency tests

Event-driven workflows (queues, messaging systems) and external service integrations

Failure recovery scenarios focusing on system-level correctness beyond UI behavior

# E2E-Test-Scenarios.md MUST INCLUDE

Complete multi-step user journeys and cross-screen navigation flows based on user-flows.md

Realistic browser-based interaction scenarios (e.g., registration-to-dashboard, form-to-confirmation)

# Acceptance-Criteria.md MUST INCLUDE

Feature-level acceptance rules and business rule validation

Functional completeness criteria, UX correctness conditions, and data integrity requirements

Structured format per feature: Feature Name, Acceptance Conditions (bullet list), Definition of Done (DoD)

# RULES

Do not write or generate executable test code or implementation code.

Do not modify or rewrite upstream documents in docs directory.

Explicitly flag and log any upstream documentation ambiguities or inconsistencies with severity levels.

Map every documented UI behavior to a functional test case.

Map every defined API and system boundary to an integration coverage requirement.

Map every user flow to an E2E scenario and every feature to explicit acceptance criteria.

Focus strictly on producing deterministic, unambiguous verification specifications that downstream Coding Agents can use directly for TDD.

All outputs must be written in Markdown format.
