// =====================================================
// Payout Mark Paid API Route
// POST /api/payouts/:id/mark-paid
// Body: { paymentMethod: 'BANK_TRANSFER' | 'CASH' | 'CHEQUE', paymentReference: string, paidAt?: string }
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';
import { markPayoutPaid } from '@/lib/services/payout-service';
import { hasPermission } from '@/lib/auth/rbac';

function sql() {
  return getDb();
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/payouts/:id/mark-paid
 * Mark an approved payout as paid
 * Body: {
 *   paymentMethod: 'BANK_TRANSFER' | 'CASH' | 'CHEQUE'
 *   paymentReference: string
 *   paidAt?: string (ISO date)
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
      SELECT id, role, permissions FROM users WHERE clerk_id = ${userId}
    `;
    
    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const user = userResult[0];
    const userPermissions = user.permissions || [];
    
    // Check permission
    if (!hasPermission(user.role, userPermissions, 'MARK_PAYOUT_PAID')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Parse body
    const body = await request.json();
    
    // Validate required fields
    if (!body.paymentMethod || !body.paymentReference) {
      return NextResponse.json(
        { error: 'Missing required fields: paymentMethod and paymentReference' },
        { status: 400 }
      );
    }
    
    // Validate payment method
    const validMethods = ['BANK_TRANSFER', 'CASH', 'CHEQUE'];
    if (!validMethods.includes(body.paymentMethod)) {
      return NextResponse.json(
        { error: `Invalid payment method. Must be one of: ${validMethods.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Get IP address
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    
    // Mark payout as paid
    const payout = await markPayoutPaid(
      id,
      {
        paymentMethod: body.paymentMethod,
        paymentReference: body.paymentReference,
        paidAt: body.paidAt,
      },
      user.id,
      ipAddress
    );
    
    return NextResponse.json({ 
      payout,
      message: 'Payout marked as paid successfully'
    });
  } catch (error) {
    console.error('Error marking payout as paid:', error);
    
    const errorMessage = (error as Error).message;
    
    if (errorMessage === 'Payout not found') {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }
    
    if (errorMessage.includes('must be approved')) {
      return NextResponse.json({ error: errorMessage }, { status: 400 });
    }
    
    return NextResponse.json(
      { error: 'Failed to mark payout as paid', message: errorMessage },
      { status: 500 }
    );
  }
}

