---
name: design-architecture
description: Design system architecture including API, database, and module structure from PRD and research
metadata:
  stage: 4
  audience: system_architect
---

# OBJECTIVE

Create or update the technical architecture.

# INPUTS

docs/Vision.md

docs/Constraints.md

docs/Research_Report.md

docs/PRD.md

Optional:

docs/Architecture.md

# OUTPUTS

docs/Architecture.md

docs/Database.md

docs/API_Spec.md

docs/Module_Map.md

# UPDATE STRATEGY

If Architecture.md exists:

Treat it as approved architecture history.

Preserve stable decisions.

Modify only impacted areas.

Avoid unnecessary redesign.

# RULES

Strictly obey Constraints.md.

Prefer simplicity.

Prefer modularity.

Prefer maintainability.

Minimise operational complexity.

Define module boundaries clearly.

Optimise for long-term evolution.

# MODULE_MAP REQUIREMENTS

Each module must define:

Purpose

Location

Dependencies

Public Interfaces

Future Extension Points
