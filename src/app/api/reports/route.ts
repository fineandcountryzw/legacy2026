// =====================================================
// Reports API Routes
// GET /api/reports?type=estate-summary|developer-payouts|agent-performance
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';
import { hasPermission, type UserRole, type Permission } from '@/lib/auth/rbac';
import {
  getEstateSummary,
  getDeveloperPayoutSummary,
  getAgentPerformance,
  generateMonthlyReconciliation,
} from '@/lib/services/report-service';

function sql() {
  return getDb();
}

export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();
    
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
    if (!hasPermission(user.role as UserRole, userPermissions, 'VIEW_REPORTS')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Parse query params
    const { searchParams } = new URL(request.url);
    const reportType = searchParams.get('type');
    
    switch (reportType) {
      case 'estate-summary': {
        const developmentId = searchParams.get('developmentId') || undefined;
        const data = await getEstateSummary(developmentId);
        return NextResponse.json({ report: data });
      }
      
      case 'developer-payouts': {
        const developer = searchParams.get('developer') || undefined;
        const dateFrom = searchParams.get('dateFrom') || undefined;
        const dateTo = searchParams.get('dateTo') || undefined;
        const period = dateFrom || dateTo ? { from: dateFrom || '', to: dateTo || '' } : undefined;
        const data = await getDeveloperPayoutSummary(developer, period);
        return NextResponse.json({ report: data });
      }
      
      case 'agent-performance': {
        const agentCode = searchParams.get('agentCode');
        if (!agentCode) {
          return NextResponse.json({ error: 'agentCode is required' }, { status: 400 });
        }
        const data = await getAgentPerformance(agentCode);
        return NextResponse.json({ report: data });
      }
      
      case 'monthly-reconciliation': {
        const developmentId = searchParams.get('developmentId');
        const year = parseInt(searchParams.get('year') || '0', 10);
        const month = parseInt(searchParams.get('month') || '0', 10);
        
        if (!developmentId || !year || !month) {
          return NextResponse.json(
            { error: 'developmentId, year, and month are required' },
            { status: 400 }
          );
        }
        
        const data = await generateMonthlyReconciliation(developmentId, year, month);
        return NextResponse.json({ report: data });
      }
      
      default:
        return NextResponse.json(
          { error: 'Invalid report type. Must be one of: estate-summary, developer-payouts, agent-performance, monthly-reconciliation' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { error: 'Failed to generate report', message: (error as Error).message },
      { status: 500 }
    );
  }
}
