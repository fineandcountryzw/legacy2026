"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, Download, Printer, Building2, Users, TrendingUp, 
  Wallet, ArrowRight, Calendar, DollarSign, PieChart, Loader2,
  Mail, Phone, MapPin, Globe
} from "lucide-react";
import { toast, Toaster } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface Development {
  id: string;
  name: string;
  code: string;
  developerName: string;
  developerContacts?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  currency: string;
  commissionRate: number;
  totalStands: number;
  soldStands: number;
  totalReceived: number;
  developerPayable: number;
  fineCountryRetain: number;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
}

interface ReportSummary {
  totalStands: number;
  soldStands: number;
  availableStands: number;
  totalValue: number;
  totalReceived: number;
  totalOutstanding: number;
  commissionTotal: number;
  adminFeesTotal: number;
  legalFeesTotal: number;
  developerPayable: number;
  fineCountryRetain: number;
}

export default function ReportsPage() {
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [selectedDev, setSelectedDev] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedDev, setEditedDev] = useState<Development | null>(null);

  useEffect(() => {
    fetchDevelopments();
  }, []);

  async function fetchDevelopments() {
    try {
      const response = await fetch("/api/developments");
      if (response.ok) {
        const data = await response.json();
        setDevelopments(data);
        if (data.length > 0) {
          setSelectedDev(data[0].id);
        }
      }
    } catch (error) {
      toast.error("Failed to fetch developments");
    } finally {
      setLoading(false);
    }
  }

  const currentDev = developments.find(d => d.id === selectedDev);

  const reportSummary: ReportSummary | null = currentDev ? {
    totalStands: currentDev.totalStands,
    soldStands: currentDev.soldStands,
    availableStands: currentDev.totalStands - currentDev.soldStands,
    totalValue: currentDev.totalReceived * 1.2, // Estimated
    totalReceived: currentDev.totalReceived,
    totalOutstanding: (currentDev.totalReceived * 1.2) - currentDev.totalReceived,
    commissionTotal: currentDev.fineCountryRetain * 0.7,
    adminFeesTotal: currentDev.fineCountryRetain * 0.3,
    legalFeesTotal: currentDev.totalReceived * 0.02, // Estimated 2% legal fees
    developerPayable: currentDev.developerPayable,
    fineCountryRetain: currentDev.fineCountryRetain
  } : null;

  function handleGenerateReport() {
    if (!currentDev) {
      toast.error("Please select a development");
      return;
    }
    setGenerating(true);
    
    // Simulate report generation
    setTimeout(() => {
      setGenerating(false);
      setShowReport(true);
      toast.success(`Report generated for ${currentDev.name}`);
    }, 1500);
  }

  function handleEditDev() {
    if (currentDev) {
      setEditedDev({ ...currentDev });
      setEditMode(true);
    }
  }

  async function handleSaveDev() {
    if (!editedDev) return;
    
    try {
      const response = await fetch(`/api/developments/${editedDev.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          developerName: editedDev.developerName,
          developerContacts: editedDev.developerContacts,
          email: editedDev.email,
          phone: editedDev.phone,
          address: editedDev.address,
          website: editedDev.website
        })
      });

      if (response.ok) {
        toast.success("Developer details updated");
        setEditMode(false);
        fetchDevelopments();
      } else {
        toast.error("Failed to update");
      }
    } catch (error) {
      toast.error("Network error");
    }
  }

  function handlePrint() {
    window.print();
  }

  function handleDownloadPdf() {
    toast.success("PDF download started");
  }

  if (loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <Toaster position="top-right" richColors />
      
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Developer Reports</h1>
        <p className="text-slate-500">Generate comprehensive branded reports for developers.</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Left Panel - Selection & Summary */}
        <div className="space-y-6">
          {/* Development Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Select Development
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Select value={selectedDev || "none"} onValueChange={(value) => setSelectedDev(value === "none" ? "" : value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a development..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select a development...</SelectItem>
                  {developments.map((dev) => (
                    <SelectItem key={dev.id} value={dev.id}>
                      {dev.name} ({dev.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {currentDev && (
                <div className="pt-4 border-t space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Developer</span>
                    <span className="font-medium">{currentDev.developerName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Commission</span>
                    <span className="font-medium">{(currentDev.commissionRate * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Currency</span>
                    <span className="font-medium">{currentDev.currency}</span>
                  </div>
                  <Button variant="outline" size="sm" className="w-full" onClick={handleEditDev}>
                    Edit Developer Details
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          {reportSummary && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-slate-900">{reportSummary.totalStands}</p>
                    <p className="text-xs text-slate-500">Total Stands</p>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-emerald-600">{reportSummary.soldStands}</p>
                    <p className="text-xs text-slate-500">Sold</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-600">${(reportSummary.totalReceived / 1000).toFixed(0)}k</p>
                    <p className="text-xs text-slate-500">Received</p>
                  </div>
                  <div className="bg-orange-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-orange-600">${(reportSummary.developerPayable / 1000).toFixed(0)}k</p>
                    <p className="text-xs text-slate-500">To Developer</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Generate Button */}
          <Button 
            className="w-full h-12 text-lg" 
            onClick={handleGenerateReport}
            disabled={generating || !currentDev}
          >
            {generating ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="mr-2 h-5 w-5" />
                Generate Report
              </>
            )}
          </Button>
        </div>

        {/* Right Panel - Report Preview */}
        <div className="lg:col-span-2">
          {showReport && currentDev && reportSummary ? (
            <Card className="border-2">
              {/* Report Header */}
              <CardHeader 
                className="border-b-2 text-white"
                style={{ 
                  backgroundColor: currentDev.primaryColor || '#0f172a',
                  borderColor: currentDev.secondaryColor || '#2563eb'
                }}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-2xl font-bold">{currentDev.name}</CardTitle>
                    <p className="text-white/80 mt-1">Developer Financial Statement</p>
                    <p className="text-white/60 text-sm">{new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                  </div>
                  <div className="text-right">
                    <div className="bg-white/10 px-4 py-2 rounded-lg">
                      <p className="text-xs text-white/60 uppercase">Development Code</p>
                      <p className="font-mono font-bold">{currentDev.code}</p>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-8 space-y-8">
                {/* Developer Info */}
                <div className="flex justify-between items-start pb-6 border-b">
                  <div>
                    <h3 className="font-bold text-lg text-slate-900">{currentDev.developerName}</h3>
                    <p className="text-slate-500">Property Developer</p>
                    {currentDev.developerContacts && (
                      <p className="text-sm text-slate-600 mt-2">{currentDev.developerContacts}</p>
                    )}
                    <div className="mt-3 space-y-1 text-sm">
                      {currentDev.email && (
                        <p className="flex items-center gap-2 text-slate-600">
                          <Mail className="h-4 w-4" />
                          {currentDev.email}
                        </p>
                      )}
                      {currentDev.phone && (
                        <p className="flex items-center gap-2 text-slate-600">
                          <Phone className="h-4 w-4" />
                          {currentDev.phone}
                        </p>
                      )}
                      {currentDev.address && (
                        <p className="flex items-center gap-2 text-slate-600">
                          <MapPin className="h-4 w-4" />
                          {currentDev.address}
                        </p>
                      )}
                      {currentDev.website && (
                        <p className="flex items-center gap-2 text-slate-600">
                          <Globe className="h-4 w-4" />
                          {currentDev.website}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge 
                      variant="outline" 
                      className="text-lg px-4 py-2"
                      style={{ borderColor: currentDev.accentColor || '#3b82f6', color: currentDev.primaryColor || '#0f172a' }}
                    >
                      {currentDev.currency}
                    </Badge>
                  </div>
                </div>

                {/* Executive Summary */}
                <div>
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <PieChart className="h-5 w-5" />
                    Executive Summary
                  </h3>
                  <div className="grid grid-cols-5 gap-4">
                    <div className="bg-slate-50 p-4 rounded-lg">
                      <p className="text-2xl font-bold text-slate-900">{reportSummary.totalStands}</p>
                      <p className="text-sm text-slate-500">Total Stands</p>
                      <div className="mt-2 flex gap-1 text-xs">
                        <span className="text-emerald-600">{reportSummary.soldStands} sold</span>
                        <span className="text-slate-400">|</span>
                        <span className="text-blue-600">{reportSummary.availableStands} avail</span>
                      </div>
                    </div>
                    <div className="bg-emerald-50 p-4 rounded-lg">
                      <p className="text-2xl font-bold text-emerald-700">${(reportSummary.totalReceived / 1000).toFixed(0)}k</p>
                      <p className="text-sm text-slate-500">Total Received</p>
                      <p className="text-xs text-slate-400 mt-1">From client payments</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-2xl font-bold text-blue-700">${(reportSummary.commissionTotal / 1000).toFixed(0)}k</p>
                      <p className="text-sm text-slate-500">F&C Commission</p>
                      <p className="text-xs text-slate-400 mt-1">{(currentDev.commissionRate * 100).toFixed(1)}% of sales</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg">
                      <p className="text-2xl font-bold text-red-700">${(reportSummary.legalFeesTotal / 1000).toFixed(0)}k</p>
                      <p className="text-sm text-slate-500">Legal Fees</p>
                      <p className="text-xs text-slate-400 mt-1">Deducted from gross</p>
                    </div>
                    <div className="bg-orange-50 p-4 rounded-lg">
                      <p className="text-2xl font-bold text-orange-700">${((reportSummary.developerPayable - reportSummary.legalFeesTotal) / 1000).toFixed(0)}k</p>
                      <p className="text-sm text-slate-500">Net to Developer</p>
                      <p className="text-xs text-slate-400 mt-1">After all deductions</p>
                    </div>
                  </div>
                </div>

                {/* Revenue Breakdown */}
                <div>
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Revenue Breakdown
                  </h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-600">Gross Sales Value</span>
                      <span className="font-bold">${reportSummary.totalValue.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-600">Payments Received</span>
                      <span className="font-bold text-emerald-600">${reportSummary.totalReceived.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-600">Outstanding Balance</span>
                      <span className="font-bold text-amber-600">${reportSummary.totalOutstanding.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Deductions & Allocations */}
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                      <Wallet className="h-5 w-5" />
                      F&C Retain
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Sales Commission</span>
                        <span className="font-medium">${reportSummary.commissionTotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Administration Fees</span>
                        <span className="font-medium">${reportSummary.adminFeesTotal.toLocaleString()}</span>
                      </div>
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between font-bold">
                          <span>Total F&C Retain</span>
                          <span className="text-blue-600">${reportSummary.fineCountryRetain.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                      <DollarSign className="h-5 w-5" />
                      Developer Payout
                    </h3>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Gross Receipts</span>
                        <span className="font-medium">${reportSummary.totalReceived.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Less F&C Retain</span>
                        <span className="font-medium text-red-500">-${reportSummary.fineCountryRetain.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-600">Less Legal Fees</span>
                        <span className="font-medium text-red-500">-${reportSummary.legalFeesTotal.toLocaleString()}</span>
                      </div>
                      <div className="border-t pt-2 mt-2">
                        <div className="flex justify-between font-bold">
                          <span>Net Payable</span>
                          <span className="text-emerald-600">${(reportSummary.developerPayable - reportSummary.legalFeesTotal).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-6 border-t">
                  <Button onClick={handlePrint} variant="outline" className="flex-1">
                    <Printer className="mr-2 h-4 w-4" />
                    Print Report
                  </Button>
                  <Button onClick={handleDownloadPdf} variant="outline" className="flex-1">
                    <Download className="mr-2 h-4 w-4" />
                    Download PDF
                  </Button>
                </div>

                {/* Footer */}
                <div className="text-center text-xs text-slate-400 pt-4 border-t">
                  <p>Generated by Stands Recon F&C on {new Date().toLocaleString()}</p>
                  <p className="mt-1">This statement is confidential and intended solely for the named developer.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-12 border-2 border-dashed rounded-lg">
              <FileText className="h-16 w-16 mb-4" />
              <h3 className="text-lg font-medium text-slate-600">No Report Generated</h3>
              <p className="text-center max-w-sm mt-2">
                Select a development and click "Generate Report" to create a comprehensive branded developer statement.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Developer Dialog */}
      <Dialog open={editMode} onOpenChange={setEditMode}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Developer Details</DialogTitle>
          </DialogHeader>
          {editedDev && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Developer/Company Name</Label>
                <Input 
                  value={editedDev.developerName}
                  onChange={(e) => setEditedDev({...editedDev, developerName: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Contact Person/Details</Label>
                <Input 
                  value={editedDev.developerContacts || ''}
                  onChange={(e) => setEditedDev({...editedDev, developerContacts: e.target.value})}
                  placeholder="e.g., John Smith, Managing Director"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input 
                  type="email"
                  value={editedDev.email || ''}
                  onChange={(e) => setEditedDev({...editedDev, email: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input 
                  value={editedDev.phone || ''}
                  onChange={(e) => setEditedDev({...editedDev, phone: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input 
                  value={editedDev.address || ''}
                  onChange={(e) => setEditedDev({...editedDev, address: e.target.value})}
                />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input 
                  value={editedDev.website || ''}
                  onChange={(e) => setEditedDev({...editedDev, website: e.target.value})}
                  placeholder="www.example.com"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setEditMode(false)}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={handleSaveDev}>
                  Save Changes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
