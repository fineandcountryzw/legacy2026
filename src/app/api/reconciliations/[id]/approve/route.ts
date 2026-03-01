// =====================================================
// Approve Reconciliation API
// POST /api/reconciliations/[id]/approve
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';
import { 
  reconcileReconciliation, 
  approveReconciliation 
} from '@/lib/services/reconciliation-service';
import { hasPermission } from '@/lib/auth/rbac';

function sql() {
  return getDb();
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { id: reconciliationId } = await params;
    
    // Get user from database
    const userResult = await sql()`
      SELECT u.id, u.role, 
        COALESCE(
          json_agg(DISTINCT up.permission) FILTER (WHERE up.permission IS NOT NULL),
          '[]'
        ) as permissions
      FROM users u
      LEFT JOIN user_permissions up ON u.id = up.user_id
      WHERE u.clerk_id = ${userId}
      GROUP BY u.id
    `;
    
    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const user = userResult[0];
    const userPermissions = user.permissions || [];
    
    // Parse request body
    const body = await request.json();
    const action = body.action; // 'reconcile' or 'approve'
    
    // Get IP address
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    
    let result;
    
    if (action === 'reconcile') {
      // Check permission - need MANAGE_RECONCILIATIONS
      if (!hasPermission(user.role, userPermissions, 'MANAGE_RECONCILIATIONS')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
      
      result = await reconcileReconciliation(
        reconciliationId,
        user.id,
        body.notes,
        ipAddress
      );
      
      return NextResponse.json({
        success: true,
        reconciliation: result,
        message: 'Reconciliation marked as reconciled',
      });
    } else if (action === 'approve') {
      // Check permission - need MANAGE_RECONCILIATIONS (Manager only)
      if (!hasPermission(user.role, userPermissions, 'MANAGE_RECONCILIATIONS')) {
        return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
      }
      
      result = await approveReconciliation(
        reconciliationId,
        user.id,
        body.notes,
        ipAddress
      );
      
      return NextResponse.json({
        success: true,
        reconciliation: result,
        message: 'Reconciliation approved',
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "reconcile" or "approve"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Error processing reconciliation:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
