// =====================================================
// AI Analysis Service - Groq AI Integration
// Lakecity Accounting Suite
// =====================================================

import Groq from 'groq';

// Initialize Groq client
function getGroqClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not configured. Please add it to your .env.local file.');
  }
  
  return new Groq({
    apiKey,
  });
}

// =====================================================
// TYPES
// =====================================================

export interface CategorizationResult {
  originalDescription: string;
  category: string;
  confidence: number;
  reasoning: string;
}

export interface ValidationError {
  type: 'amount_anomaly' | 'missing_data' | 'date_issue' | 'duplicate' | 'category_conflict';
  severity: 'error' | 'warning' | 'info';
  message: string;
  row?: number;
  field?: string;
  suggestedValue?: string;
}

export interface AnalysisResult {
  categorizations: CategorizationResult[];
  validationErrors: ValidationError[];
  summary: {
    totalTransactions: number;
    categoriesUsed: string[];
    errorsFound: number;
    warningsFound: number;
  };
}

// =====================================================
// SYSTEM PROMPTS
// =====================================================

const CATEGORIZATION_SYSTEM_PROMPT = `You are an expert financial data analyst specializing in property/stand sales accounting.
Your task is to categorize financial transaction descriptions into the correct category.

CUSTOMER PAYMENT categories (money IN from clients):
- CUSTOMER_DEPOSIT: Initial deposits, booking fees, reservation fees
- CUSTOMER_INSTALLMENT: Monthly installments, payments, montly payments
- CUSTOMER_ADMIN_FEE: Administration fees paid by client to Fine & Country
- CUSTOMER_LEGAL_FEE: Legal fees paid by client

DEDUCTIBLE categories (money OUT - deductions from payments):
- DEDUCTION_COMMISSION: Commission paid to Fine & Country
- DEDUCTION_ADMIN_FEE: Administration fee deducted
- DEDUCTION_AOS: AOS (Owner's Association) fees deducted
- DEDUCTION_DEVELOPER: Payment to developer (Lakecity, Highrange, Southlands, Lomlight)
- DEDUCTION_REALTOR: Realtor commission or fee
- DEDUCTION_LEGAL_FEE: Legal fees deducted

IMPORTANT:
- Only return a valid JSON object, no additional text
- Use exact category names from the list above
- Base your decision on keywords in the description
- Consider the context: left side = customer payment, right side = deductible

Return JSON in this format:
{
  "category": "CATEGORY_NAME",
  "confidence": 0.95,
  "reasoning": "Short explanation of why this category was chosen"
}`;

const VALIDATION_SYSTEM_PROMPT = `You are an expert financial data validator for property/stand sales accounting.
Your task is to analyze financial transaction data and identify potential errors, anomalies, or issues.

Check for:
1. AMOUNT ANOMALIES: Unusually large or small amounts compared to typical transactions
2. MISSING DATA: Empty required fields (dates, amounts, stand numbers)
3. DATE ISSUES: Future dates, invalid date formats
4. DUPLICATES: Potential duplicate transactions (same amount, date, description)
5. CATEGORY CONFLICTS: Transactions that seem miscategorized

For each error found, return:
{
  "type": "amount_anomaly" | "missing_data" | "date_issue" | "duplicate" | "category_conflict",
  "severity": "error" | "warning" | "info",
  "message": "Description of the issue",
  "row": row_number,
  "field": "field_name",
  "suggestedValue": "if applicable"
}

Return a JSON array of errors found. If no errors, return an empty array [].`;

// =====================================================
// CATEGORIZATION FUNCTIONS
// =====================================================

/**
 * Categorize a single transaction description using Groq AI
 */
