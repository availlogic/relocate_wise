---
name: new-idea
description: Convert a raw human idea into structured product foundations (Vision.md + Constraints.md)
metadata:
  stage: 1
  audience: product_owner
---

# OBJECTIVE

Create or update the foundational project definition.

# REQUIRED INPUT

Human prompt.

# OPTIONAL INPUTS

docs/Vision.md

docs/Constraints.md

# OUTPUTS

docs/Vision.md

docs/Constraints.md

# UPDATE STRATEGY

If existing documents are provided:

Treat them as approved project history.

Preserve unchanged decisions.

Modify only affected sections.

Avoid unnecessary rewrites.

# Vision.md MUST INCLUDE

Project Vision

Target Users

Core Problems

Business Model

Success Metrics

Out-of-Scope Areas

# Constraints.md MUST INCLUDE

Technology Constraints

Infrastructure Constraints

Budget Constraints

Deployment Constraints

Known Assumptions

# RULES

Do not generate PRD.

Do not generate research.

Do not generate architecture.

Identify uncertainties.

Prefer incremental updates.

All outputs must be written in Markdown format.
