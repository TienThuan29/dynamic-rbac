-- Migration: InitialCreate
-- AuthModule Database Schema
-- Generated: 2025-06-05

BEGIN;

-- ============================================================
-- Create __EFMigrationsHistory table
-- ============================================================
CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___EFMigrationsHistory" PRIMARY KEY ("MigrationId")
);

-- ============================================================
-- Table: accounts
-- ============================================================
CREATE TABLE accounts (
    id uuid NOT NULL,
    entra_id_object_id character varying(255) NOT NULL,
    username character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    role character varying(50) NOT NULL,
    is_active boolean NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NULL,
    CONSTRAINT "PK_accounts" PRIMARY KEY (id)
);

-- ============================================================
-- Table: permissions
-- ============================================================
CREATE TABLE permissions (
    id uuid NOT NULL,
    method character varying(20) NULL,
    endpoint character varying(500) NULL,
    permission_name character varying(255) NULL,
    permission_code character varying(150) NULL,
    description character varying(1000) NULL,
    is_public boolean NOT NULL,
    is_system boolean NOT NULL,
    is_active boolean NOT NULL,
    created_by uuid NULL,
    updated_by uuid NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NULL,
    CONSTRAINT "PK_permissions" PRIMARY KEY (id)
);

CREATE UNIQUE INDEX "IX_permissions_permission_code"
    ON permissions (permission_code)
    WHERE permission_code IS NOT NULL;

CREATE UNIQUE INDEX "IX_permissions_permission_name"
    ON permissions (permission_name)
    WHERE permission_name IS NOT NULL;

-- ============================================================
-- Table: permission_groups
-- ============================================================
CREATE TABLE permission_groups (
    id uuid NOT NULL,
    created_by uuid NULL,
    updated_by uuid NULL,
    group_name character varying(255) NOT NULL,
    permission_ids text[] NOT NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NULL,
    description character varying(1000) NULL,
    CONSTRAINT "PK_permission_groups" PRIMARY KEY (id)
);

-- ============================================================
-- Table: users
-- ============================================================
CREATE TABLE users (
    id uuid NOT NULL,
    account_id uuid NOT NULL,
    full_name character varying(255) NOT NULL,
    email character varying(255) NULL,
    avatar character varying(500) NULL,
    work_number character varying(20) NULL,
    nickname character varying(100) NULL,
    mobile_phone character varying(20) NULL,
    dob timestamp with time zone NULL,
    hire_date timestamp with time zone NULL,
    description character varying(1000) NULL,
    department character varying(255) NULL,
    created_at timestamp with time zone NOT NULL,
    updated_at timestamp with time zone NULL,
    CONSTRAINT "PK_users" PRIMARY KEY (id)
);

CREATE UNIQUE INDEX "IX_users_account_id" ON users (account_id);

ALTER TABLE users
    ADD CONSTRAINT "FK_users_accounts_account_id"
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

-- ============================================================
-- Table: user_permissions  (composite PK: account_id, permission_id)
-- ============================================================
CREATE TABLE user_permissions (
    account_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    assigned_at timestamp with time zone NOT NULL,
    assigned_by uuid NULL,
    expires_at timestamp with time zone NULL,
    CONSTRAINT "PK_user_permissions" PRIMARY KEY (account_id, permission_id)
);

CREATE INDEX "IX_user_permissions_permission_id" ON user_permissions (permission_id);

ALTER TABLE user_permissions
    ADD CONSTRAINT "FK_user_permissions_accounts_account_id"
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

ALTER TABLE user_permissions
    ADD CONSTRAINT "FK_user_permissions_permissions_permission_id"
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;

-- ============================================================
-- Table: tokens
-- ============================================================
CREATE TABLE tokens (
    id uuid NOT NULL,
    created_by uuid NOT NULL,
    account_id uuid NULL,
    token_hash character varying(255) NOT NULL,
    token_type character varying(50) NOT NULL,
    expires_at timestamp with time zone NULL,
    is_revoked boolean NOT NULL,
    CONSTRAINT "PK_tokens" PRIMARY KEY (id)
);

