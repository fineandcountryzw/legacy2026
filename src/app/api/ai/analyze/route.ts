// =====================================================
// AI Analysis API Route
// Lakecity Accounting Suite
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { analyzeTransactions, isGroqConfigured, getAIConfigStatus } from '@/lib/ai/ai-analysis-service';
import { auth } from '@clerk/nextjs/server';

export interface AnalyzeRequestBody {
  transactions: Array<{
    description: string;
    side: 'CUSTOMER_PAYMENT' | 'DEDUCTIBLE';
    date?: string;
    amount?: number;
    standNumber?: string;
    rowIndex: number;
  }>;
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if Groq is configured
    if (!isGroqConfigured()) {
      const status = getAIConfigStatus();
      return NextResponse.json(
        { error: 'AI not configured', message: status.message },
        { status: 503 }
      );
    }

    // Parse request body
    let body: AnalyzeRequestBody;
    
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    // Validate transactions array
    if (!body.transactions || !Array.isArray(body.transactions)) {
      return NextResponse.json(
        { error: 'transactions array is required' },
        { status: 400 }
      );
    }

    // Limit transaction count to prevent abuse
    const MAX_TRANSACTIONS = 500;
    if (body.transactions.length > MAX_TRANSACTIONS) {
      return NextResponse.json(
        { error: `Too many transactions. Maximum is ${MAX_TRANSACTIONS}.` },
        { status: 400 }
      );
    }

    // Validate each transaction has required fields
    for (let i = 0; i < body.transactions.length; i++) {
      const tx = body.transactions[i];
      if (!tx.description || !tx.side) {
        return NextResponse.json(
          { error: `Transaction at index ${i} is missing required fields (description, side)` },
          { status: 400 }
        );
      }
      if (!['CUSTOMER_PAYMENT', 'DEDUCTIBLE'].includes(tx.side)) {
        return NextResponse.json(
          { error: `Transaction at index ${i} has invalid side. Must be 'CUSTOMER_PAYMENT' or 'DEDUCTIBLE'` },
          { status: 400 }
        );
      }
    }

    // Perform AI analysis
    const result = await analyzeTransactions(body.transactions);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('AI Analysis error:', error);
    
    return NextResponse.json(
      { 
        error: 'Analysis failed', 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Return configuration status
  const status = getAIConfigStatus();
  
  return NextResponse.json({
    configured: status.configured,
    message: status.message,
    features: {
      categorization: status.configured,
      validation: status.configured,
    },
  });
}
