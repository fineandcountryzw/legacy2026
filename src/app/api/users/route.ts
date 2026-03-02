// =====================================================
// Users API Routes
// GET /api/users - List users
// POST /api/users - Create user
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';
import { listUsers, createUser } from '@/lib/services/user-service';
import { hasPermission, type UserRole, type Permission } from '@/lib/auth/rbac';

function sql() {
  return getDb();
}

/**
 * Sync Clerk user to local database
 * Creates or updates the user record in our database
 */
async function syncClerkUser(clerkUserId: string) {
  try {
    // Check if user already exists
    const existingUser = await sql()`
      SELECT id, role, permissions FROM users WHERE clerk_id = ${clerkUserId}
    `;
    
    if (existingUser.length > 0) {
      return existingUser[0];
    }
    
    // Get user info from Clerk
    const client = await clerkClient();
    const clerkUser = await client.users.getUser(clerkUserId);
    
    const email = clerkUser.emailAddresses[0]?.emailAddress || 'unknown@example.com';
    const firstName = clerkUser.firstName || '';
    const lastName = clerkUser.lastName || '';
    
    // Create user in our database with ADMIN role for the first user
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
 * GET /api/users
 * List users with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Sync Clerk user to our database
    const user = await syncClerkUser(userId);
    const userPermissions = user.permissions || [];
    
    // Check permission
    if (!hasPermission(user.role, userPermissions, 'MANAGE_USERS')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Parse query params
    const { searchParams } = new URL(request.url);
    
    const role = (searchParams.get('role') as UserRole | null) || undefined;
    const isActive = searchParams.has('isActive') 
      ? searchParams.get('isActive') === 'true' 
      : undefined;
    const search = searchParams.get('search') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    
    // Get users
    const result = await listUsers({ role, isActive, search, limit, offset });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/users
 * Create a new user
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Sync Clerk user to our database
    const user = await syncClerkUser(userId);
    const userPermissions = user.permissions || [];
    
    // Check permission
    if (!hasPermission(user.role, userPermissions, 'MANAGE_USERS')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Parse body
    const body = await request.json();
    
    // Validate required fields
    if (!body.email || !body.firstName || !body.lastName || !body.role) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Validate role
    const validRoles = ['ADMIN', 'MANAGER', 'ACCOUNTANT', 'VIEWER', 'AGENT', 'FINANCE', 'AUDITOR'];
    if (!validRoles.includes(body.role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Get IP address
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    
    // Create user
    const newUser = await createUser(
      {
        email: body.email,
        password: body.password || 'tempPassword123!', // Temporary password
        firstName: body.firstName,
        lastName: body.lastName,
        role: body.role,
        phone: body.phone,
      },
      user.id,
      ipAddress
    );
    
    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    
    if ((error as Error).message === 'User with this email already exists') {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create user', message: (error as Error).message },
      { status: 500 }
    );
  }
}
