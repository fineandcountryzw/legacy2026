// =====================================================
// Developer Payouts API Routes
// GET /api/payouts - List payouts with filters
// POST /api/payouts - Request a new payout
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';
import { requestPayout, getPayouts, getPendingPayouts } from '@/lib/services/payout-service';
import { hasPermission, type UserRole, type Permission } from '@/lib/auth/rbac';
import { PayoutFilters } from '@/lib/auth/types';

function sql() {
  return getDb();
}

/**
 * GET /api/payouts
 * List payouts with optional filters
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user from our database (by clerk_id)
    const userResult = await sql()`
      SELECT id, role, permissions FROM users WHERE clerk_id = ${userId}
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
    
    // Parse query params
    const { searchParams } = new URL(request.url);
    const filters: PayoutFilters = {};
    
    const status = searchParams.get('status');
    if (status) filters.status = status as PayoutFilters['status'];
    
    const developer = searchParams.get('developer');
    if (developer) filters.developer = developer;
    
    const developmentId = searchParams.get('developmentId');
    if (developmentId) filters.developmentId = developmentId;
    
    const dateFrom = searchParams.get('dateFrom');
    if (dateFrom) filters.dateFrom = dateFrom;
    
    const dateTo = searchParams.get('dateTo');
    if (dateTo) filters.dateTo = dateTo;
    
    const pendingOnly = searchParams.get('pendingOnly') === 'true';
    
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    
    // Get payouts
    let result;
    if (pendingOnly) {
      result = await getPendingPayouts(filters, { limit, offset });
    } else {
      result = await getPayouts(filters, { limit, offset });
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching payouts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payouts', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/payouts
 * Request a new payout
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get user from our database (by clerk_id)
    const userResult = await sql()`
      SELECT id, role, permissions FROM users WHERE clerk_id = ${userId}
    `;
    
    if (userResult.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    
    const user = userResult[0];
    const userPermissions: Permission[] = (user.permissions || []) as Permission[];
    
    // Check permission
    if (!hasPermission(user.role as UserRole, userPermissions, 'REQUEST_PAYOUT')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Parse body
    const body = await request.json();
    
    // Validate required fields
    if (!body.standId || !body.developerName || !body.amount || !body.payoutType) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Get IP address
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    
    // Create payout
    const payout = await requestPayout(
      {
        standId: body.standId,
        developerName: body.developerName,
        amount: body.amount,
        payoutType: body.payoutType,
        description: body.description,
        relatedDeductionIds: body.relatedDeductionIds,
        periodStart: body.periodStart,
        periodEnd: body.periodEnd,
      },
      user.id,
      ipAddress
    );
    
    return NextResponse.json({ payout }, { status: 201 });
  } catch (error) {
    console.error('Error requesting payout:', error);
    return NextResponse.json(
      { error: 'Failed to request payout', message: (error as Error).message },
      { status: 500 }
    );
  }
}
