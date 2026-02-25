"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { FileUpload } from "@/components/file-upload";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { UploadHistory } from "@/types";
import { 
  Eye, Loader2, AlertCircle, CheckCircle2, FileSpreadsheet, 
  ChevronDown, ChevronUp, Download, Building2, Users, Receipt, Home,
  TrendingUp, TrendingDown, Wallet, Database, X
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast, Toaster } from "sonner";

// Types from updated ledger parser
interface ParsedTransaction {
  sheetName: string;
  standNumber: string;
  agentCode: string;
  date: string | null;
  description: string;
  reference: string;
  amount: number;
  category: string;
  developerName?: string;
  side: 'RECEIPT' | 'PAYMENT';
}

interface StandSummary {
  sheetName: string;
  standNumber: string;
  agentCode: string;
  clientDeposits: number;
  clientInstallments: number;
  totalReceipts: number;
  fcCommissions: number;
  fcAdminFees: number;
  developerPayments: {
    lakecity: number;
    highrange: number;
    southlands: number;
    lomlight: number;
    other: number;
  };
  realtorPayments: number;
  legalFees: number;
  aosFees: number;
  totalPayments: number;
  balanceCarriedDown: number;
  transactions: ParsedTransaction[];
}

interface EstateSummary {
  sheetName: string;
  stands: StandSummary[];
}

interface LedgerResult {
  metadata: {
    filename: string;
    parsedAt: string;
    totalSheets: number;
    totalStands: number;
    totalTransactions: number;
    validationErrors: string[];
  };
  estates: EstateSummary[];
  grandTotals: {
    clientDeposits: number;
    clientInstallments: number;
    totalReceipts: number;
    fcCommissions: number;
    fcAdminFees: number;
    developerPayments: {
      lakecity: number;
      highrange: number;
      southlands: number;
      lomlight: number;
      other: number;
    };
    realtorPayments: number;
    legalFees: number;
    aosFees: number;
    totalPayments: number;
    balanceCarriedDown: number;
  };
  allTransactions: ParsedTransaction[];
}

interface ImportSummary {
  uploadId: string;
  estatesProcessed: number;
  standsCreated: number;
  transactionsCreated: number;
  clientPaymentsTotal: number;
  developerPaymentsTotal: number;
  legalFeesTotal: number;
  fcFeesTotal: number;
  realtorPaymentsTotal: number;
  errors: string[];
}

