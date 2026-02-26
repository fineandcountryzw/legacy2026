import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDb } from "@/lib/db";

/**
 * Repair misclassified transactions
 * 
 * LEFT Side (Columns B-E in original file) = CUSTOMER PAYMENTS
 * - Deposit, Monthly Installment, Client-paid Admin/Legal fees
 * 
 * RIGHT Side (Columns F-I in original file) = DEDUCTIONS  
 * - F&C Commission, AOS, Developer payouts, Realtor, Legal fees
 */

// Customer Payment patterns (LEFT side)
const CUSTOMER_PAYMENT_PATTERNS = [
  { pattern: /deposit/i, category: 'CLIENT_DEPOSIT', side: 'RECEIPT' },
  { pattern: /installment|installments|montly/i, category: 'CLIENT_INSTALLMENT', side: 'RECEIPT' },
  { pattern: /administration.*f&c|f&c.*administration/i, category: 'FC_ADMIN_FEE', side: 'RECEIPT' },
  { pattern: /legal.*fee|legal fees/i, category: 'LEGAL_FEE', side: 'RECEIPT' },
];

// Deduction patterns (RIGHT side)
const DEDUCTION_PATTERNS = [
  { pattern: /commission.*f&c|f&c.*commission/i, category: 'FC_COMMISSION', side: 'PAYMENT', recipient: 'Fine & Country' },
  { pattern: /administration.*f&c|f&c.*administration/i, category: 'FC_ADMIN_FEE', side: 'PAYMENT', recipient: 'Fine & Country' },
  { pattern: /aos.*developer|developer.*aos/i, category: 'DEVELOPER_PAYMENT', side: 'PAYMENT', recipient: 'AOS Developer' },
  { pattern: /aos(?!.*developer)/i, category: 'AOS_FEE', side: 'PAYMENT', recipient: 'AOS' },
  { pattern: /lakecity.*developer|developer.*lakecity/i, category: 'DEVELOPER_PAYMENT', side: 'PAYMENT', recipient: 'Lakecity Developers' },
  { pattern: /highrange.*developer|developer.*highrange/i, category: 'DEVELOPER_PAYMENT', side: 'PAYMENT', recipient: 'Highrange Developers' },
  { pattern: /southlands.*developer|developer.*southlands/i, category: 'DEVELOPER_PAYMENT', side: 'PAYMENT', recipient: 'Southlands Developers' },
  { pattern: /lomlight.*developer|developer.*lomlight/i, category: 'DEVELOPER_PAYMENT', side: 'PAYMENT', recipient: 'Lomlight Developers' },
  { pattern: /developer/i, category: 'DEVELOPER_PAYMENT', side: 'PAYMENT', recipient: 'Developer' },
  { pattern: /realtor/i, category: 'REALTOR_PAYMENT', side: 'PAYMENT', recipient: 'Realtor' },
  { pattern: /legal.*fee|legal fees/i, category: 'LEGAL_FEE', side: 'PAYMENT', recipient: 'Legal/Lawyer' },
];

function classifyTransaction(description: string): { category: string; side: string; recipient?: string } | null {
  const desc = description.toLowerCase();
  
  // Check deduction patterns first (RIGHT side)
  for (const rule of DEDUCTION_PATTERNS) {
    if (rule.pattern.test(desc)) {
      return { category: rule.category, side: rule.side, recipient: rule.recipient };
    }
  }
  
  // Check customer payment patterns (LEFT side)
  for (const rule of CUSTOMER_PAYMENT_PATTERNS) {
    if (rule.pattern.test(desc)) {
      return { category: rule.category, side: rule.side };
    }
  }
  
  return null;
}

