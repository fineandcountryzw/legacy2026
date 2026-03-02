// =====================================================
// Transfer Stand API
// POST /api/stands/[id]/transfer
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';
import { transferStand } from '@/lib/services/stand-lifecycle-service';
import { hasPermission, type UserRole, type Permission } from '@/lib/auth/rbac';

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
    
    const { id: standId } = await params;
    
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
    
    // Check permission - need TRANSFER_STAND
    if (!hasPermission(user.role as UserRole, userPermissions, 'TRANSFER_STAND')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Parse body
    const body = await request.json();
    
    // Validate required fields
    if (!body.newClientName) {
      return NextResponse.json(
        { error: 'New client name is required' },
        { status: 400 }
      );
    }
    
    if (!body.transferDate) {
      return NextResponse.json(
        { error: 'Transfer date is required' },
        { status: 400 }
      );
    }
    
    // Get IP address
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    
    // Transfer the stand (note: standId is passed separately, not in input)
    const result = await transferStand(
      standId,
      {
        standId, // Include standId in input to satisfy type
        newClientName: body.newClientName,
        newClientPhone: body.newClientPhone,
        newClientEmail: body.newClientEmail,
        transferDate: body.transferDate,
        transferFee: body.transferFee || 0,
        notes: body.notes,
      },
      user.id,
      ipAddress
    );
    
    return NextResponse.json({
      success: true,
      transfer: result,
      message: `Stand transferred to ${body.newClientName}`,
    });
  } catch (error) {
    console.error('Error transferring stand:', error);
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
