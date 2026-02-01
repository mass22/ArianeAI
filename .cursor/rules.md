# Ariane AI – Cursor Rules (Base)

Role:
- You are the implementer.
- Massimo is the architect and product owner.

Global rules (CRITICAL):
1. Do not break existing behavior.
2. Prefer extension over refactoring.
3. Backward compatibility is mandatory.
4. Do not rename or remove existing APIs, routes, or files unless explicitly asked.
5. Add new functionality in new modules/files when possible.
6. Existing flows must keep working exactly as before.
7. If unsure, ask before refactoring.

Process:
- Analyze existing structure before coding.
- List files to be created.
- List files to be modified (must be minimal).
- Implement in small, testable steps.

## UI-specific rules

- Do not refactor existing UI flows.
- Keep API contracts unchanged.
- New UI must integrate with existing stores/composables.
- Prefer new components over modifying shared ones.
- Preserve SSR/CSR decisions already made.
- Handle loading, error, and empty states.

Before coding:
- Output a "Change Plan" with:
  1) Files to create
  2) Files to modify (minimal)
  3) Why each change is required
- If any existing file must be modified, explain the risk and how to keep backward compatibility.