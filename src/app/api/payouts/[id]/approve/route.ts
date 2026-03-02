// =====================================================
// Payout Approval API Route
// POST /api/payouts/:id/approve
// Body: { approved: boolean, notes?: string }
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';
import { approvePayout } from '@/lib/services/payout-service';
import { hasPermission, type UserRole, type Permission } from '@/lib/auth/rbac';

function sql() {
  return getDb();
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/payouts/:id/approve
 * Approve or reject a pending payout
 * Body: {
 *   approved: boolean
 *   notes?: string
 * }
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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
    if (!hasPermission(user.role as UserRole, userPermissions, 'APPROVE_PAYOUT')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Parse body
    const body = await request.json();
    
    // Validate required fields
    if (typeof body.approved !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing or invalid approved field' },
        { status: 400 }
      );
    }
    
    // Get IP address
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    
    // Approve/Reject payout
    const payout = await approvePayout(
      id,
      {
        approved: body.approved,
        notes: body.notes,
      },
      user.id,
      ipAddress
    );
    
    return NextResponse.json({ 
      payout,
      message: body.approved ? 'Payout approved successfully' : 'Payout rejected'
    });
  } catch (error) {
    console.error('Error approving payout:', error);
    
    const errorMessage = (error as Error).message;
    
    if (errorMessage === 'Payout not found') {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }
    
    if (errorMessage.includes('Cannot') || errorMessage.includes('status')) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    
    return NextResponse.json(
      { error: 'Failed to approve payout', message: errorMessage },
      { status: 500 }
    );
  }
}
