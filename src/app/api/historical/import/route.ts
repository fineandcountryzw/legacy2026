// =====================================================
// Historical Data Import API
// POST /api/historical/import
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getDb } from '@/lib/db';
import { importHistoricalStands, getImportTemplate } from '@/lib/services/historical-data-service';
import { hasPermission } from '@/lib/auth/rbac';

function sql() {
  return getDb();
}

/**
 * GET /api/historical/import
 * Get import template information
 */
export async function GET() {
  try {
    const template = getImportTemplate();
    return NextResponse.json({ template });
  } catch (error) {
    console.error('Error getting import template:', error);
    return NextResponse.json(
      { error: 'Failed to get template', message: (error as Error).message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/historical/import
 * Import historical stand data from Excel file
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
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
    
    // Check permission - need UPLOAD_LEDGER or MANAGE_ESTATES
    if (!hasPermission(user.role, userPermissions, 'UPLOAD_LEDGER') &&
        !hasPermission(user.role, userPermissions, 'MANAGE_ESTATES')) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }
    
    // Get IP address
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      'unknown';
    
    // Parse multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    // Validate file type
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
    ];
    
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an Excel file (.xlsx or .xls)' },
        { status: 400 }
      );
    }
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Import data
    const result = await importHistoricalStands(buffer, user.id, ipAddress);
    
    return NextResponse.json({
      success: true,
      result,
      message: `Imported ${result.standsCreated} new stands and updated ${result.standsUpdated} existing stands`,
    });
  } catch (error) {
    console.error('Error importing historical data:', error);
    return NextResponse.json(
      { error: 'Failed to import data', message: (error as Error).message },
      { status: 500 }
    );
  }
}
