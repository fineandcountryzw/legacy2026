"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, Download, Printer, Search, Loader2, Calendar, 
  Filter, Mail, Building2, User, DollarSign, TrendingUp,
  TrendingDown, Receipt, ChevronLeft, ChevronRight, X,
  FileSpreadsheet, CreditCard, ArrowUpRight, ArrowDownRight,
  CheckCircle2, Clock, AlertCircle, Wallet
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { format, parseISO, isWithinInterval, startOfMonth, endOfMonth } from "date-fns";

interface BrandProfile {
  id: string;
  companyName: string;
  logoUrl?: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  contactDetails: {
    address?: string;
    email?: string;
    website?: string;
    phone?: string;
  };
}

interface Stand {
  id: string;
  standInventoryId?: string;
  standNumber: string;
  developmentName: string;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  totalPaid?: number;
  balance?: number;
  agreedPrice?: number;
  isStandalone?: boolean;
  currency?: string;
  status?: string;
}

interface StandDetails extends Stand {
  totalReceipts?: number;
  totalPayments?: number;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  reference?: string;
  category?: string;
  side?: 'RECEIPT' | 'PAYMENT';
}

interface CategorySummary {
  category: string;
  receipts: number;
  payments: number;
  count: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  'CLIENT_DEPOSIT': 'bg-emerald-100 text-emerald-800 border-emerald-200',
  'CLIENT_INSTALLMENT': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'FC_COMMISSION': 'bg-blue-100 text-blue-800 border-blue-200',
  'FC_ADMIN_FEE': 'bg-blue-50 text-blue-700 border-blue-200',
  'DEVELOPER_PAYMENT': 'bg-orange-100 text-orange-800 border-orange-200',
  'REALTOR_PAYMENT': 'bg-purple-100 text-purple-800 border-purple-200',
  'LEGAL_FEE': 'bg-red-100 text-red-800 border-red-200',
  'AOS_FEE': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  'UNKNOWN': 'bg-gray-100 text-gray-800 border-gray-200',
};

const CATEGORY_LABELS: Record<string, string> = {
  'CLIENT_DEPOSIT': 'Deposit',
  'CLIENT_INSTALLMENT': 'Installment',
  'FC_COMMISSION': 'F&C Commission',
  'FC_ADMIN_FEE': 'Admin Fee',
  'DEVELOPER_PAYMENT': 'Developer Payment',
  'REALTOR_PAYMENT': 'Realtor Payment',
  'LEGAL_FEE': 'Legal Fee',
  'AOS_FEE': 'AOS Fee',
  'UNKNOWN': 'Uncategorized',
};

// Categories visible to clients on their statements
const CLIENT_VISIBLE_CATEGORIES = [
  'CLIENT_DEPOSIT',
  'CLIENT_INSTALLMENT', 
  'AOS_FEE',
  'LEGAL_FEE',
  'FC_ADMIN_FEE', // Admin fee charged to client
];

// Sanitize description for client view - returns category label only
function sanitizeDescription(description: string, category?: string): string {
  // Return category label as the description for clean client statements
  // This hides all internal/commission-related descriptions
  const defaults: Record<string, string> = {
    'CLIENT_DEPOSIT': 'Deposit Payment',
    'CLIENT_INSTALLMENT': 'Installment Payment',
    'AOS_FEE': 'AOS Fee',
    'LEGAL_FEE': 'Legal Fee',
    'FC_ADMIN_FEE': 'Administration Fee',
  };
  return defaults[category || ''] || 'Payment';
}

