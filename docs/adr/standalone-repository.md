# Standalone repository

**Context.** The owner works on other projects on the same machine. EduLift must be
built, judged and maintained on its own.

**Decision.** One public GitHub repository, `mrlucas679/edulift`, containing `api/`, `client/`, `data/`, `infra/`,
`docs/`. No code, configuration, package or document is shared with or copied from any
other project.

**Consequences.** Because the repository is public from the start, nothing secret or
personal may ever be committed: no `.env`, no real learner data, no AWS account ids in
docs, and a secret scan runs in CI. Everything EduLift needs is declared in this repository. One CI
pipeline covers both apps. Branch protection on `main`.