export default function UploadsPage() {
  const NO_DEVELOPMENT_VALUE = "__none__";
  const [history, setHistory] = useState<UploadHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [result, setResult] = useState<LedgerResult | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBuffer, setFileBuffer] = useState<string | null>(null);
  const [expandedStand, setExpandedStand] = useState<string | null>(null);
  const [selectedEstate, setSelectedEstate] = useState<string>("all");
  const [activeTab, setActiveTab] = useState("summary");
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [selectedDevelopment, setSelectedDevelopment] = useState<string>(NO_DEVELOPMENT_VALUE);
  const [developments, setDevelopments] = useState<{ id: string; name: string; code: string }[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch upload history
  const fetchHistory = useCallback(async () => {
    try {
      const response = await fetch("/api/uploads");
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (error) {
      console.error("Failed to fetch upload history:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch developments for dropdown
  useEffect(() => {
    async function fetchDevelopments() {
      try {
        const response = await fetch("/api/developments");
        if (response.ok) {
          const data = await response.json();
          setDevelopments(data.map((d: any) => ({ id: d.id, name: d.name, code: d.code })));
        }
      } catch (error) {
        console.error("Failed to fetch developments:", error);
      }
    }
    fetchDevelopments();
    fetchHistory();
  }, [fetchHistory]);

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    setResult(null);
    setExpandedStand(null);
    setSelectedEstate("all");
    setImportSummary(null);
    
    // Convert file to base64 for later import
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      setFileBuffer(base64);
    };
    reader.readAsDataURL(file);
    
    await generatePreview(file);
  };

  const generatePreview = async (file: File) => {
    setPreviewLoading(true);
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/uploads/preview", {
        method: "POST",
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        setResult(data);
        toast.success(`Parsed ${data.metadata.totalStands} stands from ${data.metadata.totalSheets} sheets`);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to preview file");
      }
    } catch (error) {
      toast.error("Failed to generate preview");
      console.error(error);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !result || !fileBuffer) {
      toast.error("No file to import");
      return;
    }

    setImportLoading(true);
    setShowImportDialog(true);
    
    const toastId = toast.loading("Importing data to database...");

    try {
      const response = await fetch("/api/uploads/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileData: fileBuffer,
          filename: selectedFile.name,
          developmentId: selectedDevelopment === NO_DEVELOPMENT_VALUE ? null : selectedDevelopment
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setImportSummary(data.summary);
        toast.success(
          `Import complete! Created ${data.summary.standsCreated} stands and ${data.summary.transactionsCreated} transactions.`,
          { id: toastId }
        );
        
        // Refresh history
        fetchHistory();
      } else {
        toast.error(data.error || "Import failed", { id: toastId });
        setImportSummary(data.summary);
      }
    } catch (error) {
      toast.error("Import failed: Network error", { id: toastId });
      console.error(error);
    } finally {
      setImportLoading(false);
    }
  };

  const downloadJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-${result.metadata.parsedAt.split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("JSON file downloaded");
  };

  const downloadCsv = () => {
    if (!result) return;
    const headers = ['Sheet', 'Stand', 'Agent', 'Date', 'Description', 'Ref', 'Category', 'Side', 'Amount'];
    const rows = result.allTransactions.map(tx => [
      tx.sheetName,
      tx.standNumber,
      tx.agentCode,
      tx.date || '',
      `"${tx.description.replace(/"/g, '""')}"`,
      tx.reference,
      tx.category,
      tx.side,
      tx.amount
    ].join(','));
    
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger-${result.metadata.parsedAt.split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV file downloaded");
  };

  const clearUpload = () => {
    setResult(null);
    setSelectedFile(null);
    setFileBuffer(null);
    setImportSummary(null);
    setSelectedEstate("all");
    setSelectedDevelopment(NO_DEVELOPMENT_VALUE);
    toast.info("Upload cleared");
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
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
    return colors[category] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getDeveloperColor = (name?: string) => {
    const colors: Record<string, string> = {
      'LAKECITY': 'text-orange-600',
      'HIGHRANGE': 'text-orange-600',
      'SOUTHLANDS': 'text-orange-600',
      'LOMLIGHT': 'text-orange-600',
    };
    return colors[name || ''] || 'text-orange-600';
  };

  // Filter stands based on selected estate
  const filteredEstates = result?.estates.filter(e => 
    selectedEstate === "all" || e.sheetName === selectedEstate
  ) || [];

  const columns = [
    { header: "File Name", accessorKey: "fileName" as keyof UploadHistory },
    { header: "Date", accessorKey: "date" as keyof UploadHistory },
    { header: "Stands", accessorKey: "standsDetected" as keyof UploadHistory },
    { header: "Transactions", accessorKey: "transactionsDetected" as keyof UploadHistory },
    {
      header: "Status",
      accessorKey: "status" as keyof UploadHistory,
      cell: (item: UploadHistory) => <StatusBadge status={item.status} />
    },
    {
      header: "Action",
      accessorKey: "id" as keyof UploadHistory,
      cell: () => (
        <Button variant="ghost" size="sm">
          <Eye size={16} className="mr-2" />
          View
        </Button>
      )
    },
  ];

  return (
    <div className="space-y-8">
      <Toaster position="top-right" richColors />
      
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Ledger Upload</h1>
        <p className="text-slate-500">Upload property development payment ledgers with multiple estates.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Upload Area */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                Upload Ledger File
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <FileUpload onUpload={handleFileSelect} accept=".xlsx,.xls" />
              
              {previewLoading && (
                <div className="flex items-center justify-center gap-2 text-slate-500 py-4">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span>Analyzing ledger with multiple sheets...</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Results Section */}
          {result && (
            <>
              {/* Validation Errors */}
              {result.metadata.validationErrors.length > 0 && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">Validation Warnings</AlertTitle>
                  <AlertDescription className="text-amber-700">
                    <ul className="list-disc list-inside mt-2 text-sm">
                      {result.metadata.validationErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Grand Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <Card className="bg-emerald-50 border-emerald-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                      <span className="text-xs font-medium text-emerald-600 uppercase">Client Payments</span>
                    </div>
                    <p className="text-xl font-bold text-emerald-900">
                      ${result.grandTotals.totalReceipts.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet className="h-4 w-4 text-blue-600" />
                      <span className="text-xs font-medium text-blue-600 uppercase">F&C Fees</span>
                    </div>
                    <p className="text-xl font-bold text-blue-900">
                      ${(result.grandTotals.fcCommissions + result.grandTotals.fcAdminFees).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-red-50 border-red-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Receipt className="h-4 w-4 text-red-600" />
                      <span className="text-xs font-medium text-red-600 uppercase">Legal Fees</span>
                    </div>
                    <p className="text-xl font-bold text-red-900">
                      ${result.grandTotals.legalFees.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Building2 className="h-4 w-4 text-orange-600" />
                      <span className="text-xs font-medium text-orange-600 uppercase">To Developers</span>
                    </div>
                    <p className="text-xl font-bold text-orange-900">
                      ${result.grandTotals.totalPayments.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-slate-50 border-slate-200">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Home className="h-4 w-4 text-slate-600" />
                      <span className="text-xs font-medium text-slate-600 uppercase">Estates/Stands</span>
                    </div>
                    <p className="text-xl font-bold text-slate-900">
                      {result.metadata.totalStands}
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      {result.metadata.totalSheets} sheets
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Developer Breakdown */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-500 uppercase">Developer Payments Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-5 gap-4 text-center">
                    <div>
                      <p className="text-lg font-bold text-orange-600">${result.grandTotals.developerPayments.lakecity.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">Lakecity</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-orange-600">${result.grandTotals.developerPayments.highrange.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">Highrange</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-orange-600">${result.grandTotals.developerPayments.southlands.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">Southlands</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-orange-600">${result.grandTotals.developerPayments.lomlight.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">Lomlight</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-orange-600">${result.grandTotals.developerPayments.other.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">Other</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Main Results Tabs */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Receipt className="h-5 w-5" />
                    Ledger Analysis
                    <Badge variant="secondary">{result.metadata.totalStands} stands</Badge>
                    <Badge variant="secondary">{result.metadata.totalTransactions} transactions</Badge>
                  </CardTitle>
                  <div className="flex gap-2">
                    <Select value={selectedEstate} onValueChange={setSelectedEstate}>
                      <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Filter by estate" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Estates</SelectItem>
                        {result.estates.map(e => (
                          <SelectItem key={e.sheetName} value={e.sheetName}>
                            {e.sheetName} ({e.stands.length} stands)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="sm" onClick={downloadJson}>
                      <Download className="mr-2 h-4 w-4" />
                      JSON
                    </Button>
                    <Button variant="outline" size="sm" onClick={downloadCsv}>
                      <Download className="mr-2 h-4 w-4" />
                      CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeTab} onValueChange={setActiveTab}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="summary">By Stand</TabsTrigger>
                      <TabsTrigger value="transactions">All Transactions</TabsTrigger>
                    </TabsList>

                    <TabsContent value="summary" className="space-y-4 mt-4">
                      {filteredEstates.map((estate) => (
                        <div key={estate.sheetName} className="space-y-2">
                          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                            <Home className="h-4 w-4" />
                            {estate.sheetName}
                            <Badge variant="outline">{estate.stands.length} stands</Badge>
                          </h3>
                          
                          {estate.stands.map((stand) => (
                            <Collapsible
                              key={`${estate.sheetName}-${stand.standNumber}`}
                              open={expandedStand === `${estate.sheetName}-${stand.standNumber}`}
                              onOpenChange={() => setExpandedStand(
                                expandedStand === `${estate.sheetName}-${stand.standNumber}` 
                                  ? null 
                                  : `${estate.sheetName}-${stand.standNumber}`
                              )}
                            >
                              <CollapsibleTrigger className="w-full">
                                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                                  <div className="flex items-center gap-4">
                                    <span className="font-bold text-lg">Stand {stand.standNumber}</span>
                                    {stand.agentCode && (
                                      <Badge variant="outline">{stand.agentCode}</Badge>
                                    )}
                                    <span className="text-sm text-slate-500">
                                      {stand.transactions.length} transactions
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-6">
                                    <div className="text-right">
                                      <p className="text-xs text-slate-500">Client Paid</p>
                                      <p className="font-semibold text-emerald-600">
                                        +${stand.totalReceipts.toLocaleString()}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xs text-slate-500">Paid Out</p>
                                      <p className="font-semibold text-red-600">
                                        -${stand.totalPayments.toLocaleString()}
                                      </p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-xs text-slate-500">Balance</p>
                                      <p className="font-bold text-slate-900">
                                        ${stand.balanceCarriedDown.toLocaleString()}
                                      </p>
                                    </div>
                                    {expandedStand === `${estate.sheetName}-${stand.standNumber}` ? (
                                      <ChevronUp className="h-5 w-5 text-slate-400" />
                                    ) : (
                                      <ChevronDown className="h-5 w-5 text-slate-400" />
                                    )}
                                  </div>
                                </div>
                              </CollapsibleTrigger>

                              <CollapsibleContent>
                                <div className="mt-4 space-y-4">
                                  <div className="grid grid-cols-4 md:grid-cols-8 gap-3 p-4 bg-slate-50/50 rounded-lg text-sm">
                                    <div>
                                      <p className="text-xs text-slate-500 mb-1">Deposits</p>
                                      <p className="font-semibold text-emerald-600">${stand.clientDeposits.toLocaleString()}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-500 mb-1">Installments</p>
                                      <p className="font-semibold text-emerald-600">${stand.clientInstallments.toLocaleString()}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-500 mb-1">F&C Commission</p>
                                      <p className="font-semibold text-blue-600">${stand.fcCommissions.toLocaleString()}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-500 mb-1">F&C Admin</p>
                                      <p className="font-semibold text-blue-600">${stand.fcAdminFees.toLocaleString()}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-500 mb-1">To Developers</p>
                                      <p className="font-semibold text-orange-600">${(stand.developerPayments.lakecity + stand.developerPayments.highrange + stand.developerPayments.southlands + stand.developerPayments.lomlight + stand.developerPayments.other).toLocaleString()}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-500 mb-1">Realtor</p>
                                      <p className="font-semibold text-purple-600">${stand.realtorPayments.toLocaleString()}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-500 mb-1">Legal Fees</p>
                                      <p className="font-semibold text-red-600">${stand.legalFees.toLocaleString()}</p>
                                    </div>
                                    <div>
                                      <p className="text-xs text-slate-500 mb-1">AOS Fees</p>
                                      <p className="font-semibold text-yellow-600">${stand.aosFees.toLocaleString()}</p>
                                    </div>
                                  </div>

                                  <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                      <thead className="bg-slate-100">
                                        <tr>
                                          <th className="text-left p-3 font-medium">Date</th>
                                          <th className="text-left p-3 font-medium">Description</th>
                                          <th className="text-left p-3 font-medium">Ref</th>
                                          <th className="text-left p-3 font-medium">Category</th>
                                          <th className="text-right p-3 font-medium">Amount</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {stand.transactions.map((tx, idx) => (
                                          <tr key={idx} className="border-t">
                                            <td className="p-3 text-slate-600">{tx.date}</td>
                                            <td className="p-3">{tx.description}</td>
                                            <td className="p-3 font-mono text-xs">{tx.reference}</td>
                                            <td className="p-3">
                                              <Badge variant="outline" className={getCategoryColor(tx.category)}>
                                                {tx.category.replace(/_/g, ' ')}
                                              </Badge>
                                              {tx.developerName && (
                                                <span className={`ml-2 text-xs font-medium ${getDeveloperColor(tx.developerName)}`}>
                                                  {tx.developerName}
                                                </span>
                                              )}
                                            </td>
                                            <td className={`p-3 text-right font-medium ${
                                              tx.side === 'RECEIPT' ? 'text-emerald-600' : 'text-red-600'
                                            }`}>
                                              {tx.side === 'RECEIPT' ? '+' : '-'}${tx.amount.toLocaleString()}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </Collapsible>
                          ))}
                        </div>
                      ))}
                    </TabsContent>

                    <TabsContent value="transactions" className="mt-4">
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-100">
                            <tr>
                              <th className="text-left p-3 font-medium">Estate</th>
                              <th className="text-left p-3 font-medium">Stand</th>
                              <th className="text-left p-3 font-medium">Date</th>
                              <th className="text-left p-3 font-medium">Description</th>
                              <th className="text-left p-3 font-medium">Ref</th>
                              <th className="text-left p-3 font-medium">Category</th>
                              <th className="text-right p-3 font-medium">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(selectedEstate === "all" 
                              ? result.allTransactions 
                              : result.allTransactions.filter(t => t.sheetName === selectedEstate)
                            ).map((tx, idx) => (
                              <tr key={idx} className="border-t">
                                <td className="p-3 text-slate-500">{tx.sheetName}</td>
                                <td className="p-3 font-medium">{tx.standNumber}</td>
                                <td className="p-3 text-slate-600">{tx.date}</td>
                                <td className="p-3">{tx.description}</td>
                                <td className="p-3 font-mono text-xs">{tx.reference}</td>
                                <td className="p-3">
                                  <Badge variant="outline" className={getCategoryColor(tx.category)}>
                                    {tx.category.replace(/_/g, ' ')}
                                  </Badge>
                                </td>
                                <td className={`p-3 text-right font-medium ${
                                  tx.side === 'RECEIPT' ? 'text-emerald-600' : 'text-red-600'
                                }`}>
                                  {tx.side === 'RECEIPT' ? '+' : '-'}${tx.amount.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>

              {/* Import Section */}
              <Card className="border-blue-200">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Database className="h-5 w-5 text-blue-600" />
                    Import to Database
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Select value={selectedDevelopment} onValueChange={setSelectedDevelopment}>
                      <SelectTrigger className="w-[300px]">
                        <SelectValue placeholder="Select development to link stands..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_DEVELOPMENT_VALUE}>None (Standalone)</SelectItem>
                        {developments.map((dev) => (
                          <SelectItem key={dev.id} value={dev.id}>
                            {dev.name} ({dev.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button 
                      onClick={handleImport}
                      disabled={importLoading}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {importLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Importing...
                        </>
                      ) : (
                        <>
                          <Database className="mr-2 h-4 w-4" />
                          Import {result.metadata.totalStands} Stands
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={clearUpload}>
                      <X className="mr-2 h-4 w-4" />
                      Clear
                    </Button>
                  </div>
                  <p className="text-sm text-slate-500">
                    This will create stand inventory records and payment transactions in the database.
                    Transactions are linked to prevent duplicates.
                  </p>
                </CardContent>
              </Card>
            </>
          )}

          {/* Import History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Import History</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex h-32 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                </div>
              ) : (
                <DataTable
                  columns={columns}
                  data={history}
                  pagination={{
                    currentPage: 1,
                    totalPages: 1,
                    onPageChange: () => { },
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Supported Formats</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  Multiple sheets per file (estates)
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  Stand headers: &quot;Stand number XXXX&quot;
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  Dual column: Receipts (left) / Payments (right)
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  Developer names auto-detected
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  Agent codes (KCM, RJ, PM, etc.)
                </li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Auto-Categorization</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="text-sm">Client Deposits & Installments</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-sm">F&C Commission & Admin</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500"></div>
                <span className="text-sm">Developer Payments</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                <span className="text-sm">Realtor Payments</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                <span className="text-sm">AOS Fees</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500"></div>
                <span className="text-sm">Legal Fees</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Import Summary Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {importLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : importSummary && importSummary.errors.length === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-amber-500" />
              )}
              {importLoading ? "Importing..." : "Import Complete"}
            </DialogTitle>
            <DialogDescription>
              {importLoading 
                ? "Processing stands and transactions..." 
                : "Summary of imported data"
              }
            </DialogDescription>
          </DialogHeader>

          {importSummary && (
            <div className="space-y-6">
              {/* Success Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-slate-900">{importSummary.estatesProcessed}</p>
                  <p className="text-xs text-slate-500 uppercase">Estates</p>
                </div>
                <div className="bg-emerald-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-emerald-600">{importSummary.standsCreated}</p>
                  <p className="text-xs text-slate-500 uppercase">Stands Created</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg text-center">
                  <p className="text-2xl font-bold text-blue-600">{importSummary.transactionsCreated}</p>
                  <p className="text-xs text-slate-500 uppercase">Transactions</p>
                </div>
                <div className="bg-slate-50 p-4 rounded-lg text-center">
                  <p className="text-lg font-bold text-slate-900">${importSummary.clientPaymentsTotal.toLocaleString()}</p>
                  <p className="text-xs text-slate-500 uppercase">Client Payments</p>
                </div>
              </div>

              {/* Financial Summary by Category */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Financial Summary by Category</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex justify-between p-3 bg-emerald-50 rounded">
                    <span className="text-slate-600">Client Payments</span>
                    <span className="font-semibold text-emerald-600">+${importSummary.clientPaymentsTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-blue-50 rounded">
                    <span className="text-slate-600">F&C Fees</span>
                    <span className="font-semibold text-blue-600">${importSummary.fcFeesTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-orange-50 rounded">
                    <span className="text-slate-600">Developer Payments</span>
                    <span className="font-semibold text-orange-600">-${importSummary.developerPaymentsTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-purple-50 rounded">
                    <span className="text-slate-600">Realtor Payments</span>
                    <span className="font-semibold text-purple-600">${importSummary.realtorPaymentsTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-red-50 rounded">
                    <span className="text-slate-600">Legal Fees</span>
                    <span className="font-semibold text-red-600">${importSummary.legalFeesTotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between p-3 bg-slate-50 rounded">
                    <span className="text-slate-600">Net to Developer</span>
                    <span className="font-semibold text-slate-900">${(importSummary.clientPaymentsTotal - importSummary.fcFeesTotal - importSummary.developerPaymentsTotal - importSummary.realtorPaymentsTotal - importSummary.legalFeesTotal).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Errors if any */}
              {importSummary.errors.length > 0 && (
                <Alert className="bg-amber-50 border-amber-200">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertTitle className="text-amber-800">Warnings ({importSummary.errors.length})</AlertTitle>
                  <AlertDescription className="text-amber-700">
                    <ul className="list-disc list-inside mt-2 text-sm max-h-32 overflow-auto">
                      {importSummary.errors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Upload ID */}
              {importSummary.uploadId && (
                <div className="text-xs text-slate-400">
                  Upload ID: {importSummary.uploadId}
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={() => setShowImportDialog(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
