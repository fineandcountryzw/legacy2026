// =====================================================
// Individual Payout API Routes
// GET /api/payouts/:id - Get payout details with history
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';
import { getPayoutById } from '@/lib/services/payout-service';
import { hasPermission, type UserRole, type Permission } from '@/lib/auth/rbac';

function sql() {
  return getDb();
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/payouts/:id
 * Get payout details with approval history
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth();
    const { id } = await params;
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user from our database
    const userResult = await sql()`
      SELECT id, role, permissions FROM users WHERE id = ${userId}
    `;
    
    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const user = userResult[0];
    const userPermissions: Permission[] = (user.permissions || []) as Permission[];
    
    // Check permission
    if (!hasPermission(user.role as UserRole, userPermissions, 'VIEW_ALL_PAYOUTS')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Get payout
    const payout = await getPayoutById(id);
    
    return NextResponse.json({ payout });
  } catch (error) {
    console.error('Error fetching payout:', error);
    
    if ((error as Error).message === 'Payout not found') {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch payout', message: (error as Error).message },
      { status: 500 }
    );
  }
}