export default function StatementsPage() {
  // State
  const [stands, setStands] = useState<Stand[]>([]);
  const [selectedStand, setSelectedStand] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingTx, setLoadingTx] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  const statementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchStands();
    fetchBrandProfile();
  }, []);

  const fetchBrandProfile = async () => {
    try {
      const res = await fetch("/api/brand-profile");
      if (res.ok) {
        const data = await res.json();
        setBrandProfile(data);
      }
    } catch (err) {
      console.error("Failed to fetch brand profile:", err);
    }
  };

  useEffect(() => {
    if (selectedStand) {
      fetchTransactions(selectedStand);
    } else {
      setTransactions([]);
      setFilteredTransactions([]);
    }
  }, [selectedStand]);

  useEffect(() => {
    // Apply filters - only show client-visible transactions
    let filtered = transactions.filter(tx => 
      CLIENT_VISIBLE_CATEGORIES.includes(tx.category || 'UNKNOWN')
    );
    
    // Date range filter
    if (dateRange.start || dateRange.end) {
      filtered = filtered.filter(tx => {
        const txDate = parseISO(tx.date);
        const start = dateRange.start ? parseISO(dateRange.start) : new Date('1900-01-01');
        const end = dateRange.end ? parseISO(dateRange.end) : new Date('2100-12-31');
        return isWithinInterval(txDate, { start, end });
      });
    }
    
    // Category filter
    if (selectedCategory !== "all") {
      filtered = filtered.filter(tx => tx.category === selectedCategory);
    }
    
    setFilteredTransactions(filtered);
    setCurrentPage(1);
  }, [transactions, dateRange, selectedCategory]);

  const fetchStands = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/stands");
      if (!res.ok) throw new Error("Failed to fetch stands");
      const data = await res.json();
      setStands(data.stands || []);
    } catch (err) {
      toast.error("Failed to load stands");
    } finally {
      setLoading(false);
    }
  };

  const fetchTransactions = async (standId: string) => {
    try {
      setLoadingTx(true);
      const standData = stands.find(s => s.id === standId);

      let url: string;
      if (standData?.isStandalone && standData?.standInventoryId) {
        url = `/api/transactions?standInventoryId=${standData.standInventoryId}`;
      } else {
        url = `/api/transactions?standId=${standId}`;
      }

      const res = await fetch(url);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch transactions");
      }
      const data = await res.json();
      
      // Sort by date ascending for statement
      const sorted = (data.transactions || []).sort((a: Transaction, b: Transaction) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );
      
      setTransactions(sorted);
      setFilteredTransactions(sorted);
    } catch (err) {
      console.error("[Statements] Error fetching transactions:", err);
      toast.error("Failed to load transactions");
    } finally {
      setLoadingTx(false);
    }
  };

  // Computed values
  const standData = selectedStand ? stands.find(s => s.id === selectedStand) : null;
  
  const filteredStands = useMemo(() => {
    if (!searchQuery) return stands;
    const query = searchQuery.toLowerCase();
    return stands.filter(s => 
      s.standNumber?.toLowerCase().includes(query) ||
      s.developmentName?.toLowerCase().includes(query) ||
      s.clientName?.toLowerCase().includes(query)
    );
  }, [stands, searchQuery]);

  const categorySummary = useMemo(() => {
    const summary: Record<string, CategorySummary> = {};
    
    // Only show client-visible categories
    const clientTransactions = filteredTransactions.filter(tx => 
      CLIENT_VISIBLE_CATEGORIES.includes(tx.category || 'UNKNOWN')
    );
    
    clientTransactions.forEach(tx => {
      const cat = tx.category || 'UNKNOWN';
      if (!summary[cat]) {
        summary[cat] = { category: cat, receipts: 0, payments: 0, count: 0 };
      }
      // For client statements, we show what they paid (receipts)
      if (tx.side === 'RECEIPT') {
        summary[cat].receipts += tx.amount;
      }
      summary[cat].count++;
    });
    
    return Object.values(summary).sort((a, b) => b.receipts - a.receipts);
  }, [filteredTransactions]);

  const totals = useMemo(() => {
    // Only count client-visible categories
    const clientTransactions = filteredTransactions.filter(tx => 
      CLIENT_VISIBLE_CATEGORIES.includes(tx.category || 'UNKNOWN')
    );
    
    // For client statements, we only show what they paid (receipts)
    const totalPaid = clientTransactions
      .filter(tx => tx.side === 'RECEIPT')
      .reduce((sum, tx) => sum + tx.amount, 0);
    
    // Use agreedPrice from stand data (which now comes from development base price if not set on stand)
    const agreedPrice = standData?.agreedPrice || 0;
    const remainingBalance = Math.max(0, agreedPrice - totalPaid);
    const paymentProgress = agreedPrice > 0 ? Math.min(100, Math.round((totalPaid / agreedPrice) * 100)) : 0;
      
    return { 
      totalPaid, 
      itemCount: clientTransactions.length,
      agreedPrice,
      remainingBalance,
      paymentProgress
    };
  }, [filteredTransactions, standData]);

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Calculate running balance for each transaction
  const transactionsWithBalance = useMemo(() => {
    let runningBalance = 0;
    return paginatedTransactions.map(tx => {
      if (tx.side === 'RECEIPT') {
        runningBalance += tx.amount;
      } else {
        runningBalance -= tx.amount;
      }
      return { ...tx, runningBalance };
    });
  }, [paginatedTransactions]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!statementRef.current) return;
    
    setGeneratingPdf(true);
    try {
      // Dynamic import to reduce initial bundle
      const [{ jsPDF }, autoTable] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable").then(m => m.default),
      ]);
      
      const doc = new jsPDF();
      const stand = standData;
      const brand = brandProfile;
      
      // Brand colors (convert hex to RGB)
      const primaryColor = brand?.primaryColor ? hexToRgb(brand.primaryColor) : { r: 15, g: 23, b: 42 };
      
      // Page dimensions
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 15;
      
      // Use Arial font throughout
      doc.setFont("arial");
      
      // Helper function to add footer on each page
      const addFooter = (pageNum: number, totalPages: number) => {
        const footerY = pageHeight - 20;
        
        // Footer line
        doc.setDrawColor(226, 232, 240); // slate-200
        doc.line(margin, footerY, pageWidth - margin, footerY);
        
        // Left side - Footer text
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        doc.setFont("arial", "normal");
        doc.text(`This statement reflects all transactions up to ${format(new Date(), 'MMMM do, yyyy')}`, margin, footerY + 6);
        
        const contactEmail = brand?.contactDetails?.email || 'support@standinventory.com';
        doc.text(`Contact: ${contactEmail}`, margin, footerY + 11);
        
        if (brand?.contactDetails?.phone) {
          doc.text(`Tel: ${brand.contactDetails.phone}`, margin, footerY + 16);
        }
        
        // Center - Page number
        doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth / 2, footerY + 6, { align: 'center' });
        
        // Right side - Outstanding Balance
        doc.setTextColor(100, 100, 100);
        doc.text("Balance Due:", pageWidth - margin - 50, footerY + 6);
        
        doc.setFontSize(11);
        doc.setFont("arial", "bold");
        const balanceValueText = `$${totals.remainingBalance.toLocaleString()}`;
        const balanceTextColor = totals.remainingBalance > 0 ? [225, 29, 72] : [primaryColor.r, primaryColor.g, primaryColor.b];
        doc.setTextColor(balanceTextColor[0], balanceTextColor[1], balanceTextColor[2]);
        doc.text(balanceValueText, pageWidth - margin, footerY + 6, { align: 'right' });
      };
      
      // === PROFESSIONAL HEADER WITH BRAND BAR ===
      let currentY = 12;
      
      // Brand color bar at top
      doc.setFillColor(primaryColor.r, primaryColor.g, primaryColor.b);
      doc.rect(0, 0, pageWidth, 6, 'F');
      
      currentY = 18;
      
      // Left side - Document Title
      doc.setTextColor(15, 23, 42); // slate-900
      doc.setFontSize(18);
      doc.setFont("arial", "bold");
      doc.text("STATEMENT OF ACCOUNT", margin, currentY);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100); // slate-500
      doc.setFont("arial", "normal");
      doc.text(`Generated: ${format(new Date(), 'MMMM do, yyyy')}`, margin, currentY + 7);
      
      // Right side - Logo and Company info
      const companyName = brand?.companyName || 'Stands Recon F&C';
      let logoY = currentY - 6;
      let contactY = currentY + 2;
      
      // Add logo if available
      if (brand?.logoUrl) {
        try {
          const imgResponse = await fetch(brand.logoUrl);
          const imgBlob = await imgResponse.blob();
          const reader = new FileReader();
          const imgData = await new Promise<string>((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(imgBlob);
          });
          
          const imgFormat = imgData.includes('image/png') ? 'PNG' : 'JPEG';
          
          const img = new Image();
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = imgData;
          });
          
          // Smaller logo for compact header
          const maxLogoWidth = 35;
          const maxLogoHeight = 14;
          const aspectRatio = img.width / img.height;
          
          let logoWidth = maxLogoWidth;
          let logoHeight = logoWidth / aspectRatio;
          
          if (logoHeight > maxLogoHeight) {
            logoHeight = maxLogoHeight;
            logoWidth = logoHeight * aspectRatio;
          }
          
          const logoX = pageWidth - margin - logoWidth;
          doc.addImage(imgData, imgFormat, logoX, logoY, logoWidth, logoHeight);
          contactY = logoY + logoHeight + 3;
        } catch (imgErr) {
          console.error("Failed to load logo:", imgErr);
          doc.setFontSize(11);
          doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
          doc.setFont("arial", "bold");
          const nameWidth = doc.getTextWidth(companyName);
          doc.text(companyName, pageWidth - margin - nameWidth, logoY + 6);
          contactY = logoY + 10;
        }
      } else {
        doc.setFontSize(11);
        doc.setTextColor(primaryColor.r, primaryColor.g, primaryColor.b);
        doc.setFont("arial", "bold");
        const nameWidth = doc.getTextWidth(companyName);
        doc.text(companyName, pageWidth - margin - nameWidth, logoY + 6);
        contactY = logoY + 10;
      }
      
      // Company contact info (compact)
      doc.setFontSize(7);
      doc.setTextColor(100, 100, 100);
      doc.setFont("arial", "normal");
      
      const address = brand?.contactDetails?.address || 'Harare, Zimbabwe';
      const addressWidth = doc.getTextWidth(address);
      doc.text(address, pageWidth - margin - addressWidth, contactY);
      
      if (brand?.contactDetails?.email) {
        const emailWidth = doc.getTextWidth(brand.contactDetails.email);
        doc.text(brand.contactDetails.email, pageWidth - margin - emailWidth, contactY + 4);
      }
      
      if (brand?.contactDetails?.phone) {
        const phoneWidth = doc.getTextWidth(brand.contactDetails.phone);
        doc.text(brand.contactDetails.phone, pageWidth - margin - phoneWidth, contactY + 8);
      }
      
      // === CLIENT & STAND INFO SECTION (Compact) ===
      currentY = 42;
      const boxHeight = 32;
      
      // Gray background box
      doc.setFillColor(248, 250, 252); // slate-50
      doc.roundedRect(margin, currentY, pageWidth - margin * 2, boxHeight, 3, 3, 'F');
      
      // Two column layout inside box
      const colWidth = (pageWidth - margin * 2 - 20) / 2;
      const contentY = currentY + 6;
      
      // Left column - Bill To (with enhanced client details)
      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFontSize(7);
      doc.setFont("arial", "bold");
      doc.text("BILL TO", margin + 8, contentY);
      
      doc.setTextColor(15, 23, 42); // slate-900
      doc.setFontSize(10);
      doc.setFont("arial", "bold");
      doc.text(stand?.clientName || "Client (Unassigned)", margin + 8, contentY + 8);
      
      doc.setFont("arial", "normal");
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100); // slate-500
      
      let clientDetailY = contentY + 15;
      if (stand?.clientPhone) {
        doc.text(`Phone: ${stand.clientPhone}`, margin + 8, clientDetailY);
        clientDetailY += 5;
      }
      if (stand?.clientEmail) {
        doc.text(`Email: ${stand.clientEmail}`, margin + 8, clientDetailY);
      }
      
      // Right column - Statement Details
      const rightColX = margin + 15 + colWidth;
      doc.setTextColor(148, 163, 184); // slate-400
      doc.setFontSize(7);
      doc.setFont("arial", "bold");
      doc.text("STATEMENT DETAILS", rightColX, contentY);
      
      doc.setTextColor(100, 100, 100); // slate-500
      doc.setFont("arial", "normal");
      doc.setFontSize(8);
      doc.text(`Stand: ${stand?.standNumber}`, rightColX, contentY + 8);
      doc.text(`Development: ${stand?.developmentName || 'Unassigned'}`, rightColX, contentY + 13);
      doc.text(`Currency: ${stand?.currency || 'USD'}`, rightColX, contentY + 18);
      
      // === COMPACT SUMMARY BOXES ===
      currentY = 78;
      const boxWidth = (pageWidth - margin * 2 - 24) / 4;
      const summaryBoxHeight = 22;
      
      // Helper to draw small KPI box
      const drawKpiBox = (x: number, y: number, width: number, height: number, 
                          bgColor: number[], borderColor: number[], 
                          label: string, labelColor: number[],
                          value: string, valueColor: number[]) => {
        doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
        doc.setDrawColor(borderColor[0], borderColor[1], borderColor[2]);
        doc.roundedRect(x, y, width, height, 2, 2, 'FD');
        
        doc.setTextColor(labelColor[0], labelColor[1], labelColor[2]);
        doc.setFontSize(6);
        doc.setFont("arial", "normal");
        doc.text(label.toUpperCase(), x + width / 2, y + 6, { align: 'center' });
        
        doc.setTextColor(valueColor[0], valueColor[1], valueColor[2]);
        doc.setFontSize(10);
        doc.setFont("arial", "bold");
        doc.text(value, x + width / 2, y + 15, { align: 'center' });
      };
      
      // Box 1 - Agreed Price (Blue)
      drawKpiBox(margin, currentY, boxWidth, summaryBoxHeight,
        [239, 246, 255], [191, 219, 254],
        "Agreed Price", [37, 99, 235],
        `$${totals.agreedPrice.toLocaleString()}`, [29, 78, 216]);
      
      // Box 2 - Total Paid (Emerald)
      drawKpiBox(margin + boxWidth + 8, currentY, boxWidth, summaryBoxHeight,
        [236, 253, 245], [167, 243, 208],
        "Total Paid", [5, 150, 105],
        `$${totals.totalPaid.toLocaleString()}`, [4, 120, 87]);
      
      // Box 3 - Progress (Purple)
      drawKpiBox(margin + boxWidth * 2 + 16, currentY, boxWidth, summaryBoxHeight,
        [250, 245, 255], [233, 213, 255],
        "Progress", [147, 51, 234],
        `${totals.paymentProgress}%`, [126, 34, 206]);
      
      // Box 4 - Balance Due (Amber or Emerald)
      const isBalanceDue = totals.remainingBalance > 0;
      drawKpiBox(margin + boxWidth * 3 + 24, currentY, boxWidth, summaryBoxHeight,
        isBalanceDue ? [255, 251, 235] : [236, 253, 245],
        isBalanceDue ? [253, 230, 138] : [167, 243, 208],
        "Balance Due", isBalanceDue ? [217, 119, 6] : [5, 150, 105],
        `$${totals.remainingBalance.toLocaleString()}`, isBalanceDue ? [180, 83, 9] : [4, 120, 87]);
      
      // === TRANSACTIONS TABLE ===
      const tableStartY = currentY + summaryBoxHeight + 10;
      
      // Calculate running balance for table
      let runningBalance = 0;
      const tableData = filteredTransactions.map(tx => {
        if (tx.side === 'RECEIPT') {
          runningBalance += tx.amount;
        } else {
          runningBalance -= tx.amount;
        }
        return [
          format(parseISO(tx.date), 'MMM d, yyyy'),
          sanitizeDescription(tx.description, tx.category),
          tx.category ? CATEGORY_LABELS[tx.category] || tx.category : '-',
          `$${tx.amount.toLocaleString()}`,
          `$${runningBalance.toLocaleString()}`,
        ];
      });
      
      // Auto table with pagination support
      autoTable(doc, {
        startY: tableStartY,
        head: [['Date', 'Description', 'Type', 'Amount', 'Running Total']],
        body: tableData,
        styles: { 
          fontSize: 8,
          cellPadding: 4,
          font: "arial",
          overflow: 'linebreak',
        },
        headStyles: { 
          fillColor: [241, 245, 249],
          textColor: [71, 85, 105],
          fontStyle: 'bold',
          halign: 'left',
          fontSize: 8,
        },
        columnStyles: {
          0: { cellWidth: 25 },
          1: { cellWidth: 'auto' },
          2: { cellWidth: 30 },
          3: { cellWidth: 25, halign: 'right' },
          4: { cellWidth: 25, halign: 'right', fontStyle: 'bold' },
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252],
        },
        margin: { left: margin, right: margin, bottom: 30 },
        didDrawPage: (data: any) => {
          // Add footer on each page
          const pageCount = (doc as any).internal.getNumberOfPages();
          addFooter(data.pageNumber, pageCount);
        },
      });
      
      doc.save(`statement-${stand?.standNumber}-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success("PDF downloaded successfully");
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Failed to generate PDF");
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Helper function to convert hex to RGB
  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 15, g: 23, b: 42 }; // Default slate-900
  }

  const handleEmailStatement = async () => {
    // This would integrate with your email service
    toast.info("Email functionality coming soon", {
      description: "This will send the statement to the client's email address"
    });
  };

  const clearFilters = () => {
    setDateRange({ start: "", end: "" });
    setSelectedCategory("all");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Toaster position="top-right" richColors />
      
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Statements</h1>
          <p className="text-slate-500 mt-1">Generate and export payment statements for clients.</p>
        </div>
        {isPreviewing && standData && (
          <div className="flex gap-2 no-print">
            <Button variant="outline" size="sm" className="gap-2" onClick={handlePrint}>
              <Printer size={16} />
              Print
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={handleEmailStatement}>
              <Mail size={16} />
              Email
            </Button>
            <Button 
              size="sm" 
              className="gap-2 bg-blue-600 hover:bg-blue-700" 
              onClick={handleDownloadPdf}
              disabled={generatingPdf}
            >
              {generatingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Download PDF
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          {/* Stand Selection */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                Select Stand
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search stands..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {/* Stand List */}
              <div className="border rounded-lg max-h-[300px] overflow-y-auto">
                {filteredStands.length === 0 ? (
                  <div className="p-4 text-center text-slate-500 text-sm">
                    No stands found
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredStands.map((stand) => (
                      <button
                        key={stand.id}
                        onClick={() => {
                          setSelectedStand(stand.id);
                          setIsPreviewing(true);
                          clearFilters();
                        }}
                        className={`w-full text-left p-3 hover:bg-slate-50 transition-colors ${
                          selectedStand === stand.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : 'border-l-4 border-l-transparent'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-slate-900">
                              Stand {stand.standNumber}
                            </p>
                            <p className="text-sm text-slate-500">
                              {stand.developmentName || "Unassigned"}
                            </p>
                          </div>
                          {stand.isStandalone && (
                            <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50 text-xs">
                              Unassigned
                            </Badge>
                          )}
                        </div>
                        {stand.clientName && (
                          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {stand.clientName}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Stand Summary Card */}
          {standData && (
            <Card className="bg-gradient-to-br from-slate-50 to-white">
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <Building2 className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Stand {standData.standNumber}</p>
                      <p className="font-semibold text-lg">{standData.developmentName || "Unassigned"}</p>
                    </div>
                  </div>

                  {standData.isStandalone && (
                    <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Unassigned stand — no development or client linked yet
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="bg-white rounded-lg p-3 border">
                      <p className="text-xs text-slate-500 mb-1">Client</p>
                      <p className="font-medium text-sm truncate">{standData.clientName || "N/A"}</p>
                    </div>
                    <div className="bg-white rounded-lg p-3 border">
                      <p className="text-xs text-slate-500 mb-1">Status</p>
                      <Badge variant={standData.balance && standData.balance <= 0 ? "default" : "secondary"} className="text-xs">
                        {standData.balance && standData.balance <= 0 ? (
                          <><CheckCircle2 className="h-3 w-3 mr-1" /> Paid</>
                        ) : (
                          <><Clock className="h-3 w-3 mr-1" /> Outstanding</>
                        )}
                      </Badge>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                      <p className="text-xs text-emerald-600 mb-1">Total Paid</p>
                      <p className="font-bold text-emerald-700">${(standData.totalPaid || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                      <p className="text-xs text-blue-600 mb-1">Agreed Price</p>
                      <p className="font-bold text-blue-700">${(standData.agreedPrice || 0).toLocaleString()}</p>
                    </div>
                    <div className={`rounded-lg p-3 border ${(standData.balance || 0) > 0 ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50 border-emerald-100'}`}>
                      <p className={`text-xs mb-1 ${(standData.balance || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>Balance</p>
                      <p className={`font-bold ${(standData.balance || 0) > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>${(standData.balance || 0).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Category Summary - Client View */}
          {categorySummary.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-slate-500 uppercase">Payment Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {categorySummary.map((cat) => (
                  <div key={cat.category} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[cat.category] || ''}`}>
                        {CATEGORY_LABELS[cat.category] || cat.category}
                      </Badge>
                      <span className="text-xs text-slate-400">({cat.count})</span>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-emerald-600 font-medium">${cat.receipts.toLocaleString()}</p>
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t mt-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-sm">Total Paid</span>
                    <span className="font-bold text-emerald-600">${totals.totalPaid.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content */}
        <div className="lg:col-span-8">
          {isPreviewing && standData ? (
            <div className="space-y-4" ref={statementRef}>
              {/* Filters */}
              <Card className="no-print">
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-4 items-end">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-500">From Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="date"
                          value={dateRange.start}
                          onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                          className="pl-9 w-40"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-500">To Date</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                          type="date"
                          value={dateRange.end}
                          onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                          className="pl-9 w-40"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-slate-500">Type</label>
                      <select
                        value={selectedCategory}
                        onChange={(e) => setSelectedCategory(e.target.value)}
                        className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                      >
                        <option value="all">All Types</option>
                        {CLIENT_VISIBLE_CATEGORIES.map((key) => (
                          <option key={key} value={key}>{CATEGORY_LABELS[key]}</option>
                        ))}
                      </select>
                    </div>
                    {(dateRange.start || dateRange.end || selectedCategory !== "all") && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                        <X className="h-4 w-4" />
                        Clear
                      </Button>
                    )}
                    <div className="ml-auto text-sm text-slate-500">
                      Showing {filteredTransactions.length} of {transactions.length} transactions
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Statement Preview */}
              <Card className="shadow-lg border-2">
                <CardContent className="p-8 md:p-12">
                  {/* Statement Header - Branded */}
                  <div className="flex justify-between border-b pb-8 mb-8">
                    <div className="flex-1">
                      {brandProfile?.logoUrl ? (
                        <img 
                          src={brandProfile.logoUrl} 
                          alt={brandProfile.companyName} 
                          className="h-16 w-auto object-contain mb-2"
                        />
                      ) : (
                        <div 
                          className="h-16 w-16 rounded-lg flex items-center justify-center text-white font-bold text-xl mb-2"
                          style={{ backgroundColor: brandProfile?.primaryColor || '#0f172a' }}
                        >
                          {brandProfile?.companyName?.charAt(0) || 'S'}
                        </div>
                      )}
                      <h2 className="text-2xl font-bold uppercase tracking-tight text-slate-900">
                        Statement of Account
                      </h2>
                      <p className="text-sm text-slate-500 mt-1">
                        Generated: {format(new Date(), 'MMMM do, yyyy')}
                      </p>
                      {standData.isStandalone && (
                        <span className="inline-block mt-2 text-xs bg-amber-100 text-amber-700 border border-amber-200 rounded px-2 py-0.5">
                          Unassigned Stand
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg" style={{ color: brandProfile?.primaryColor || '#0f172a' }}>
                        {brandProfile?.companyName || 'Stands Recon F&C'}
                      </p>
                      <p className="text-sm text-slate-500">
                        {brandProfile?.contactDetails?.address || 'Harare, Zimbabwe'}
                      </p>
                      {brandProfile?.contactDetails?.email && (
                        <p className="text-xs text-slate-400 mt-1">{brandProfile.contactDetails.email}</p>
                      )}
                      {brandProfile?.contactDetails?.website && (
                        <p className="text-xs text-slate-400">{brandProfile.contactDetails.website}</p>
                      )}
                    </div>
                  </div>

                  {/* Client & Stand Info */}
                  <div className="grid grid-cols-2 gap-8 mb-8 bg-slate-50 p-6 rounded-lg">
                    <div>
                      <p className="text-xs font-bold text-slate-400 uppercase mb-2">Bill To</p>
                      <p className="font-semibold text-lg">{standData.clientName || "Client (Unassigned)"}</p>
                      <p className="text-sm text-slate-500">Stand {standData.standNumber}</p>
                      {standData.developmentName && (
                        <p className="text-sm text-slate-500">{standData.developmentName}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-400 uppercase mb-2">Statement Details</p>
                      <p className="text-sm"><span className="font-medium">Stand Number:</span> {standData.standNumber}</p>
                      <p className="text-sm"><span className="font-medium">Development:</span> {standData.developmentName || "Unassigned"}</p>
                      <p className="text-sm"><span className="font-medium">Currency:</span> {standData.currency || "USD"}</p>
                      <p className="text-sm"><span className="font-medium">Period:</span> {dateRange.start ? format(parseISO(dateRange.start), 'MMM d') : 'Start'} - {dateRange.end ? format(parseISO(dateRange.end), 'MMM d, yyyy') : 'Present'}</p>
                    </div>
                  </div>

                  {/* Summary Cards - Client View */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
                      <DollarSign className="h-5 w-5 text-blue-600 mx-auto mb-1" />
                      <p className="text-xs text-blue-600 uppercase font-medium">Agreed Price</p>
                      <p className="text-xl font-bold text-blue-700">${totals.agreedPrice.toLocaleString()}</p>
                    </div>
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                      <TrendingUp className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
                      <p className="text-xs text-emerald-600 uppercase font-medium">Total Paid</p>
                      <p className="text-xl font-bold text-emerald-700">${totals.totalPaid.toLocaleString()}</p>
                    </div>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
                      <FileText className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                      <p className="text-xs text-purple-600 uppercase font-medium">Progress</p>
                      <p className="text-xl font-bold text-purple-700">{totals.paymentProgress}%</p>
                    </div>
                    <div className={`border rounded-lg p-4 text-center ${totals.remainingBalance > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                      <DollarSign className={`h-5 w-5 mx-auto mb-1 ${totals.remainingBalance > 0 ? 'text-amber-600' : 'text-emerald-600'}`} />
                      <p className={`text-xs uppercase font-medium ${totals.remainingBalance > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>Balance Due</p>
                      <p className={`text-xl font-bold ${totals.remainingBalance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>${totals.remainingBalance.toLocaleString()}</p>
                    </div>
                  </div>

                  {/* Transactions Table - Client View */}
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 border-b">
                        <tr>
                          <th className="py-3 px-4 text-left font-semibold text-slate-600">Date</th>
                          <th className="py-3 px-4 text-left font-semibold text-slate-600">Description</th>
                          <th className="py-3 px-4 text-left font-semibold text-slate-600">Type</th>
                          <th className="py-3 px-4 text-right font-semibold text-slate-600">Amount</th>
                          <th className="py-3 px-4 text-right font-semibold text-slate-600">Running Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingTx ? (
                          <tr>
                            <td className="py-8 text-slate-400 text-center" colSpan={5}>
                              <Loader2 className="h-5 w-5 animate-spin inline mr-2" />
                              Loading transactions...
                            </td>
                          </tr>
                        ) : transactionsWithBalance.length === 0 ? (
                          <tr>
                            <td className="py-8 text-slate-400 text-center" colSpan={5}>
                              No transactions found for the selected filters
                            </td>
                          </tr>
                        ) : (
                          transactionsWithBalance.map((tx, idx) => (
                            <tr key={tx.id} className="border-b last:border-0 hover:bg-slate-50">
                              <td className="py-3 px-4 text-slate-600">
                                {format(parseISO(tx.date), 'MMM d, yyyy')}
                              </td>
                              <td className="py-3 px-4">
                                <p className="font-medium">{sanitizeDescription(tx.description, tx.category)}</p>
                                {tx.reference && (
                                  <p className="text-xs text-slate-400">Ref: {tx.reference}</p>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[tx.category || 'UNKNOWN'] || ''}`}>
                                  {CATEGORY_LABELS[tx.category || 'UNKNOWN'] || tx.category}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <span className="text-emerald-600 font-medium">${tx.amount.toLocaleString()}</span>
                              </td>
                              <td className="py-3 px-4 text-right font-semibold">
                                ${tx.runningBalance.toLocaleString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex justify-between items-center mt-4 no-print">
                      <p className="text-sm text-slate-500">
                        Page {currentPage} of {totalPages}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Statement Footer */}
                  <div className="mt-8 pt-6 border-t">
                    <div className="flex justify-between items-start">
                      <div className="text-sm text-slate-500">
                        <p>This statement reflects all transactions up to {format(new Date(), 'MMMM do, yyyy')}</p>
                        <p className="text-xs mt-1">
                          For questions, please contact {brandProfile?.contactDetails?.email || 'support@standinventory.com'}
                        </p>
                        {brandProfile?.contactDetails?.phone && (
                          <p className="text-xs text-slate-400">Tel: {brandProfile.contactDetails.phone}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-slate-500">Outstanding Balance</p>
                        <p 
                          className="text-2xl font-bold"
                          style={{ color: (standData.balance || 0) > 0 ? '#e11d48' : brandProfile?.primaryColor || '#059669' }}
                        >
                          ${(standData.balance || 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center px-8 py-20 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-200">
              <div className="h-20 w-20 rounded-full bg-white flex items-center justify-center mb-6 text-slate-300 shadow-sm">
                <FileText size={40} />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No Statement Selected</h3>
              <p className="max-w-md text-slate-500">
                Select a stand from the list on the left to generate and view its financial statement. 
                You can filter by date range and export as PDF.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background: white;
          }
        }
      `}</style>
    </div>
  );
}
