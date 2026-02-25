"use client"

import { useState } from "react"
import { Search, CheckCircle2, AlertCircle, ArrowRight, Save, Calculator, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable } from "@/components/data-table"
import { Money } from "@/components/money"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MOCK_TRANSACTIONS, MOCK_STANDS, MOCK_DEVELOPMENTS } from "@/lib/constants"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"

export default function ReconciliationPage() {
    const [selectedTransaction, setSelectedTransaction] = useState(MOCK_TRANSACTIONS[0])
    const [matchingStand, setMatchingStand] = useState(MOCK_STANDS[0])

    const unmatchedColumns: any[] = [
        { header: "Date", accessorKey: "date" },
        { header: "Reference", accessorKey: "reference", cell: (row: any) => <span className="font-mono text-xs">{row.reference}</span> },
        { header: "Amount", accessorKey: "amount", cell: (row: any) => <Money amount={row.amount} /> },
        {
            header: "Action",
            id: "select",
            cell: (row: any) => (
                <Button variant="ghost" size="sm" onClick={() => setSelectedTransaction(row)}>
                    Match <ArrowRight className="ml-2 h-3 w-3" />
                </Button>
            )
        },
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Reconciliation</h1>
                    <p className="text-muted-foreground">Match bank transactions to stands and allocate funds.</p>
                </div>
                <div className="flex gap-3">
                    <Select defaultValue="dev-1">
                        <SelectTrigger className="w-[250px] bg-white">
                            <SelectValue placeholder="Select Development" />
                        </SelectTrigger>
                        <SelectContent>
                            {MOCK_DEVELOPMENTS.map(dev => (
                                <SelectItem key={dev.id} value={dev.id}>{dev.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline"><RefreshCw className="mr-2 h-4 w-4" /> Sync Bank</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Unmatched Transactions */}
                <div className="lg:col-span-5 space-y-4">
                    <Card className="h-full">
                        <CardHeader className="pb-3 border-b bg-slate-50/50">
                            <CardTitle className="text-sm font-bold flex items-center justify-between">
                                <span>Unmatched Transactions</span>
                                <Badge variant="destructive">12 Pending</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <DataTable
                                columns={unmatchedColumns}
                                data={MOCK_TRANSACTIONS}
                                pagination={false}
                            />
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Matching & Allocation Panel */}
                <div className="lg:col-span-7 space-y-6">
                    <Card className="border-blue-200 shadow-md">
                        <CardHeader className="bg-blue-50/50 border-b border-blue-100">
                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-900">
                                <Calculator className="h-4 w-4" /> Transaction Matching Panel
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-6">
                            {/* Selected Transaction Summary */}
                            <div className="flex justify-between items-start bg-slate-900 text-white p-4 rounded-lg shadow-inner">
                                <div>
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Selected Reference</p>
                                    <p className="text-lg font-mono">{selectedTransaction.reference}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Amount</p>
                                    <Money amount={selectedTransaction.amount} className="text-2xl text-emerald-400" />
                                </div>
                            </div>

                            {/* Stand Search */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                                <div className="space-y-2">
                                    <Label>Search Stand Number</Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                        <Input placeholder="e.g. 101" className="pl-10" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Matching Stand</Label>
                                    <Card className="bg-slate-50 border-dashed p-2 text-sm flex items-center justify-between">
                                        <div>
                                            <span className="font-bold">Stand {matchingStand.standNumber}</span>
                                            <span className="text-slate-500 ml-2">{matchingStand.clientName}</span>
                                        </div>
                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    </Card>
                                </div>
                            </div>

                            <Separator />

                            {/* Allocation Editor */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-sm font-bold">Allocation Breakdown</h3>
                                    <Button variant="ghost" size="sm" className="text-blue-600 text-xs h-7">
                                        <Calculator className="mr-1 h-3 w-3" /> Auto-Calculate
                                    </Button>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs">Stand Price Allocation</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
                                            <Input type="number" defaultValue={1250} className="pl-7" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Commission (5%)</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
                                            <Input type="number" defaultValue={75} className="pl-7" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Admin Fee</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
                                            <Input type="number" defaultValue={150} className="pl-7" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs">Legal Fee</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
                                            <Input type="number" defaultValue={25} className="pl-7" />
                                        </div>
                                    </div>
                                </div>

                                <div className="p-4 bg-emerald-50 rounded-lg flex items-center justify-between border border-emerald-100">
                                    <div className="flex items-center gap-2 text-emerald-800">
                                        <CheckCircle2 className="h-5 w-5" />
                                        <span className="text-sm font-bold">Fully Allocated</span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-[10px] uppercase font-bold text-emerald-600 block">Total</span>
                                        <Money amount={1500} className="text-emerald-900 font-bold" />
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 pt-4 border-t">
                                <Button variant="outline">Reset</Button>
                                <Button className="bg-blue-600 hover:bg-blue-700">
                                    <Save className="mr-2 h-4 w-4" /> Save Allocation
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Development Summary Section */}
                    <Card>
                        <CardHeader className="pb-3 border-b">
                            <CardTitle className="text-sm font-bold">Development Summary: Green Valley</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Total Received</p>
                                    <Money amount={1200000} className="text-lg" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Refunds</p>
                                    <Money amount={15000} className="text-lg text-red-500" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">F&C Retain</p>
                                    <Money amount={100000} className="text-lg text-blue-600" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Dev Payable</p>
                                    <Money amount={1100000} className="text-lg text-emerald-600" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