export async function categorizeTransaction(
  description: string,
  side: 'CUSTOMER_PAYMENT' | 'DEDUCTIBLE'
): Promise<CategorizationResult> {
  const client = getGroqClient();
  
  const userPrompt = `Description: "${description}"
Side: ${side === 'CUSTOMER_PAYMENT' ? 'Customer Payment (Left side - money IN)' : 'Deductible (Right side - money OUT)'}

Categorize this transaction:`;

  try {
    const completion = await client.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages: [
        { role: 'system', content: CATEGORIZATION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
      max_tokens: 500,
    });

    const response = completion.choices[0]?.message?.content;
    
    if (!response) {
      return {
        originalDescription: description,
        category: 'UNKNOWN',
        confidence: 0,
        reasoning: 'No response from AI',
      };
    }

    const parsed = JSON.parse(response);
    
    return {
      originalDescription: description,
      category: parsed.category || 'UNKNOWN',
      confidence: parsed.confidence || 0,
      reasoning: parsed.reasoning || 'No reasoning provided',
    };
  } catch (error) {
    console.error('Error categorizing transaction:', error);
    return {
      originalDescription: description,
      category: 'UNKNOWN',
      confidence: 0,
      reasoning: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Batch categorize multiple transactions
 * Processes in batches to avoid API rate limits
 */
export async function categorizeTransactions(
  transactions: Array<{ description: string; side: 'CUSTOMER_PAYMENT' | 'DEDUCTIBLE' }>
): Promise<CategorizationResult[]> {
  const results: CategorizationResult[] = [];
  
  // Process in batches of 10 to avoid rate limits
  const batchSize = 10;
  
  for (let i = 0; i < transactions.length; i += batchSize) {
    const batch = transactions.slice(i, i + batchSize);
    
    // Process each in the batch
    const batchPromises = batch.map(tx => categorizeTransaction(tx.description, tx.side));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    // Small delay between batches to respect rate limits
    if (i + batchSize < transactions.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  return results;
}

// =====================================================
// VALIDATION FUNCTIONS
// =====================================================

/**
 * Validate transaction data using Groq AI
 */
export async function validateTransactions(
  transactions: Array<{
    rowIndex: number;
    date?: string;
    amount?: number;
    description?: string;
    standNumber?: string;
    category?: string;
  }>
): Promise<ValidationError[]> {
  const client = getGroqClient();
  
  // Prepare data summary for AI
  const transactionSummary = transactions.map(tx => ({
    row: tx.rowIndex + 1,
    date: tx.date || 'missing',
    amount: tx.amount ?? 'missing',
    description: tx.description?.substring(0, 100) || 'missing',
    standNumber: tx.standNumber || 'missing',
    category: tx.category || 'unknown',
  }));

  const userPrompt = `Analyze these transactions for errors:
${JSON.stringify(transactionSummary, null, 2)}

Find and report any validation issues:`;

  try {
    const completion = await client.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages: [
        { role: 'system', content: VALIDATION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1,
      response_format: { type: 'json_object' },
      max_tokens: 2000,
    });

    const response = completion.choices[0]?.message?.content;
    
    if (!response) {
      return [];
    }

    const parsed = JSON.parse(response);
    
    // Handle both array and object with errors property
    if (Array.isArray(parsed)) {
      return parsed;
    } else if (parsed.errors && Array.isArray(parsed.errors)) {
      return parsed.errors;
    }
    
    return [];
  } catch (error) {
    console.error('Error validating transactions:', error);
    return [{
      type: 'missing_data',
      severity: 'warning',
      message: `Validation check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }];
  }
}

// =====================================================
// COMBINED ANALYSIS
// =====================================================

/**
 * Perform complete AI analysis on transaction data
 */
export async function analyzeTransactions(
  transactions: Array<{
    description: string;
    side: 'CUSTOMER_PAYMENT' | 'DEDUCTIBLE';
    date?: string;
    amount?: number;
    standNumber?: string;
    rowIndex: number;
  }>
): Promise<AnalysisResult> {
  // Step 1: Categorize uncategorized transactions
  const uniqueDescriptions = [...new Map(
    transactions.map(tx => [tx.description, tx])
  ).values()];

  const categorizationResults = await categorizeTransactions(
    uniqueDescriptions.map(tx => ({
      description: tx.description,
      side: tx.side,
    }))
  );

  // Map results back to transactions
  const descriptionToCategory = new Map<string, CategorizationResult>();
  categorizationResults.forEach(result => {
    descriptionToCategory.set(result.originalDescription, result);
  });

  const categorizations = transactions.map(tx => {
    const result = descriptionToCategory.get(tx.description);
    return result || {
      originalDescription: tx.description,
      category: 'UNKNOWN',
      confidence: 0,
      reasoning: 'Not processed',
    };
  });

  // Step 2: Validate transactions
  const validationErrors = await validateTransactions(
    transactions.map(tx => ({
      rowIndex: tx.rowIndex,
      date: tx.date,
      amount: tx.amount,
      description: tx.description,
      standNumber: tx.standNumber,
      category: descriptionToCategory.get(tx.description)?.category,
    }))
  );

  // Step 3: Build summary
  const categoriesUsed = [...new Set(categorizations.map(c => c.category))];
  const errorsFound = validationErrors.filter(e => e.severity === 'error').length;
  const warningsFound = validationErrors.filter(e => e.severity === 'warning').length;

  return {
    categorizations,
    validationErrors,
    summary: {
      totalTransactions: transactions.length,
      categoriesUsed,
      errorsFound,
      warningsFound,
    },
  };
}

// =====================================================
// HELPERS
// =====================================================

/**
 * Check if GROQ API is configured
 */
export function isGroqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY;
}

/**
 * Get configuration status for UI
 */
export function getAIConfigStatus(): { configured: boolean; message: string } {
  const apiKey = process.env.GROQ_API_KEY;
  
  if (!apiKey) {
    return {
      configured: false,
      message: 'GROQ_API_KEY is not configured. Please add it to your .env.local file.',
    };
  }
  
  if (apiKey.startsWith('your_') || apiKey.length < 10) {
    return {
      configured: false,
      message: 'GROQ_API_KEY appears to be invalid. Please check your API key.',
    };
  }
  
  return {
    configured: true,
    message: 'Groq AI is configured and ready to use.',
  };
}
