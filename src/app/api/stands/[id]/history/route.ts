// =====================================================
// Stand History API
// GET /api/stands/[id]/history
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';
import { getStandHistory } from '@/lib/services/stand-lifecycle-service';
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
    
    const { id: standId } = await params;
    
    // Get user from database
    const userResult = await sql()`
      SELECT u.id, u.role, 
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
      WHERE u.clerk_id = ${userId}
      GROUP BY u.id
    `;
    
    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const user = userResult[0];
    const userPermissions = user.permissions || [];
    const assignedDevelopments = user.assigned_development_ids || [];
    
    // Check if user has VIEW_ALL_ESTATES or VIEW_ASSIGNED_ESTATES permission
    const canViewAll = hasPermission(user.role, userPermissions, 'VIEW_ALL_ESTATES');
    const canViewAssigned = hasPermission(user.role, userPermissions, 'VIEW_ASSIGNED_ESTATES');
    
    if (!canViewAll && !canViewAssigned) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Get stand details to check development access
    const standResult = await sql()`
      SELECT development_id FROM development_stands WHERE id = ${standId}
    `;
    
    if (standResult.length === 0) {
      return NextResponse.json({ error: 'Stand not found' }, { status: 404 });
    }
    
    const developmentId = standResult[0].development_id;
    
    // If user can only view assigned developments, check if they have access
    if (!canViewAll && canViewAssigned) {
      if (!assignedDevelopments.includes(developmentId)) {
        return NextResponse.json(
          { error: 'You do not have access to this stand' },
          { status: 403 }
        );
      }
    }
    
    // Get stand history
    const history = await getStandHistory(standId);
    
    return NextResponse.json(history);
  } catch (error) {
    console.error('Error getting stand history:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
