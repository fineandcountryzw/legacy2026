// =====================================================
// User Permissions API Routes
// GET /api/users/:id/permissions - Get user permissions
// PUT /api/users/:id/permissions - Set user permissions
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';
import { getUserById, setUserPermissions } from '@/lib/services/user-service';
import { hasPermission, type Permission } from '@/lib/auth/rbac';

function sql() {
  return getDb();
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Sync Clerk user to local database
 */
async function syncClerkUser(clerkUserId: string) {
  try {
    const existingUser = await sql()`
      SELECT id, role, permissions FROM users WHERE clerk_id = ${clerkUserId}
    `;
    
    if (existingUser.length > 0) {
      return existingUser[0];
    }
    
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkUserId);
    
    const email = clerkUser.emailAddresses[0]?.emailAddress || 'unknown@example.com';
    const firstName = clerkUser.firstName || '';
    const lastName = clerkUser.lastName || '';
    
    const result = await sql()`
      INSERT INTO users (
        clerk_id,
        email,
        first_name,
        last_name,
        role,
        is_active
      ) VALUES (
        ${clerkUserId},
        ${email},
        ${firstName},
        ${lastName},
        'ADMIN',
        true
      )
      ON CONFLICT (email) DO UPDATE SET
        clerk_id = ${clerkUserId},
        first_name = ${firstName},
        last_name = ${lastName}
      RETURNING id, role, permissions
    `;
    
    return result[0];
  } catch (error) {
    console.error('Error syncing Clerk user:', error);
    throw error;
  }
}

/**
 * GET /api/users/:id/permissions
 * Get user permissions (role-based + custom)
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    const { id } = await params;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Sync Clerk user
    const user = await syncClerkUser(userId);
    const userPermissions = user.permissions || [];
    
    // Check permission (users can view their own, admins can view all)
    const isOwnProfile = user.id === id;
    if (!isOwnProfile && !hasPermission(user.role, userPermissions, 'ASSIGN_PERMISSIONS')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Get target user
    const targetUser = await getUserById(id);
    
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      role: targetUser.role,
      rolePermissions: getRolePermissions(targetUser.role),
      customPermissions: targetUser.permissions,
    });
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user permissions', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/users/:id/permissions
 * Set user custom permissions (replaces all)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    const { id } = await params;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Sync Clerk user
    const user = await syncClerkUser(userId);
    const userPermissions = user.permissions || [];
    
    // Check permission
    if (!hasPermission(user.role, userPermissions, 'ASSIGN_PERMISSIONS')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Parse body
    const body = await request.json();
    
    // Validate permissions
    if (!body.permissions || !Array.isArray(body.permissions)) {
      return NextResponse.json(
        { error: 'permissions must be an array' },
        { status: 400 }
      );
    }
    
    // Get IP address
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    
    // Set permissions
    await setUserPermissions(id, body.permissions as Permission[], user.id, ipAddress);
    
    // Get updated user
    const updatedUser = await getUserById(id);
    
    return NextResponse.json({ 
      message: 'Permissions updated successfully',
      permissions: updatedUser?.permissions || [],
    });
  } catch (error) {
    console.error('Error updating user permissions:', error);
    return NextResponse.json(
      { error: 'Failed to update user permissions', message: (error as Error).message },
      { status: 500 }
    );
  }
}

// Helper function to get role permissions (imported from rbac)
function getRolePermissions(role: string): Permission[] {
  const { ROLE_PERMISSIONS } = require('@/lib/auth/rbac');
  return ROLE_PERMISSIONS[role] || [];
}