CREATE UNIQUE INDEX "IX_tokens_token_hash" ON tokens (token_hash);
CREATE INDEX "IX_tokens_created_by" ON tokens (created_by);
CREATE INDEX "IX_tokens_account_id_is_revoked" ON tokens (account_id, is_revoked);

ALTER TABLE tokens
    ADD CONSTRAINT "FK_tokens_accounts_created_by"
    FOREIGN KEY (created_by) REFERENCES accounts(id) ON DELETE RESTRICT;

ALTER TABLE tokens
    ADD CONSTRAINT "FK_tokens_accounts_account_id"
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;

-- ============================================================
-- Table: token_permissions  (composite PK: token_id, permission_id)
-- ============================================================
CREATE TABLE token_permissions (
    token_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    granted_at timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NULL,
    CONSTRAINT "PK_token_permissions" PRIMARY KEY (token_id, permission_id)
);

CREATE INDEX "IX_token_permissions_permission_id" ON token_permissions (permission_id);

ALTER TABLE token_permissions
    ADD CONSTRAINT "FK_token_permissions_permissions_permission_id"
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;

ALTER TABLE token_permissions
    ADD CONSTRAINT "FK_token_permissions_tokens_token_id"
    FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE;

-- ============================================================
-- Seed test accounts (idempotent)
-- ============================================================
INSERT INTO accounts (id, entra_id_object_id, username, email, role, is_active, created_at, updated_at)
SELECT '11111111-1111-1111-1111-111111111111'::uuid, 'entra-test-001', 'test.user1', 'test.user1@demo.local', 'User', true, NOW(), NULL
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE entra_id_object_id = 'entra-test-001');

INSERT INTO users (id, account_id, full_name, email, avatar, work_number, nickname, mobile_phone, dob, hire_date, description, department, created_at, updated_at)
SELECT '21111111-1111-1111-1111-111111111111'::uuid, '11111111-1111-1111-1111-111111111111'::uuid, 'Test User One', 'test.user1@demo.local', NULL, NULL, NULL, '0900000001', NULL, NULL, 'Seed account for local testing', 'Engineering', NOW(), NULL
WHERE EXISTS (SELECT 1 FROM accounts WHERE id = '11111111-1111-1111-1111-111111111111'::uuid)
  AND NOT EXISTS (SELECT 1 FROM users WHERE account_id = '11111111-1111-1111-1111-111111111111'::uuid);

INSERT INTO accounts (id, entra_id_object_id, username, email, role, is_active, created_at, updated_at)
SELECT '22222222-2222-2222-2222-222222222222'::uuid, 'entra-test-002', 'test.user2', 'test.user2@demo.local', 'Admin', true, NOW(), NULL
WHERE NOT EXISTS (SELECT 1 FROM accounts WHERE entra_id_object_id = 'entra-test-002');

INSERT INTO users (id, account_id, full_name, email, avatar, work_number, nickname, mobile_phone, dob, hire_date, description, department, created_at, updated_at)
SELECT '32222222-2222-2222-2222-222222222222'::uuid, '22222222-2222-2222-2222-222222222222'::uuid, 'Test User Two', 'test.user2@demo.local', NULL, NULL, NULL, '0900000002', NULL, NULL, 'Seed account for local testing', 'Operations', NOW(), NULL
WHERE EXISTS (SELECT 1 FROM accounts WHERE id = '22222222-2222-2222-2222-222222222222'::uuid)
  AND NOT EXISTS (SELECT 1 FROM users WHERE account_id = '22222222-2222-2222-2222-222222222222'::uuid);

-- ============================================================
-- Record migration
-- ============================================================
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20250605000000_InitialCreate', '8.0.11')
ON CONFLICT ("MigrationId") DO NOTHING;

COMMIT;
