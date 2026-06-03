-- Seed 2 test accounts for AuthModule login
-- Database: AppDb (shared database for all modules)
-- Safe to run multiple times (idempotent by entra_id_object_id)

BEGIN;

-- Account 1
INSERT INTO accounts (
    id,
    entra_id_object_id,
    username,
    email,
    role,
    is_active,
    created_at,
    updated_at
)
SELECT
    '11111111-1111-1111-1111-111111111111'::uuid,
    'entra-test-001',
    'test.user1',
    'test.user1@demo.local',
    'User',
    true,
    NOW(),
    NULL
WHERE NOT EXISTS (
    SELECT 1
    FROM accounts a
    WHERE a.entra_id_object_id = 'entra-test-001'
);

INSERT INTO users (
    id,
    account_id,
    full_name,
    email,
    avatar,
    work_number,
    nickname,
    mobile_phone,
    dob,
    hire_date,
    description,
    department,
    created_at,
    updated_at
)
SELECT
    '21111111-1111-1111-1111-111111111111'::uuid,
    '11111111-1111-1111-1111-111111111111'::uuid,
    'Test User One',
    'test.user1@demo.local',
    NULL,
    NULL,
    NULL,
    '0900000001',
    NULL,
    NULL,
    'Seed account for local testing',
    'Engineering',
    NOW(),
    NULL
WHERE EXISTS (
    SELECT 1
    FROM accounts a
    WHERE a.id = '11111111-1111-1111-1111-111111111111'::uuid
)
AND NOT EXISTS (
    SELECT 1
    FROM users u
    WHERE u.account_id = '11111111-1111-1111-1111-111111111111'::uuid
);

-- Account 2
INSERT INTO accounts (
    id,
    entra_id_object_id,
    username,
    email,
    role,
    is_active,
    created_at,
    updated_at
)
SELECT
    '22222222-2222-2222-2222-222222222222'::uuid,
    'entra-test-002',
    'test.user2',
    'test.user2@demo.local',
    'Admin',
    true,
    NOW(),
    NULL
WHERE NOT EXISTS (
    SELECT 1
    FROM accounts a
    WHERE a.entra_id_object_id = 'entra-test-002'
);

INSERT INTO users (
    id,
    account_id,
    full_name,
    email,
    avatar,
    work_number,
    nickname,
    mobile_phone,
    dob,
    hire_date,
    description,
    department,
    created_at,
    updated_at
)
SELECT
    '32222222-2222-2222-2222-222222222222'::uuid,
    '22222222-2222-2222-2222-222222222222'::uuid,
    'Test User Two',
    'test.user2@demo.local',
    NULL,
    NULL,
    NULL,
    '0900000002',
    NULL,
    NULL,
    'Seed account for local testing',
    'Operations',
    NOW(),
    NULL
WHERE EXISTS (
    SELECT 1
    FROM accounts a
    WHERE a.id = '22222222-2222-2222-2222-222222222222'::uuid
)
AND NOT EXISTS (
    SELECT 1
    FROM users u
    WHERE u.account_id = '22222222-2222-2222-2222-222222222222'::uuid
);

COMMIT;

-- Optional verification
-- SELECT a.id, a.entra_id_object_id, a.email, a.role, u.full_name
-- FROM accounts a
-- LEFT JOIN users u ON u.account_id = a.id
-- WHERE a.entra_id_object_id IN ('entra-test-001', 'entra-test-002');
