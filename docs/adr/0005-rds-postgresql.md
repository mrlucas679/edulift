# ADR-0005 — Amazon RDS for PostgreSQL

**Context.** Relational reference data with requirement groups, per-learner rows that
must always be filtered by owner, and transactional writes.

**Decision.** RDS PostgreSQL 16, smallest burstable class, 20 GB, encrypted at rest,
private subnets, reachable only from the API security group, 7-day automated backups,
deletion protection. The API connects with a role that has no DDL rights; migrations run
with a separate migration role.

**Consequences.** Local and CI use PostgreSQL in Docker so behaviour matches production.
There is no in-memory substitute for the database.
