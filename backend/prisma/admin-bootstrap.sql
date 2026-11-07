-- Run only from a trusted database session after creating the admin user's normal account.
-- Replace the email below. This grants ADMIN membership; it does not create a public admin signup path.
SET @admin_email = 'REPLACE_WITH_ADMIN_EMAIL';
SET @admin_user_id = (SELECT id FROM User WHERE email = @admin_email LIMIT 1);

-- Reuse an existing organization where possible; otherwise create a platform admin organization.
SET @admin_org_id = (
  SELECT organizationId FROM OrganizationMember
  WHERE userId = @admin_user_id
  ORDER BY createdAt ASC LIMIT 1
);

INSERT INTO Organization (id, name, createdAt, updatedAt)
SELECT CONCAT('sg-admin-org-', REPLACE(UUID(), '-', '')), 'STITCHGRID Platform Administration', NOW(), NOW()
WHERE @admin_user_id IS NOT NULL AND @admin_org_id IS NULL;

SET @admin_org_id = COALESCE(
  @admin_org_id,
  (SELECT id FROM Organization WHERE name = 'STITCHGRID Platform Administration' ORDER BY createdAt DESC LIMIT 1)
);

INSERT INTO OrganizationMember (id, userId, organizationId, role, isActive, createdAt)
SELECT CONCAT('sg-admin-member-', REPLACE(UUID(), '-', '')), @admin_user_id, @admin_org_id, 'ADMIN', 1, NOW()
WHERE @admin_user_id IS NOT NULL
  AND @admin_org_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM OrganizationMember
    WHERE userId = @admin_user_id AND organizationId = @admin_org_id AND role = 'ADMIN'
  );

SELECT
  u.id AS userId,
  u.email,
  m.organizationId,
  m.role,
  m.isActive
FROM User u
JOIN OrganizationMember m ON m.userId = u.id
WHERE u.email = @admin_email AND m.role = 'ADMIN';
