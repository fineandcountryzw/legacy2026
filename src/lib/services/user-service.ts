// =====================================================
// User Management Service
// Lakecity Accounting Suite
// =====================================================

import { getDb, generateId } from '../db';
import { logAudit, AUDIT_ACTIONS } from '../audit';
import {
  User,
  UserWithPermissions,
  CreateUserInput,
  UpdateUserInput,
} from '../auth/types';
import { getRolePermissions, Permission, UserRole } from '../auth/rbac';

// Lazy initialization to avoid build-time errors
function sql() {
  return getDb();
}

// ==========================================
// User CRUD Operations
// ==========================================

/**
 * Create a new user
 */
export async function createUser(
  input: CreateUserInput,
  createdBy?: string,
  ipAddress?: string
): Promise<UserWithPermissions> {
  // Check if email already exists
  const existing = await sql()`
    SELECT id FROM users WHERE email = ${input.email}
  `;
  
  if (existing.length > 0) {
    throw new Error('User with this email already exists');
  }
  
  // Hash password (in production, use bcrypt)
  const passwordHash = await hashPassword(input.password);
  
  // Create user
  const result = await sql()`
    INSERT INTO users (
      id,
      email,
      password_hash,
      first_name,
      last_name,
      role,
      phone,
      is_active,
      created_by
    ) VALUES (
      ${generateId()},
      ${input.email},
      ${passwordHash},
      ${input.firstName},
      ${input.lastName},
      ${input.role},
      ${input.phone || null},
      true,
      ${createdBy || null}
    )
    RETURNING *
  `;
  
  const user = result[0];
  
  // Log to audit
  await logAudit({
    action: AUDIT_ACTIONS.USER_CREATED,
    entityType: 'USER',
    entityId: user.id,
    newValues: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
    },
    performedBy: createdBy,
    ipAddress,
    reason: `User created with role ${input.role}`,
  });
  
  return mapUserWithPermissions(user);
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<UserWithPermissions | null> {
  const result = await sql()`
    SELECT u.*,
      COALESCE(
        json_agg(DISTINCT up.permission) FILTER (WHERE up.permission IS NOT NULL),
        '[]'
      ) as permissions,
      COALESCE(
        json_agg(DISTINCT uda.development_id) FILTER (WHERE uda.development_id IS NOT NULL),
        '[]'
      ) as assigned_development_ids
    FROM users u
    LEFT JOIN user_permissions up ON u.id = up.user_id
    LEFT JOIN user_development_assignments uda ON u.id = uda.user_id
    WHERE u.id = ${userId}
    GROUP BY u.id
  `;
  
  if (result.length === 0) {
    return null;
  }
  
  return mapUserWithPermissions(result[0]);
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string): Promise<UserWithPermissions | null> {
  const result = await sql()`
    SELECT u.*,
      COALESCE(
        json_agg(DISTINCT up.permission) FILTER (WHERE up.permission IS NOT NULL),
        '[]'
      ) as permissions,
      COALESCE(
        json_agg(DISTINCT uda.development_id) FILTER (WHERE uda.development_id IS NOT NULL),
        '[]'
      ) as assigned_development_ids
    FROM users u
    LEFT JOIN user_permissions up ON u.id = up.user_id
    LEFT JOIN user_development_assignments uda ON u.id = uda.user_id
    WHERE u.email = ${email}
    GROUP BY u.id
  `;
  
  if (result.length === 0) {
    return null;
  }
  
  return mapUserWithPermissions(result[0]);
}

/**
 * Get user by Clerk ID
 */
export async function getUserByClerkId(clerkId: string): Promise<UserWithPermissions | null> {
  const result = await sql()`
    SELECT u.*,
      COALESCE(
        json_agg(DISTINCT up.permission) FILTER (WHERE up.permission IS NOT NULL),
        '[]'
      ) as permissions,
      COALESCE(
        json_agg(DISTINCT uda.development_id) FILTER (WHERE uda.development_id IS NOT NULL),
        '[]'
      ) as assigned_development_ids
    FROM users u
    LEFT JOIN user_permissions up ON u.id = up.user_id
    LEFT JOIN user_development_assignments uda ON u.id = uda.user_id
    WHERE u.clerk_id = ${clerkId}
    GROUP BY u.id
  `;
  
  if (result.length === 0) {
    return null;
  }
  
  return mapUserWithPermissions(result[0]);
}

/**
 * List all users
 */
