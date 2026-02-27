// =====================================================
// Calculate Net Payout API
// GET /api/payouts/calculate?standId=<id>
// Returns calculated net payout for a stand
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { calculateNetPayout } from '@/lib/services/payout-service';

/**
 * GET /api/payouts/calculate?standId=<id>
 * Calculate net payout amount for a stand
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get standId from query params
    const { searchParams } = new URL(request.url);
    const standId = searchParams.get('standId');
    
    if (!standId) {
      return NextResponse.json(
        { error: 'standId is required' },
        { status: 400 }
      );
    }
    
    // Calculate net payout
    const calculation = await calculateNetPayout(standId);
    
    return NextResponse.json({
      standId,
      ...calculation,
    });
  } catch (error) {
    console.error('Error calculating payout:', error);
    return NextResponse.json(
      { error: 'Failed to calculate payout', message: (error as Error).message },
      { status: 500 }
    );
  }
}
