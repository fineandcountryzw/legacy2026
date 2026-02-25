"use client"

import { useParams } from "next/navigation"
import { useState, useEffect } from "react"
import { Building2, MapPin, User, FileText, History, PieChart, ShieldCheck, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/status-badge"
import { Money } from "@/components/money"
import { TabbedCard } from "@/components/tabbed-card"
import { DataTable } from "@/components/data-table"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

interface Stand {
    id: string
    standNumber: string
    developmentName: string
    developmentId: string
    standTypeLabel?: string
    status: "Available" | "Sold" | "Unassigned" | "Disputed"
    clientName?: string
    agreedPrice?: number
    totalPaid?: number
    balance?: number
}

interface Transaction {
    id: string
    date: string
    reference: string
    description: string
    amount: number
}

export default function StandDetailPage() {
    const { id } = useParams()
    const [stand, setStand] = useState<Stand | null>(null)
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (id) {
            fetchStandData()
        }
    }, [id])

    const fetchStandData = async () => {
        try {
            setLoading(true)
            // Fetch stand details
            const res = await fetch(`/api/stands/${id}`)
            if (!res.ok) throw new Error("Failed to fetch stand")
            const data = await res.json()
            setStand(data)

            // Fetch transactions for this stand
            const txRes = await fetch(`/api/transactions?standId=${id}`)
            if (txRes.ok) {
                const txData = await txRes.json()
                setTransactions(txData.transactions || [])
            }
        } catch (err) {
            toast.error("Failed to load stand details")
        } finally {
            setLoading(false)
        }
    }

    const paymentColumns: any[] = [
        { header: "Date", accessorKey: "date" },
        { header: "Reference", accessorKey: "reference" },
        { header: "Description", accessorKey: "description", cell: (row: any) => row.description || "Payment" },
        { header: "Amount", accessorKey: "amount", cell: (row: any) => <Money amount={row.amount} /> },
    ]

    const allocationColumns: any[] = [
        {
            header: "Type",
            accessorKey: "type",
            cell: (row: any) => <span className="capitalize">{row.type?.replace("_", " ")}</span>
        },
        {
            header: "Payable To",
            accessorKey: "payTo",
            cell: (row: any) => <Badge variant="outline" className="capitalize">{row.payTo?.replace("_", " ")}</Badge>
        },
        { header: "Amount", accessorKey: "amount", cell: (row: any) => <Money amount={row.amount} /> },
    ]

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        )
    }

    if (!stand) {
        return (
            <div className="text-center py-12">
                <p className="text-slate-500">Stand not found</p>
            </div>
        )
    }

    const tabs = [
        {
            value: "overview",
            label: "Overview",
            content: (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <div>
                            <Label className="text-xs uppercase text-slate-400 font-bold tracking-wider">Property Information</Label>
                            <div className="mt-2 space-y-3">
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-slate-500">Stand Number</span>
                                    <span className="font-bold">{stand.standNumber}</span>
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-slate-500">Development</span>
                                    <span className="font-medium">{stand.developmentName}</span>
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-slate-500">Stand Type</span>
                                    <span className="font-medium">{stand.standTypeLabel || "Standard"}</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs uppercase text-slate-400 font-bold tracking-wider">Financial Summary</Label>
                            <div className="mt-2 space-y-3">
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-slate-500">Agreed Price</span>
                                    <Money amount={stand.agreedPrice || 0} />
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-slate-500">Total Paid</span>
                                    <Money amount={stand.totalPaid || 0} className="text-emerald-600" />
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-slate-500">Remaining Balance</span>
                                    <Money amount={stand.balance || 0} className="text-red-500" />
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="space-y-6">
                        <div>
                            <Label className="text-xs uppercase text-slate-400 font-bold tracking-wider">Client Details</Label>
                            <Card className="mt-2 bg-slate-50 border-none shadow-none">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center border shadow-sm text-slate-400">
                                        <User className="h-6 w-6" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold">{stand.clientName || "Unassigned"}</h4>
                                        <p className="text-xs text-slate-500">Individual Purchaser</p>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        <div>
                            <Label className="text-xs uppercase text-slate-400 font-bold tracking-wider">Status</Label>
                            <div className="mt-2">
                                <StatusBadge status={stand.status} className="px-4 py-1.5 text-sm" />
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        {
            value: "payments",
            label: "Payments",
            content: (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-medium">Transaction History</h3>
                        <Button size="sm" variant="outline"><History className="mr-2 h-4 w-4" /> Export CSV</Button>
                    </div>
                    {transactions.length === 0 ? (
                        <div className="text-center py-8 text-slate-500">
                            <p>No transactions recorded</p>
                        </div>
                    ) : (
                        <DataTable columns={paymentColumns} data={transactions} />
                    )}
                </div>
            )
        },
        {
            value: "allocations",
            label: "Allocations",
            content: (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-sm font-medium">Revenue Distribution</h3>
                            <p className="text-xs text-slate-400">How total paid funds have been allocated.</p>
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline">Edit Allocations</Button>
                            <Button size="sm"><PieChart className="mr-2 h-4 w-4" /> Auto-Allocate</Button>
                        </div>
                    </div>
                    <div className="text-center py-8 text-slate-500">
                        <p>No allocations configured</p>
                    </div>
                    <div className="flex justify-end p-4 bg-slate-50 rounded-lg">
                        <div className="text-right space-y-1">
                            <p className="text-xs text-slate-400 font-bold uppercase">Total Allocated</p>
                            <Money amount={0} className="text-xl" />
                        </div>
                    </div>
                </div>
            )
        },
        {
            value: "statement",
            label: "Statement",
            content: (
                <div className="space-y-6">
                    <div className="flex justify-between items-center">
                        <h3 className="text-sm font-medium">Customer Statement Preview</h3>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline"><FileText className="mr-2 h-4 w-4" /> Preview PDF</Button>
                            <Button size="sm"><ShieldCheck className="mr-2 h-4 w-4" /> Generate & Sign</Button>
                        </div>
                    </div>
                    <div className="aspect-[1/1.4] w-full max-w-2xl mx-auto rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-12 text-slate-300 bg-slate-50">
                        <FileText className="h-16 w-16 mb-4" />
                        <p className="font-medium">Statement PDF Generation Placeholder</p>
                        <p className="text-sm">High-fidelity branded statement will be generated here.</p>
                    </div>
                </div>
            )
        }
    ]

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded bg-slate-900 flex items-center justify-center text-white">
                        <Building2 className="h-6 w-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold tracking-tight">Stand {stand.standNumber}</h1>
                            <StatusBadge status={stand.status} />
                        </div>
                        <p className="text-muted-foreground flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" /> {stand.developmentName}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline">Edit Details</Button>
                    <Button>Assign Client</Button>
                </div>
            </div>

            <TabbedCard tabs={tabs} defaultValue="overview" />
        </div>
    )
}

function Label({ children, className }: { children: React.ReactNode, className?: string }) {
    return <label className={cn("text-sm font-medium leading-none", className)}>{children}</label>
}