export async function listUsers(
  options: { 
    role?: UserRole; 
    isActive?: boolean; 
    search?: string;
    limit?: number; 
    offset?: number;
  } = {}
): Promise<{ users: UserWithPermissions[]; total: number }> {
  const { role, isActive, search, limit = 50, offset = 0 } = options;
  
  // Build WHERE conditions
  const conditions: string[] = [];
  const params: unknown[] = [];
  
  if (role) {
    conditions.push(`role = $${params.length + 1}`);
    params.push(role);
  }
  
  if (isActive !== undefined) {
    conditions.push(`is_active = $${params.length + 1}`);
    params.push(isActive);
  }
  
  if (search) {
    conditions.push(`(
      email ILIKE $${params.length + 1} OR
      first_name ILIKE $${params.length + 1} OR
      last_name ILIKE $${params.length + 1}
    )`);
    params.push(`%${search}%`);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  // Get total count
  const countResult = await (sql() as any).unsafe(`
    SELECT COUNT(*) as total FROM users
    ${whereClause}
  `, params);
  
  const total = parseInt(countResult[0].total, 10);
  
  // Get users
  const result = await (sql() as any).unsafe(`
    SELECT u.*,
      COALESCE(
        json_agg(DISTINCT up.permission) FILTER (WHERE up.permission IS NOT NULL),
        '[]'
      ) as permissions,
      COALESCE(
        json_agg(DISTINCT uda.development_id) FILTER (WHERE uda.development_id IS NOT NULL),
        '[]'
      ) as assigned_development_ids
    FROM users u
    LEFT JOIN user_permissions up ON u.id = up.user_id
    LEFT JOIN user_development_assignments uda ON u.id = uda.user_id
    ${whereClause}
    GROUP BY u.id
    ORDER BY u.created_at DESC
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `, [...params, limit, offset]);
  
  return {
    users: result.map(mapUserWithPermissions),
    total,
  };
}

/**
 * Update user
 */
export async function updateUser(
  userId: string,
  input: UpdateUserInput,
  updatedBy?: string,
  ipAddress?: string
): Promise<UserWithPermissions> {
  // Get current user for audit
  const currentUser = await getUserById(userId);
  if (!currentUser) {
    throw new Error('User not found');
  }
  
  // Build update fields
  const updates: string[] = [];
  const params: unknown[] = [];
  const newValues: Record<string, unknown> = {};
  
  if (input.email !== undefined) {
    updates.push(`email = $${params.length + 1}`);
    params.push(input.email);
    newValues.email = input.email;
  }
  
  if (input.firstName !== undefined) {
    updates.push(`first_name = $${params.length + 1}`);
    params.push(input.firstName);
    newValues.firstName = input.firstName;
  }
  
  if (input.lastName !== undefined) {
    updates.push(`last_name = $${params.length + 1}`);
    params.push(input.lastName);
    newValues.lastName = input.lastName;
  }
  
  if (input.role !== undefined) {
    updates.push(`role = $${params.length + 1}`);
    params.push(input.role);
    newValues.role = input.role;
  }
  
  if (input.phone !== undefined) {
    updates.push(`phone = $${params.length + 1}`);
    params.push(input.phone);
    newValues.phone = input.phone;
  }
  
  if (input.isActive !== undefined) {
    updates.push(`is_active = $${params.length + 1}`);
    params.push(input.isActive);
    newValues.isActive = input.isActive;
  }
  
  if (updates.length === 0) {
    return currentUser;
  }
  
  // Execute update
  const result = await (sql() as any).unsafe(`
    UPDATE users
    SET ${updates.join(', ')}, updated_at = NOW()
    WHERE id = $${params.length + 1}
    RETURNING *
  `, [...params, userId]);
  
  const updatedUser = result[0];
  
  // Log to audit
  await logAudit({
    action: AUDIT_ACTIONS.USER_UPDATED,
    entityType: 'USER',
    entityId: userId,
    oldValues: {
      email: currentUser.email,
      firstName: currentUser.firstName,
      lastName: currentUser.lastName,
      role: currentUser.role,
      phone: currentUser.phone,
      isActive: currentUser.isActive,
    },
    newValues,
    performedBy: updatedBy,
    ipAddress,
  });
  
  return getUserById(userId) as Promise<UserWithPermissions>;
}

/**
 * Delete user (soft delete by deactivating)
 */
export async function deleteUser(
  userId: string,
  deletedBy?: string,
  ipAddress?: string
): Promise<void> {
  const currentUser = await getUserById(userId);
  if (!currentUser) {
    throw new Error('User not found');
  }
  
  // Deactivate user
  await sql()`
    UPDATE users
    SET is_active = false, updated_at = NOW()
    WHERE id = ${userId}
  `;
  
  // Log to audit
  await logAudit({
    action: AUDIT_ACTIONS.USER_DELETED,
    entityType: 'USER',
    entityId: userId,
    oldValues: { isActive: true },
    newValues: { isActive: false },
    performedBy: deletedBy,
    ipAddress,
    reason: 'User deactivated',
  });
}

// ==========================================
// Permission Management
// ==========================================

/**
 * Grant permission to user
 */
export async function grantPermission(
  userId: string,
  permission: Permission,
  grantedBy?: string,
  ipAddress?: string
): Promise<void> {
  // Check if permission already exists
  const existing = await sql()`
    SELECT id FROM user_permissions
    WHERE user_id = ${userId} AND permission = ${permission}
  `;
  
  if (existing.length > 0) {
    return; // Permission already granted
  }
  
  // Grant permission
  await sql()`
    INSERT INTO user_permissions (id, user_id, permission, granted_by)
    VALUES (${generateId()}, ${userId}, ${permission}, ${grantedBy || null})
  `;
  
  // Log to audit
  await logAudit({
    action: AUDIT_ACTIONS.PERMISSION_GRANTED,
    entityType: 'USER_PERMISSION',
    entityId: userId,
    newValues: { permission },
    performedBy: grantedBy,
    ipAddress,
  });
}

/**
 * Revoke permission from user
 */
export async function revokePermission(
  userId: string,
  permission: Permission,
  revokedBy?: string,
  ipAddress?: string
): Promise<void> {
  await sql()`
    DELETE FROM user_permissions
    WHERE user_id = ${userId} AND permission = ${permission}
  `;
  
  // Log to audit
  await logAudit({
    action: AUDIT_ACTIONS.PERMISSION_REVOKED,
    entityType: 'USER_PERMISSION',
    entityId: userId,
    oldValues: { permission },
    performedBy: revokedBy,
    ipAddress,
  });
}

/**
 * Set user permissions (replace all)
 */
export async function setUserPermissions(
  userId: string,
  permissions: Permission[],
  updatedBy?: string,
  ipAddress?: string
): Promise<void> {
  // Get current permissions for audit
  const currentResult = await sql()`
    SELECT permission FROM user_permissions WHERE user_id = ${userId}
  `;
  const currentPermissions = currentResult.map((r) => r.permission as string);
  
  // Delete existing permissions
  await sql()`
    DELETE FROM user_permissions WHERE user_id = ${userId}
  `;
  
  // Insert new permissions
  if (permissions.length > 0) {
    const values = permissions.map(p => ({
      id: generateId(),
      user_id: userId,
      permission: p,
      granted_by: updatedBy,
    }));
    
    for (const value of values) {
      await sql()`
        INSERT INTO user_permissions (id, user_id, permission, granted_by)
        VALUES (${value.id}, ${value.user_id}, ${value.permission}, ${value.granted_by})
      `;
    }
  }
  
  // Log to audit
  await logAudit({
    action: AUDIT_ACTIONS.PERMISSION_GRANTED,
    entityType: 'USER_PERMISSION',
    entityId: userId,
    oldValues: { permissions: currentPermissions },
    newValues: { permissions },
    performedBy: updatedBy,
    ipAddress,
  });
}

// ==========================================
// Development Assignment
// ==========================================

/**
 * Assign development to user
 */
export async function assignDevelopment(
  userId: string,
  developmentId: string,
  assignedBy?: string,
  ipAddress?: string
): Promise<void> {
  // Check if assignment already exists
  const existing = await sql()`
    SELECT id FROM user_development_assignments
    WHERE user_id = ${userId} AND development_id = ${developmentId}
  `;
  
  if (existing.length > 0) {
    return; // Already assigned
  }
  
  // Create assignment
  await sql()`
    INSERT INTO user_development_assignments (id, user_id, development_id, assigned_by)
    VALUES (${generateId()}, ${userId}, ${developmentId}, ${assignedBy || null})
  `;
  
  // Log to audit
  await logAudit({
    action: AUDIT_ACTIONS.ESTATE_ASSIGNED,
    entityType: 'USER_DEVELOPMENT',
    entityId: userId,
    newValues: { developmentId },
    performedBy: assignedBy,
    ipAddress,
  });
}

/**
 * Unassign development from user
 */
export async function unassignDevelopment(
  userId: string,
  developmentId: string,
  unassignedBy?: string,
  ipAddress?: string
): Promise<void> {
  await sql()`
    DELETE FROM user_development_assignments
    WHERE user_id = ${userId} AND development_id = ${developmentId}
  `;
  
  // Log to audit
  await logAudit({
    action: AUDIT_ACTIONS.ESTATE_UNASSIGNED,
    entityType: 'USER_DEVELOPMENT',
    entityId: userId,
    oldValues: { developmentId },
    performedBy: unassignedBy,
    ipAddress,
  });
}

/**
 * Set user development assignments (replace all)
 */
export async function setUserDevelopments(
  userId: string,
  developmentIds: string[],
  updatedBy?: string,
  ipAddress?: string
): Promise<void> {
  // Get current assignments for audit
  const currentResult = await sql()`
    SELECT development_id FROM user_development_assignments WHERE user_id = ${userId}
  `;
  const currentAssignments = currentResult.map((r) => r.development_id as string);
  
  // Delete existing assignments
  await sql()`
    DELETE FROM user_development_assignments WHERE user_id = ${userId}
  `;
  
  // Insert new assignments
  if (developmentIds.length > 0) {
    for (const developmentId of developmentIds) {
      await sql()`
        INSERT INTO user_development_assignments (id, user_id, development_id, assigned_by)
        VALUES (${generateId()}, ${userId}, ${developmentId}, ${updatedBy || null})
      `;
    }
  }
  
  // Log to audit
  await logAudit({
    action: AUDIT_ACTIONS.ESTATE_ASSIGNED,
    entityType: 'USER_DEVELOPMENT',
    entityId: userId,
    oldValues: { developmentIds: currentAssignments },
    newValues: { developmentIds },
    performedBy: updatedBy,
    ipAddress,
  });
}

import bcrypt from 'bcrypt';

// ==========================================
// Authentication Helpers
// ==========================================

const SALT_ROUNDS = 10;

/**
 * Hash password using bcrypt
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify password using bcrypt
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Record user login
 */
export async function recordLogin(
  userId: string,
  ipAddress?: string
): Promise<void> {
  await sql()`
    UPDATE users
    SET last_login_at = NOW(),
        login_attempts = 0,
        locked_until = null
    WHERE id = ${userId}
  `;
  
  await logAudit({
    action: AUDIT_ACTIONS.USER_LOGIN,
    entityType: 'USER',
    entityId: userId,
    performedBy: userId,
    ipAddress,
  });
}

/**
 * Record failed login attempt
 */
export async function recordFailedLogin(
  email: string,
  ipAddress?: string
): Promise<void> {
  const user = await getUserByEmail(email);
  if (!user) return;
  
  const maxAttempts = 5;
  const lockoutMinutes = 30;
  
  await sql()`
    UPDATE users
    SET login_attempts = login_attempts + 1,
        locked_until = CASE 
          WHEN login_attempts + 1 >= ${maxAttempts} THEN NOW() + INTERVAL '${lockoutMinutes} minutes'
          ELSE locked_until
        END
    WHERE id = ${user.id}
  `;
  
  await logAudit({
    action: 'LOGIN_FAILED',
    entityType: 'USER',
    entityId: user.id,
    performedBy: user.id,
    ipAddress,
    reason: `Failed login attempt ${(user.loginAttempts || 0) + 1}`,
  });
}

// ==========================================
// Mapping Functions
// ==========================================

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    email: row.email as string,
    firstName: row.first_name as string,
    lastName: row.last_name as string,
    role: row.role as UserRole,
    phone: row.phone as string | undefined,
    isActive: row.is_active as boolean,
    lastLoginAt: row.last_login_at as string | undefined,
    loginAttempts: row.login_attempts as number | undefined,
    lockedUntil: row.locked_until as string | undefined,
    createdBy: row.created_by as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapUserWithPermissions(row: Record<string, unknown>): UserWithPermissions {
  return {
    ...mapUser(row),
    permissions: ((row.permissions as string[] || []).filter(p => p !== null) as Permission[]),
    assignedDevelopmentIds: (row.assigned_development_ids as string[] || []).filter(id => id !== null),
  };
}


