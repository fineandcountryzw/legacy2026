"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, Printer, Search } from "lucide-react";
import { MOCK_STANDS } from "@/lib/constants";

export default function StatementsPage() {
    const [selectedStand, setSelectedStand] = useState<string | null>(null);
    const [isPreviewing, setIsPreviewing] = useState(false);

    const standData = selectedStand ? MOCK_STANDS.find(s => s.id === selectedStand) : null;

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Statements</h1>
                <p className="text-slate-500">Generate and export payment statements for clients.</p>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg">Select Stand</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Financial Period</label>
                                <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                                    Fiscal Year 2024
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-slate-700">Property Stand</label>
                                <select
                                    className="w-full flex h-9 items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                    onChange={(e) => {
                                        setSelectedStand(e.target.value);
                                        setIsPreviewing(false);
                                    }}
                                >
                                    <option value="">Select a stand...</option>
                                    {MOCK_STANDS.map((stand) => (
                                        <option key={stand.id} value={stand.id}>
                                            {stand.standNumber} - {stand.developmentName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <Button
                                className="w-full gap-2 mt-4"
                                disabled={!selectedStand}
                                onClick={() => setIsPreviewing(true)}
                            >
                                <FileText size={18} />
                                Generate Statement
                            </Button>
                        </CardContent>
                    </Card>

                    {standData && (
                        <Card>
                            <CardContent className="pt-6">
                                <div className="space-y-4">
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Client Information</p>
                                        <p className="font-semibold text-lg">{standData.clientName || "N/A"}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-xs text-slate-500">Total Paid</p>
                                            <p className="font-semibold">${standData.totalPaid.toLocaleString()}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-slate-500">Out. Balance</p>
                                            <p className="font-semibold text-rose-600">${standData.balance.toLocaleString()}</p>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <div className="lg:col-span-2">
                    {isPreviewing && standData ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="font-semibold">Statement Preview</h3>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="gap-2">
                                        <Printer size={16} />
                                        Print
                                    </Button>
                                    <Button size="sm" className="gap-2 bg-blue-600 hover:bg-blue-700">
                                        <Download size={16} />
                                        Download PDF
                                    </Button>
                                </div>
                            </div>

                            <Card className="shadow-lg border-2">
                                <CardContent className="p-12 min-h-[600px] flex flex-col">
                                    {/* Mock Statement Header */}
                                    <div className="flex justify-between border-b pb-8 mb-8">
                                        <div>
                                            <h2 className="text-2xl font-bold uppercase tracking-tight text-slate-900 font-sans">Statement of Account</h2>
                                            <p className="text-sm text-slate-500 mt-1">Generated: Feb 25, 2026</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold">StandInv Platform</p>
                                            <p className="text-sm text-slate-500">Harare, Zimbabwe</p>
                                        </div>
                                    </div>

                                    {/* Mock Statement Body */}
                                    <div className="flex-1 space-y-8">
                                        <div className="grid grid-cols-2 gap-8">
                                            <div>
                                                <p className="text-xs font-bold text-slate-400 uppercase mb-1">To</p>
                                                <p className="font-semibold">{standData.clientName}</p>
                                                <p className="text-sm text-slate-500">Zimbabwe</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs font-bold text-slate-400 uppercase mb-1">Details</p>
                                                <p className="text-sm"><span className="font-medium">Stand Number:</span> {standData.standNumber}</p>
                                                <p className="text-sm"><span className="font-medium">Development:</span> {standData.developmentName}</p>
                                            </div>
                                        </div>

                                        <table className="w-full text-sm">
                                            <thead className="border-y text-slate-500">
                                                <tr>
                                                    <th className="py-2 text-left">Date</th>
                                                    <th className="py-2 text-left">Description</th>
                                                    <th className="py-2 text-right">Debit</th>
                                                    <th className="py-2 text-right">Credit</th>
                                                    <th className="py-2 text-right">Balance</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                <tr className="border-b">
                                                    <td className="py-3">Jan 01, 2024</td>
                                                    <td className="py-3">Initial Stand Allocation</td>
                                                    <td className="py-3 text-right">$15,000.00</td>
                                                    <td className="py-3 text-right">-</td>
                                                    <td className="py-3 text-right">$15,000.00</td>
                                                </tr>
                                                <tr className="border-b">
                                                    <td className="py-3">Jan 15, 2024</td>
                                                    <td className="py-3">Deposit Payment (REF: DEP001)</td>
                                                    <td className="py-3 text-right">-</td>
                                                    <td className="py-3 text-right">$5,000.00</td>
                                                    <td className="py-3 text-right">$10,000.00</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mock Statement Footer */}
                                    <div className="mt-auto pt-8 border-t flex justify-between items-center bg-slate-50 -mx-12 px-12 -mb-6 pb-6">
                                        <div className="text-sm text-slate-500">
                                            Total Outstanding Balance as of Feb 25, 2026
                                        </div>
                                        <div className="text-2xl font-bold text-rose-600">
                                            ${standData.balance.toLocaleString()}.00
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 text-center px-8 py-20 bg-slate-50/50 rounded-xl border-2 border-dashed border-slate-200">
                            <div className="h-16 w-16 rounded-full bg-white flex items-center justify-center mb-4 text-slate-300 shadow-sm">
                                <Search size={32} />
                            </div>
                            <h3 className="text-lg font-medium text-slate-900 mb-2">No Statement Selected</h3>
                            <p className="max-w-xs">Search for and select a stand on the left to generate its financial statement preview.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
