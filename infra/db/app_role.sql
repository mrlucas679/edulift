-- Run once as the database owner, with: psql -v app_password='...' -f app_role.sql
-- The API connects as this role. Migrations keep running as the owner, so the API never holds DDL rights.

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'edulift_app') THEN
        CREATE ROLE edulift_app LOGIN;
    END IF;
END
$$;

ALTER ROLE edulift_app WITH PASSWORD :'app_password';

GRANT CONNECT ON DATABASE edulift TO edulift_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO edulift_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO edulift_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO edulift_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO edulift_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO edulift_app;
