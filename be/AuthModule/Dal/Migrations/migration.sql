-- Initial Migration: AuthModuleDb
-- Generated: 2025-06-02

-- Create accounts table
CREATE TABLE accounts (
    id uuid NOT NULL,
    entra_id_object_id character varying(255) NOT NULL,
    username character varying(100) NOT NULL,
    email character varying(255) NOT NULL,
    role character varying(50) NOT NULL DEFAULT 'User',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT NOW(),
    updated_at timestamp with time zone NULL,
    CONSTRAINT PK_accounts PRIMARY KEY (id)
);

-- Create permission_groups table
CREATE TABLE permission_groups (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(500) NULL,
    display_order integer NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT NOW(),
    updated_at timestamp with time zone NULL,
    CONSTRAINT PK_permission_groups PRIMARY KEY (id)
);

-- Create users table
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
    created_at timestamp with time zone NOT NULL DEFAULT NOW(),
    updated_at timestamp with time zone NULL,
    CONSTRAINT PK_users PRIMARY KEY (id),
    CONSTRAINT FK_users_accounts_account_id FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- Create permissions table
CREATE TABLE permissions (
    id uuid NOT NULL,
    permission_group_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description character varying(500) NULL,
    code character varying(100) NOT NULL,
    http_method character varying(50) NULL,
    endpoint character varying(500) NULL,
    display_order integer NOT NULL,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT NOW(),
    updated_at timestamp with time zone NULL,
    CONSTRAINT PK_permissions PRIMARY KEY (id),
    CONSTRAINT FK_permissions_permission_groups_permission_group_id FOREIGN KEY (permission_group_id) REFERENCES permission_groups(id) ON DELETE CASCADE
);

-- Create user_permissions table
CREATE TABLE user_permissions (
    id uuid NOT NULL,
    account_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    is_granted boolean NOT NULL DEFAULT true,
    granted_at timestamp with time zone NOT NULL DEFAULT NOW(),
    granted_by uuid NULL,
    expires_at timestamp with time zone NULL,
    reason character varying(500) NULL,
    CONSTRAINT PK_user_permissions PRIMARY KEY (id),
    CONSTRAINT FK_user_permissions_accounts_account_id FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    CONSTRAINT FK_user_permissions_permissions_permission_id FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- Create indexes
CREATE UNIQUE INDEX IX_permissions_code ON permissions(code);
CREATE INDEX IX_permissions_permission_group_id ON permissions(permission_group_id);
CREATE INDEX IX_user_permissions_account_id ON user_permissions(account_id);
CREATE INDEX IX_user_permissions_permission_id ON user_permissions(permission_id);
CREATE UNIQUE INDEX IX_users_account_id ON users(account_id);

-- Create __EFMigrationsHistory table (required by EF Core)
CREATE TABLE IF NOT EXISTS "__EFMigrationsHistory" (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT PK___EFMigrationsHistory PRIMARY KEY ("MigrationId")
);

-- Record the migration
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20250602114403_InitialCreate', '8.0.11');