// POST /api/admin/repair-transactions - Repair misclassified transactions
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sql = getDb();
    
    const body = await request.json();
    const { dryRun = true, uploadId, standId } = body;
    
    // Get all transactions that might need reclassification
    const transactions = await sql`
      SELECT 
        id, 
        description, 
        category, 
        side,
        amount,
        reference,
        transaction_date,
        sheet_name,
        upload_id,
        stand_id
      FROM payment_transactions
      WHERE user_id = ${userId}
        AND (category IN ('UNKNOWN', 'FC_ADMIN_FEE', 'LEGAL_FEE', 'AOS_FEE') 
             OR side IS NULL
             OR (category = 'CLIENT_INSTALLMENT' AND description ILIKE '%admin%')
             OR (category = 'DEVELOPER_PAYMENT' AND description ILIKE '%deposit%')
             OR (side = 'RECEIPT' AND description ILIKE '%commission%')
             OR (side = 'RECEIPT' AND description ILIKE '%aos%developer%')
        )
      ORDER BY transaction_date DESC
      LIMIT 1000
    `;
    
    const repairs: Array<{
      id: string;
      description: string;
      oldCategory: string;
      newCategory: string;
      oldSide: string;
      newSide: string;
      amount: number;
      reason: string;
    }> = [];
    
    const errors: string[] = [];
    
    for (const tx of transactions) {
      try {
        const classification = classifyTransaction(tx.description);
        
        if (!classification) {
          continue; // Skip if can't classify
        }
        
        // Check if reclassification is needed
        const needsUpdate = 
          tx.category !== classification.category ||
          tx.side !== classification.side;
        
        if (needsUpdate) {
          const reason = getReason(tx.description, tx.category, classification.category, classification.side);
          
          repairs.push({
            id: tx.id,
            description: tx.description,
            oldCategory: tx.category,
            newCategory: classification.category,
            oldSide: tx.side,
            newSide: classification.side,
            amount: parseFloat(tx.amount),
            reason
          });
          
          if (!dryRun) {
            await sql`
              UPDATE payment_transactions
              SET 
                category = ${classification.category},
                side = ${classification.side},
                updated_at = NOW()
              WHERE id = ${tx.id}
            `;
          }
        }
      } catch (err) {
        errors.push(`Error processing transaction ${tx.id}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }
    
    // Also fix transactions with obvious misclassification patterns
    const additionalFixes = await fixObviousMisclassifications(sql, userId, dryRun);
    repairs.push(...additionalFixes);
    
    return NextResponse.json({
      success: true,
      dryRun,
      summary: {
        totalScanned: transactions.length,
        repairsNeeded: repairs.length,
        repairsApplied: dryRun ? 0 : repairs.length,
        errors: errors.length
      },
      repairs: repairs.slice(0, 100), // Limit details in response
      errors: errors.slice(0, 20)
    });
    
  } catch (error) {
    console.error("Repair error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Repair failed"
    }, { status: 500 });
  }
}

// Fix obvious misclassifications based on patterns
async function fixObviousMisclassifications(sql: any, userId: string, dryRun: boolean) {
  const repairs: Array<{
    id: string;
    description: string;
    oldCategory: string;
    newCategory: string;
    oldSide: string;
    newSide: string;
    amount: number;
    reason: string;
  }> = [];
  
  // Pattern 1: Commission stored as RECEIPT (should be PAYMENT)
  const commissionReceipts = await sql`
    SELECT id, description, category, side, amount
    FROM payment_transactions
    WHERE user_id = ${userId}
      AND side = 'RECEIPT'
      AND (description ILIKE '%commission%' OR description ILIKE '%f&c commission%')
  `;
  
  for (const tx of commissionReceipts) {
    repairs.push({
      id: tx.id,
      description: tx.description,
      oldCategory: tx.category,
      newCategory: 'FC_COMMISSION',
      oldSide: tx.side,
      newSide: 'PAYMENT',
      amount: parseFloat(tx.amount),
      reason: 'Commission is a deductible (PAYMENT), not customer payment (RECEIPT)'
    });
    
    if (!dryRun) {
      await sql`
        UPDATE payment_transactions
        SET category = 'FC_COMMISSION', side = 'PAYMENT', updated_at = NOW()
        WHERE id = ${tx.id}
      `;
    }
  }
  
  // Pattern 2: Developer payment stored as RECEIPT
  const developerReceipts = await sql`
    SELECT id, description, category, side, amount
    FROM payment_transactions
    WHERE user_id = ${userId}
      AND side = 'RECEIPT'
      AND (description ILIKE '%developer%' OR description ILIKE '%lakecity%' OR description ILIKE '%highrange%')
  `;
  
  for (const tx of developerReceipts) {
    repairs.push({
      id: tx.id,
      description: tx.description,
      oldCategory: tx.category,
      newCategory: 'DEVELOPER_PAYMENT',
      oldSide: tx.side,
      newSide: 'PAYMENT',
      amount: parseFloat(tx.amount),
      reason: 'Developer payout is a deductible (PAYMENT), not customer payment (RECEIPT)'
    });
    
    if (!dryRun) {
      await sql`
        UPDATE payment_transactions
        SET category = 'DEVELOPER_PAYMENT', side = 'PAYMENT', updated_at = NOW()
        WHERE id = ${tx.id}
      `;
    }
  }
  
  // Pattern 3: AOS + Developer combo stored incorrectly
  const aosDeveloperErrors = await sql`
    SELECT id, description, category, side, amount
    FROM payment_transactions
    WHERE user_id = ${userId}
      AND (description ILIKE '%aos%developer%' OR description ILIKE '%aos%lakecity%')
      AND (side = 'RECEIPT' OR category != 'DEVELOPER_PAYMENT')
  `;
  
  for (const tx of aosDeveloperErrors) {
    repairs.push({
      id: tx.id,
      description: tx.description,
      oldCategory: tx.category,
      newCategory: 'DEVELOPER_PAYMENT',
      oldSide: tx.side,
      newSide: 'PAYMENT',
      amount: parseFloat(tx.amount),
      reason: 'AOS Developer payment is a deductible (PAYMENT), categorized as developer payment'
    });
    
    if (!dryRun) {
      await sql`
        UPDATE payment_transactions
        SET category = 'DEVELOPER_PAYMENT', side = 'PAYMENT', updated_at = NOW()
        WHERE id = ${tx.id}
      `;
    }
  }
  
  // Pattern 4: Realtor payments stored as RECEIPT
  const realtorReceipts = await sql`
    SELECT id, description, category, side, amount
    FROM payment_transactions
    WHERE user_id = ${userId}
      AND side = 'RECEIPT'
      AND description ILIKE '%realtor%'
  `;
  
  for (const tx of realtorReceipts) {
    repairs.push({
      id: tx.id,
      description: tx.description,
      oldCategory: tx.category,
      newCategory: 'REALTOR_PAYMENT',
      oldSide: tx.side,
      newSide: 'PAYMENT',
      amount: parseFloat(tx.amount),
      reason: 'Realtor payment is a deductible (PAYMENT), not customer payment (RECEIPT)'
    });
    
    if (!dryRun) {
      await sql`
        UPDATE payment_transactions
        SET category = 'REALTOR_PAYMENT', side = 'PAYMENT', updated_at = NOW()
        WHERE id = ${tx.id}
      `;
    }
  }
  
  return repairs;
}

function getReason(description: string, oldCat: string, newCat: string, newSide: string): string {
  const desc = description.toLowerCase();
  
  if (desc.includes('commission') && newSide === 'PAYMENT') {
    return 'F&C Commission is a deductible paid to Fine & Country (RIGHT side)';
  }
  if (desc.includes('developer') && newSide === 'PAYMENT') {
    return 'Developer payment is money OUT to developer (RIGHT side)';
  }
  if (desc.includes('realtor') && newSide === 'PAYMENT') {
    return 'Realtor payment is money OUT to realtor (RIGHT side)';
  }
  if (desc.includes('deposit') && newSide === 'RECEIPT') {
    return 'Deposit is money IN from customer (LEFT side)';
  }
  if (desc.includes('installment') && newSide === 'RECEIPT') {
    return 'Installment is money IN from customer (LEFT side)';
  }
  if (desc.includes('aos') && newSide === 'PAYMENT') {
    return 'AOS fee is a deductible (RIGHT side)';
  }
  
  return `Reclassified from ${oldCat} to ${newCat} (${newSide})`;
}

// GET /api/admin/repair-transactions - Get repair status/summary
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sql = getDb();
    
    // Count potentially misclassified transactions
    const suspiciousCounts = await sql`
      SELECT 
        COUNT(*) as total_suspicious,
        COUNT(*) FILTER (WHERE side = 'RECEIPT' AND description ILIKE '%commission%') as commission_as_receipt,
        COUNT(*) FILTER (WHERE side = 'RECEIPT' AND description ILIKE '%developer%') as developer_as_receipt,
        COUNT(*) FILTER (WHERE side = 'RECEIPT' AND description ILIKE '%realtor%') as realtor_as_receipt,
        COUNT(*) FILTER (WHERE side = 'PAYMENT' AND description ILIKE '%deposit%') as deposit_as_payment,
        COUNT(*) FILTER (WHERE category = 'UNKNOWN') as unknown_category
      FROM payment_transactions
      WHERE user_id = ${userId}
    `;
    
    return NextResponse.json({
      summary: suspiciousCounts[0],
      message: 'Use POST endpoint with {"dryRun": true} to preview repairs, {"dryRun": false} to apply fixes'
    });
    
  } catch (error) {
    console.error("Repair status error:", error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to get repair status"
    }, { status: 500 });
  }
}
