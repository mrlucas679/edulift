# ADR-0005 — Amazon RDS for PostgreSQL

**Context.** Relational reference data with requirement groups, per-learner rows that
must always be filtered by owner, and transactional writes.

**Decision.** RDS PostgreSQL 16, smallest burstable class, 20 GB, encrypted at rest,
private subnets, reachable only from the API security group, 7-day automated backups,
deletion protection. The API connects with a role that has no DDL rights; migrations run
with a separate migration role.

**Not done yet (2026-10-23).** In M1 the API connects as the database's master user, from the secret RDS manages. The separate no-DDL app role and migration role come in M2, before any learner data exists.

**Consequences.** Local and CI use PostgreSQL in Docker so behaviour matches production.
There is no in-memory substitute for the database.
