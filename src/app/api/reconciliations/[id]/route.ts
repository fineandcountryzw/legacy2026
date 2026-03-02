import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';
import { getReconciliationById, reconcileReconciliation } from '@/lib/services/reconciliation-service';
import { hasPermission, type UserRole, type Permission } from '@/lib/auth/rbac';

function sql() {
  return getDb();
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/reconciliations/:id
 * Get reconciliation details
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = await params;
    
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
    
    const reconciliation = await getReconciliationById(id);
    
    return NextResponse.json({ reconciliation });
  } catch (error) {
    console.error('Error fetching reconciliation:', error);
    
    if ((error as Error).message === 'Reconciliation not found') {
      return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch reconciliation', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/reconciliations/:id
 * Reconcile a reconciliation (add period transactions)
 */
export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id } = await params;
    
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
    
    // Parse body
    const body = await request.json();
    
    // Get IP address
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    
    // Reconcile the reconciliation
    const reconciliation = await reconcileReconciliation(
      id,
      user.id,
      ipAddress
    );
    
    return NextResponse.json({
      success: true,
      reconciliation,
      message: 'Reconciliation reconciled successfully',
    });
  } catch (error) {
    console.error('Error reconciling:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
