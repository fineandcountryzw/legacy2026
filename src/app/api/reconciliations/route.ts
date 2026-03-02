// =====================================================
// Reconciliations API
// GET /api/reconciliations - List reconciliations
// POST /api/reconciliations - Create reconciliation
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';
import { 
  createReconciliation, 
  getReconciliations 
} from '@/lib/services/reconciliation-service';
import { hasPermission, type UserRole, type Permission } from '@/lib/auth/rbac';

function sql() {
  return getDb();
}

/**
 * GET /api/reconciliations
 * List reconciliations with filters
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user from database
    const userResult = await sql()`
      SELECT u.role, 
        COALESCE(
          json_agg(DISTINCT up.permission) FILTER (WHERE up.permission IS NOT NULL),
          '[]'
        ) as permissions
      FROM users u
      LEFT JOIN user_permissions up ON u.id = up.user_id
      WHERE u.id = ${userId}
      GROUP BY u.id
    `;
    
    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const user = userResult[0];
    const userPermissions: Permission[] = (user.permissions || []) as Permission[];
    
    // Check permission - need MANAGE_RECONCILIATIONS or VIEW_REPORTS
    if (!hasPermission(user.role as UserRole, userPermissions, 'MANAGE_RECONCILIATIONS') &&
        !hasPermission(user.role as UserRole, userPermissions, 'VIEW_REPORTS')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Parse query params
    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('developmentId') || undefined;
    const status = searchParams.get('status') as 'DRAFT' | 'RECONCILED' | 'APPROVED' | undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    
    const result = await getReconciliations(developmentId, { status, limit, offset });
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching reconciliations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reconciliations', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reconciliations
 * Create a new reconciliation
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user from database
    const userResult = await sql()`
      SELECT u.id, u.role, 
        COALESCE(
          json_agg(DISTINCT up.permission) FILTER (WHERE up.permission IS NOT NULL),
          '[]'
        ) as permissions
      FROM users u
      LEFT JOIN user_permissions up ON u.id = up.user_id
      WHERE u.id = ${userId}
      GROUP BY u.id
    `;
    
    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const user = userResult[0];
    const userPermissions: Permission[] = (user.permissions || []) as Permission[];
    
    // Check permission - need MANAGE_RECONCILIATIONS
    if (!hasPermission(user.role as UserRole, userPermissions, 'MANAGE_RECONCILIATIONS')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    if (!body.developmentId) {
      return NextResponse.json(
        { error: 'Development ID is required' },
        { status: 400 }
      );
    }
    
    if (!body.periodStart) {
      return NextResponse.json(
        { error: 'Period start date is required' },
        { status: 400 }
      );
    }
    
    if (!body.periodEnd) {
      return NextResponse.json(
        { error: 'Period end date is required' },
        { status: 400 }
      );
    }
    
    // Get IP address
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    
    // Create reconciliation
    const reconciliation = await createReconciliation(
      body.developmentId,
      body.periodStart,
      body.periodEnd,
      user.id,
      ipAddress
    );
    
    return NextResponse.json({
      success: true,
      reconciliation,
      message: 'Reconciliation created successfully',
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating reconciliation:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
