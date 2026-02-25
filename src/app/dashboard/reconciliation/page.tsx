"use client"

import { useState, useEffect } from "react"
import { Search, CheckCircle2, AlertCircle, ArrowRight, Save, Calculator, RefreshCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable } from "@/components/data-table"
import { Money } from "@/components/money"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

interface Development {
    id: string
    name: string
    code: string
}

interface Transaction {
    id: string
    date: string
    amount: number
    reference: string
    status: string
    description?: string
}

interface Stand {
    id: string
    standNumber: string
    clientName?: string
    status: string
}

export default function ReconciliationPage() {
    const [developments, setDevelopments] = useState<Development[]>([])
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [stands, setStands] = useState<Stand[]>([])
    const [selectedDevelopment, setSelectedDevelopment] = useState<string>("")
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
    const [matchingStand, setMatchingStand] = useState<Stand | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchDevelopments()
    }, [])

    useEffect(() => {
        if (selectedDevelopment) {
            fetchData(selectedDevelopment)
        }
    }, [selectedDevelopment])

    const fetchDevelopments = async () => {
        try {
            const res = await fetch("/api/developments")
            if (!res.ok) throw new Error("Failed to fetch developments")
            const data = await res.json()
            setDevelopments(data)
            if (data.length > 0) {
                setSelectedDevelopment(data[0].id)
            }
        } catch (err) {
            toast.error("Failed to load developments")
        }
    }

    const fetchData = async (devId: string) => {
        setLoading(true)
        try {
            // Fetch unmatched transactions
            const txRes = await fetch(`/api/uploads?developmentId=${devId}&status=Unmatched`)
            if (txRes.ok) {
                const txData = await txRes.json()
                setTransactions(txData.transactions || [])
            }

            // Fetch stands for this development
            const standsRes = await fetch(`/api/developments/${devId}`)
            if (standsRes.ok) {
                const standsData = await standsRes.json()
                setStands(standsData.stands || [])
            }
        } catch (err) {
            console.error(err)
        } finally {
            setLoading(false)
        }
    }

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

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Reconciliation</h1>
                    <p className="text-muted-foreground">Match bank transactions to stands and allocate funds.</p>
                </div>
                <div className="flex gap-3">
                    <Select value={selectedDevelopment} onValueChange={setSelectedDevelopment}>
                        <SelectTrigger className="w-[250px] bg-white">
                            <SelectValue placeholder="Select Development" />
                        </SelectTrigger>
                        <SelectContent>
                            {developments.map(dev => (
                                <SelectItem key={dev.id} value={dev.id}>{dev.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => fetchData(selectedDevelopment)}>
                        <RefreshCw className="mr-2 h-4 w-4" /> Refresh
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Unmatched Transactions */}
                <div className="lg:col-span-5 space-y-4">
                    <Card className="h-full">
                        <CardHeader className="pb-3 border-b bg-slate-50/50">
                            <CardTitle className="text-sm font-bold flex items-center justify-between">
                                <span>Unmatched Transactions</span>
                                <Badge variant="destructive">{transactions.length} Pending</Badge>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {transactions.length === 0 ? (
                                <div className="p-8 text-center text-slate-500">
                                    <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-emerald-500" />
                                    <p>No unmatched transactions</p>
                                </div>
                            ) : (
                                <DataTable
                                    columns={unmatchedColumns}
                                    data={transactions}
                                    pagination={false}
                                />
                            )}
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
                            {selectedTransaction ? (
                                <>
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
                                            {matchingStand ? (
                                                <Card className="bg-slate-50 border-dashed p-2 text-sm flex items-center justify-between">
                                                    <div>
                                                        <span className="font-bold">Stand {matchingStand.standNumber}</span>
                                                        <span className="text-slate-500 ml-2">{matchingStand.clientName}</span>
                                                    </div>
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                </Card>
                                            ) : (
                                                <Card className="bg-slate-50 border-dashed p-2 text-sm text-slate-400">
                                                    Select a stand to match
                                                </Card>
                                            )}
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
                                                    <Input type="number" defaultValue={0} className="pl-7" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Commission (5%)</Label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
                                                    <Input type="number" defaultValue={0} className="pl-7" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Admin Fee</Label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
                                                    <Input type="number" defaultValue={0} className="pl-7" />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-xs">Legal Fee</Label>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm">$</span>
                                                    <Input type="number" defaultValue={0} className="pl-7" />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-4 bg-emerald-50 rounded-lg flex items-center justify-between border border-emerald-100">
                                            <div className="flex items-center gap-2 text-emerald-800">
                                                <AlertCircle className="h-5 w-5" />
                                                <span className="text-sm font-bold">Allocation Pending</span>
                                            </div>
                                            <div className="text-right">
                                                <span className="text-[10px] uppercase font-bold text-emerald-600 block">Total</span>
                                                <Money amount={0} className="text-emerald-900 font-bold" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-3 pt-4 border-t">
                                        <Button variant="outline" onClick={() => setSelectedTransaction(null)}>Cancel</Button>
                                        <Button className="bg-blue-600 hover:bg-blue-700">
                                            <Save className="mr-2 h-4 w-4" /> Save Allocation
                                        </Button>
                                    </div>
                                </>
                            ) : (
                                <div className="text-center py-12 text-slate-400">
                                    <Calculator className="h-12 w-12 mx-auto mb-4" />
                                    <p>Select a transaction to start matching</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
