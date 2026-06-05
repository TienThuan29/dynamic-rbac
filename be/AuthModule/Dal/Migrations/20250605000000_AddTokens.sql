-- Migration: AddTokens
-- Adds tokens and token_permissions tables for token-based permission management

BEGIN;

-- Create tokens table
CREATE TABLE tokens (
    id uuid NOT NULL,
    account_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    token_type character varying(50) NOT NULL DEFAULT 'Bearer',
    expires_at timestamp with time zone NULL,
    is_revoked boolean NOT NULL DEFAULT false,
    issued_at timestamp with time zone NOT NULL DEFAULT NOW(),
    ip_address character varying(50) NULL,
    user_agent character varying(500) NULL,
    CONSTRAINT PK_tokens PRIMARY KEY (id)
);

-- Create token_permissions table (join table: token <-> permission)
CREATE TABLE token_permissions (
    token_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    granted_at timestamp with time zone NOT NULL DEFAULT NOW(),
    expires_at timestamp with time zone NULL,
    CONSTRAINT PK_token_permissions PRIMARY KEY (token_id, permission_id)
);

-- Indexes
CREATE INDEX IX_tokens_account_id ON tokens (account_id);
CREATE UNIQUE INDEX IX_tokens_token_hash ON tokens (token_hash);
CREATE INDEX IX_token_permissions_permission_id ON token_permissions (permission_id);

-- Foreign keys
ALTER TABLE tokens
    ADD CONSTRAINT FK_tokens_accounts_account_id
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;

ALTER TABLE token_permissions
    ADD CONSTRAINT FK_token_permissions_permissions_permission_id
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE;

ALTER TABLE token_permissions
    ADD CONSTRAINT FK_token_permissions_tokens_token_id
    FOREIGN KEY (token_id) REFERENCES tokens(id) ON DELETE CASCADE;

-- Record migration
INSERT INTO "__EFMigrationsHistory" ("MigrationId", "ProductVersion")
VALUES ('20250605000000_AddTokens', '8.0.11');

COMMIT;
