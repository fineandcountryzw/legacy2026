// =====================================================
// Developer Reports API
// GET /api/reports/developer?developmentId=<id>&dateFrom=<>&dateTo=<>
// Returns financial summary for developer payouts
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';

function sql() {
  return getDb();
}

/**
 * GET /api/reports/developer
 * Get financial summary for developer reports
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get query params
    const { searchParams } = new URL(request.url);
    const developmentId = searchParams.get('developmentId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    
    if (!developmentId) {
      return NextResponse.json(
        { error: 'developmentId is required' },
        { status: 400 }
      );
    }
    
    // Build date filter
    let dateFilter = '';
    const dateParams: any[] = [developmentId];
    
    if (dateFrom) {
      dateFilter += ' AND cp.payment_date >= $2';
      dateParams.push(dateFrom);
    }
    if (dateTo) {
      dateFilter += ` AND cp.payment_date <= $${dateParams.length + 1}`;
      dateParams.push(dateTo);
    }
    
    // Get all stands in the development with their financial data
    const standsResult = await sql()`
      SELECT 
        ds.id,
        ds.stand_number,
        ds.client_name,
        COALESCE(SUM(cp.amount), 0) as total_received,
        COUNT(cp.id) as payment_count
      FROM development_stands ds
      JOIN stand_inventory si ON ds.stand_inventory_id = si.id
      LEFT JOIN customer_payments cp ON ds.id = cp.stand_id
        ${dateFilter ? sql().unsafe(dateFilter) : sql()``}
      WHERE ds.development_id = ${developmentId}
      GROUP BY ds.id, si.stand_number, ds.client_name
      ORDER BY si.stand_number
    `;
    
    // Get deductions breakdown by type for all stands in development
    const deductionsResult = await sql()`
      SELECT 
        d.deduction_type,
        COALESCE(SUM(d.amount), 0) as total_amount
      FROM deductions d
      JOIN development_stands ds ON d.stand_id = ds.id
      WHERE ds.development_id = ${developmentId}
      GROUP BY d.deduction_type
    `;
    
    // Get payouts summary
    const payoutsResult = await sql()`
      SELECT 
        COUNT(*) as payout_count,
        COALESCE(SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END), 0) as total_paid,
        COALESCE(SUM(CASE WHEN status = 'PENDING' THEN amount ELSE 0 END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN status = 'APPROVED' THEN amount ELSE 0 END), 0) as approved_amount
      FROM developer_payouts
      WHERE development_id = ${developmentId}
    `;
    
    // Calculate totals
    const totalReceived = standsResult.reduce(
      (sum: number, s: any) => sum + Number(s.total_received || 0), 
      0
    );
    
    // Categorize deductions
    const fcCommission = deductionsResult.find(
      (d: any) => d.deduction_type === 'COMMISSION'
    )?.total_amount || 0;
    
    const fcAdminFees = deductionsResult.find(
      (d: any) => d.deduction_type === 'ADMIN_FEE'
    )?.total_amount || 0;
    
    // Legal fees, AOS, etc. go to developer (not deducted from payout)
    const legalFees = deductionsResult.find(
      (d: any) => d.deduction_type === 'LEGAL_FEE'
    )?.total_amount || 0;
    
    const aosFees = deductionsResult.find(
      (d: any) => d.deduction_type === 'AOS'
    )?.total_amount || 0;
    
    const otherDeductions = deductionsResult
      .filter((d: any) => !['COMMISSION', 'ADMIN_FEE'].includes(d.deduction_type))
      .reduce((sum: number, d: any) => sum + Number(d.total_amount || 0), 0);
    
    // F&C Retain = Commission + Admin Fees only
    const fcRetain = Number(fcCommission) + Number(fcAdminFees);
    
    // Net Payable to Developer = Total Received - F&C Retain
    // (Legal fees and other deductions are paid to developer, not subtracted)
    const netPayable = totalReceived - fcRetain;
    
    // Build summary by category for the table
    const summary = [
      {
        category: 'Customer Payments',
        received: totalReceived,
        refunds: 0,
        net: totalReceived,
        payable: totalReceived, // Before F&C deductions
      },
      {
        category: 'F&C Commission',
        received: 0,
        refunds: 0,
        net: 0,
        payable: -Number(fcCommission),
      },
      {
        category: 'F&C Admin Fees',
        received: 0,
        refunds: 0,
        net: 0,
        payable: -Number(fcAdminFees),
      },
      {
        category: 'Legal/AOS (to Developer)',
        received: Number(legalFees) + Number(aosFees),
        refunds: 0,
        net: Number(legalFees) + Number(aosFees),
        payable: Number(legalFees) + Number(aosFees),
      },
    ];
    
    // Stand-level detail
    const standDetails = standsResult.map((stand: any) => ({
      standId: stand.id,
      standNumber: stand.stand_number,
      clientName: stand.client_name,
      totalReceived: Number(stand.total_received || 0),
      paymentCount: Number(stand.payment_count || 0),
    }));
    
    return NextResponse.json({
      developmentId,
      dateRange: { from: dateFrom, to: dateTo },
      summary,
      standDetails,
      totals: {
        totalReceived,
        fcCommission: Number(fcCommission),
        fcAdminFees: Number(fcAdminFees),
        fcRetain,
        legalFees: Number(legalFees),
        aosFees: Number(aosFees),
        otherDeductions,
        netPayable,
      },
      payouts: {
        totalPaid: Number(payoutsResult[0]?.total_paid || 0),
        pendingAmount: Number(payoutsResult[0]?.pending_amount || 0),
        approvedAmount: Number(payoutsResult[0]?.approved_amount || 0),
        payoutCount: Number(payoutsResult[0]?.payout_count || 0),
      },
      nextPayoutDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    });
    
  } catch (error) {
    console.error('Error generating developer report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report', message: (error as Error).message },
      { status: 500 }
    );
  }
}
