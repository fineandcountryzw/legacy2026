// =====================================================
// Single Reconciliation API
// GET /api/reconciliations/[id]
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';
import { getReconciliationById, getReconciliationReport } from '@/lib/services/reconciliation-service';
import { hasPermission } from '@/lib/auth/rbac';

function sql() {
  return getDb();
}

export async function GET(
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
      SELECT u.role, 
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
    
    // Check permission - need MANAGE_RECONCILIATIONS or VIEW_REPORTS
    if (!hasPermission(user.role, userPermissions, 'MANAGE_RECONCILIATIONS') &&
        !hasPermission(user.role, userPermissions, 'VIEW_REPORTS')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Check if detailed report is requested
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';
    
    if (detailed) {
      // Get detailed report with transaction details
      const report = await getReconciliationReport(reconciliationId);
      return NextResponse.json({ report });
    }
    
    // Get basic reconciliation
    const reconciliation = await getReconciliationById(reconciliationId);
    
    if (!reconciliation) {
      return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });
    }
    
    return NextResponse.json({ reconciliation });
  } catch (error) {
    console.error('Error fetching reconciliation:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
