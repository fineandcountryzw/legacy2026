"use client"

import { useParams, useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Building2, MapPin, User, FileText, History, PieChart, ShieldCheck, Loader2, Edit2, X, Check, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

interface Development {
    id: string
    name: string
    code: string
}

interface Client {
    id: string
    name: string
    email?: string
    phone?: string
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
    const router = useRouter()
    const [stand, setStand] = useState<Stand | null>(null)
    const [transactions, setTransactions] = useState<Transaction[]>([])
    const [loading, setLoading] = useState(true)
    
    // Dialog states
    const [showAssignClient, setShowAssignClient] = useState(false)
    const [showAssignDevelopment, setShowAssignDevelopment] = useState(false)
    const [showEditDetails, setShowEditDetails] = useState(false)
    
    // Data for dialogs
    const [clients, setClients] = useState<Client[]>([])
    const [developments, setDevelopments] = useState<Development[]>([])
    const [loadingClients, setLoadingClients] = useState(false)
    const [loadingDevelopments, setLoadingDevelopments] = useState(false)
    const [assigningClient, setAssigningClient] = useState(false)
    const [assigningDevelopment, setAssigningDevelopment] = useState(false)
    
    // Form states
    const [selectedClient, setSelectedClient] = useState<string>("")
    const [newClientName, setNewClientName] = useState("")
    const [selectedDevelopment, setSelectedDevelopment] = useState<string>("")
    const [assignAgreedPrice, setAssignAgreedPrice] = useState<string>("")
    const [editForm, setEditForm] = useState({
        agreedPrice: "",
        status: ""
    })

    useEffect(() => {
        if (id) {
            fetchStandData()
        }
    }, [id])

    const fetchStandData = async () => {
        try {
            setLoading(true)
            const res = await fetch(`/api/stands/${id}`)
            if (!res.ok) throw new Error("Failed to fetch stand")
            const data = await res.json()
            setStand(data)
            setEditForm({
                agreedPrice: data.agreedPrice?.toString() || "",
                status: data.status || "Available"
            })

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

    const fetchClients = async () => {
        try {
            setLoadingClients(true)
            const res = await fetch("/api/clients")
            if (res.ok) {
                const data = await res.json()
                setClients(data.clients || [])
            }
        } catch (err) {
            console.error("Failed to fetch clients:", err)
        } finally {
            setLoadingClients(false)
        }
    }

    const fetchDevelopments = async () => {
        try {
            setLoadingDevelopments(true)
            const res = await fetch("/api/developments")
            if (res.ok) {
                const data = await res.json()
                setDevelopments(data)
            }
        } catch (err) {
            console.error("Failed to fetch developments:", err)
        } finally {
            setLoadingDevelopments(false)
        }
    }

    const handleAssignClient = async () => {
        setAssigningClient(true)
        let clientName: string;
        let clientId: string | null = null;
        
        if (selectedClient === "new") {
            // Creating a new client
            clientName = newClientName.trim();
            
            if (!clientName) {
                toast.error("Please enter a client name")
                setAssigningClient(false)
                return
            }
            
            try {
                // First create the client
                const createRes = await fetch("/api/clients", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: clientName })
                })
                
                if (!createRes.ok) {
                    const error = await createRes.json()
                    throw new Error(error.error || "Failed to create client")
                }
                
                const newClient = await createRes.json()
                clientId = newClient.id
                clientName = newClient.name
                
            } catch (err: any) {
                toast.error(err.message || "Failed to create client")
                setAssigningClient(false)
                return
            }
        } else if (selectedClient) {
            // Selecting existing client
            const selected = clients.find(c => c.id === selectedClient)
            if (!selected) {
                toast.error("Please select a client")
                setAssigningClient(false)
                return
            }
            clientName = selected.name
            clientId = selected.id
        } else {
            toast.error("Please select or enter a client")
            setAssigningClient(false)
            return
        }

        try {
            // Assign client to stand
            const res = await fetch(`/api/stands/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientName, clientId })
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || "Failed to assign client")
            }
            
            toast.success("Client assigned successfully")
            setShowAssignClient(false)
            setSelectedClient("")
            setNewClientName("")
            await fetchStandData()
        } catch (err: any) {
            toast.error(err.message || "Failed to assign client")
        } finally {
            setAssigningClient(false)
        }
    }

    const handleAssignDevelopment = async () => {
        if (!selectedDevelopment) {
            toast.error("Please select a development")
            return
        }

        setAssigningDevelopment(true)

        try {
            const res = await fetch(`/api/stands/${id}/move`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    developmentId: selectedDevelopment,
                    clientName: stand?.clientName,
                    agreedPrice: assignAgreedPrice ? parseFloat(assignAgreedPrice) : 0
                })
            })

            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || error.details || "Failed to assign development")
            }
            
            const result = await res.json()
            toast.success("Development assigned successfully")
            setShowAssignDevelopment(false)
            setSelectedDevelopment("")
            setAssignAgreedPrice("")
            
            // If this was a standalone stand, redirect to new URL with proper ID
            if (id?.toString().startsWith("standalone-")) {
                router.push(`/dashboard/stands/${result.id}`)
            } else {
                await fetchStandData()
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to assign development")
        } finally {
            setAssigningDevelopment(false)
        }
    }

    const handleUpdateDetails = async () => {
        try {
            const res = await fetch(`/api/stands/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    agreedPrice: parseFloat(editForm.agreedPrice) || 0,
                    status: editForm.status
                })
            })

            if (!res.ok) throw new Error("Failed to update details")
            
            toast.success("Details updated successfully")
            setShowEditDetails(false)
            fetchStandData()
        } catch (err) {
            toast.error("Failed to update details")
        }
    }

    const openAssignClient = () => {
        fetchClients()
        // Reset form state
        setSelectedClient("")
        setNewClientName("")
        setShowAssignClient(true)
    }

    const openAssignDevelopment = async () => {
        setShowAssignDevelopment(true)
        setLoadingDevelopments(true)
        try {
            const res = await fetch("/api/developments")
            if (res.ok) {
                const data = await res.json()
                console.log("Loaded developments:", data.length)
                setDevelopments(data)
                // Pre-select current development if assigned
                if (stand?.developmentId) {
                    setSelectedDevelopment(stand.developmentId)
                }
            } else {
                toast.error("Failed to load developments")
            }
        } catch (err) {
            console.error("Failed to fetch developments:", err)
            toast.error("Failed to load developments")
        } finally {
            setLoadingDevelopments(false)
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
                                    <span className="font-medium">{stand.developmentName || "Unassigned"}</span>
                                </div>
                                <div className="flex justify-between border-b pb-2">
                                    <span className="text-slate-500">Stand Type</span>
                                    <span className="font-medium">{stand.standTypeLabel || "Standard"}</span>
                                </div>
                            </div>
                        </div>
                        <div>
                            <Label className="text-xs uppercase text-slate-400 font-bold tracking-wider">Financial Summary</Label>
                            <div className="mt-4 space-y-4">
                                {/* Payment Progress */}
                                <div className="bg-slate-50 rounded-lg p-4">
                                    <div className="flex justify-between text-sm mb-2">
                                        <span className="text-slate-600">Payment Progress</span>
                                        <span className="font-medium">
                                            {stand.agreedPrice && stand.agreedPrice > 0 
                                                ? Math.min(100, Math.round(((stand.totalPaid || 0) / stand.agreedPrice) * 100))
                                                : 0}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-200 rounded-full h-2.5">
                                        <div 
                                            className="bg-emerald-500 h-2.5 rounded-full transition-all"
                                            style={{ 
                                                width: `${stand.agreedPrice && stand.agreedPrice > 0 
                                                    ? Math.min(100, ((stand.totalPaid || 0) / stand.agreedPrice) * 100)
                                                    : 0}%` 
                                            }}
                                        />
                                    </div>
                                </div>
                                
                                {/* Financial Breakdown */}
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg border border-blue-100">
                                        <div>
                                            <span className="text-sm text-blue-600 font-medium">Agreed Price</span>
                                            <p className="text-xs text-blue-400">Total stand price</p>
                                        </div>
                                        <Money amount={stand.agreedPrice || 0} className="text-lg font-bold text-blue-700" />
                                    </div>
                                    
                                    <div className="flex justify-between items-center p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                                        <div>
                                            <span className="text-sm text-emerald-600 font-medium">Total Paid</span>
                                            <p className="text-xs text-emerald-400">Client payments received</p>
                                        </div>
                                        <Money amount={stand.totalPaid || 0} className="text-lg font-bold text-emerald-700" />
                                    </div>
                                    
                                    <div className={`flex justify-between items-center p-3 rounded-lg border ${(stand.balance || 0) > 0 ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'}`}>
                                        <div>
                                            <span className={`text-sm font-medium ${(stand.balance || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                {(stand.balance || 0) > 0 ? 'Outstanding Balance' : 'Fully Paid'}
                                            </span>
                                            <p className={`text-xs ${(stand.balance || 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                                                {(stand.balance || 0) > 0 ? 'Amount still due' : 'All payments received'}
                                            </p>
                                        </div>
                                        <Money 
                                            amount={Math.abs(stand.balance || 0)} 
                                            className={`text-lg font-bold ${(stand.balance || 0) > 0 ? 'text-amber-700' : 'text-emerald-700'}`} 
                                        />
                                    </div>
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
                                    <div className="flex-1">
                                        <h4 className="font-bold">{stand.clientName || "Unassigned"}</h4>
                                        <p className="text-xs text-slate-500">Individual Purchaser</p>
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={openAssignClient}
                                    >
                                        {stand.clientName ? "Change" : "Assign"}
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                        <div>
                            <Label className="text-xs uppercase text-slate-400 font-bold tracking-wider">Development</Label>
                            <Card className="mt-2 bg-slate-50 border-none shadow-none">
                                <CardContent className="p-4 flex items-center gap-4">
                                    <div className="h-12 w-12 rounded-full bg-white flex items-center justify-center border shadow-sm text-slate-400">
                                        <Building2 className="h-6 w-6" />
                                    </div>
                                    <div className="flex-1">
                                        <h4 className="font-bold">{stand.developmentName || "Unassigned"}</h4>
                                        <p className="text-xs text-slate-500">Property Development</p>
                                    </div>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        onClick={openAssignDevelopment}
                                    >
                                        {stand.developmentName ? "Change" : "Assign"}
                                    </Button>
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
                            <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/statements?stand=${stand.id}`)}>
                                <FileText className="mr-2 h-4 w-4" /> View Full Statement
                            </Button>
                        </div>
                    </div>
                    <div className="aspect-[1/1.4] w-full max-w-2xl mx-auto rounded-lg border-2 border-dashed flex flex-col items-center justify-center p-12 text-slate-400 bg-slate-50">
                        <FileText className="h-16 w-16 mb-4" />
                        <p className="font-medium">Statement Preview</p>
                        <p className="text-sm">Click &quot;View Full Statement&quot; to see detailed statement</p>
                    </div>
                </div>
            )
        }
    ]

    return (
        <div className="space-y-8">
            {/* Header */}
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
                            <MapPin className="h-3.5 w-3.5" /> {stand.developmentName || "No development assigned"}
                        </p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setShowEditDetails(true)}>
                        <Edit2 className="h-4 w-4 mr-2" />
                        Edit Details
                    </Button>
                    <Button onClick={openAssignClient}>
                        <User className="h-4 w-4 mr-2" />
                        {stand.clientName ? "Change Client" : "Assign Client"}
                    </Button>
                </div>
            </div>

            <TabbedCard tabs={tabs} defaultValue="overview" />

            {/* Assign Client Dialog */}
            <Dialog open={showAssignClient} onOpenChange={setShowAssignClient}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Assign Client</DialogTitle>
                        <DialogDescription>
                            Select an existing client or enter a new client name.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Select Client</Label>
                            <Select value={selectedClient} onValueChange={setSelectedClient}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Choose a client..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="new">+ Create New Client</SelectItem>
                                    {clients.map(client => (
                                        <SelectItem key={client.id} value={client.id}>
                                            {client.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        
                        {selectedClient === "new" && (
                            <div className="space-y-2">
                                <Label>New Client Name</Label>
                                <Input 
                                    value={newClientName}
                                    onChange={(e) => setNewClientName(e.target.value)}
                                    placeholder="Enter client name"
                                />
                            </div>
                        )}
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowAssignClient(false)} disabled={assigningClient}>
                            Cancel
                        </Button>
                        <Button onClick={handleAssignClient} disabled={assigningClient || !selectedClient}>
                            {assigningClient && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {selectedClient === "new" ? "Create & Assign" : "Assign Client"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Assign Development Dialog */}
            <Dialog open={showAssignDevelopment} onOpenChange={setShowAssignDevelopment}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Assign Development</DialogTitle>
                        <DialogDescription>
                            Select the development this stand belongs to.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <Label>Select Development</Label>
                                {loadingDevelopments && <Loader2 className="h-4 w-4 animate-spin" />}
                            </div>
                            {loadingDevelopments ? (
                                <div className="flex items-center gap-2 p-2 border rounded text-sm text-slate-500">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Loading developments...
                                </div>
                            ) : developments.length === 0 ? (
                                <div className="p-4 text-sm text-slate-500 text-center border rounded">
                                    No developments found.<br/>
                                    <Button 
                                        variant="link" 
                                        size="sm" 
                                        onClick={() => {
                                            setShowAssignDevelopment(false)
                                            router.push("/dashboard/developments")
                                        }}
                                    >
                                        Create a Development first
                                    </Button>
                                </div>
                            ) : (
                                <select
                                    className="w-full h-10 px-3 border rounded-md bg-white"
                                    value={selectedDevelopment}
                                    onChange={(e) => {
                                        console.log("Selected development:", e.target.value)
                                        setSelectedDevelopment(e.target.value)
                                    }}
                                >
                                    <option value="">Choose a development...</option>
                                    {developments.map(dev => (
                                        <option key={dev.id} value={dev.id}>
                                            {dev.name} ({dev.code})
                                        </option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label>Agreed Price</Label>
                            <Input
                                type="number"
                                placeholder="Enter agreed price"
                                value={assignAgreedPrice}
                                onChange={(e) => setAssignAgreedPrice(e.target.value)}
                            />
                            <p className="text-xs text-slate-500">
                                The total agreed price for this stand (used to calculate balance and payment progress)
                            </p>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => { setShowAssignDevelopment(false); setAssignAgreedPrice(""); }} disabled={assigningDevelopment}>
                            Cancel
                        </Button>
                        <Button onClick={handleAssignDevelopment} disabled={assigningDevelopment || !selectedDevelopment}>
                            {assigningDevelopment && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            Assign Development
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Details Dialog */}
            <Dialog open={showEditDetails} onOpenChange={setShowEditDetails}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Edit Stand Details</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Agreed Price (Total Stand Price)</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                                <Input 
                                    type="number"
                                    className="pl-7"
                                    value={editForm.agreedPrice}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, agreedPrice: e.target.value }))}
                                    placeholder="Enter total agreed price for this stand"
                                />
                            </div>
                            <p className="text-xs text-slate-500">
                                This is the total price the client agreed to pay for the stand.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <Label>Status</Label>
                            <Select value={editForm.status} onValueChange={(val) => setEditForm(prev => ({ ...prev, status: val }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Available">Available</SelectItem>
                                    <SelectItem value="Sold">Sold</SelectItem>
                                    <SelectItem value="Reserved">Reserved</SelectItem>
                                    <SelectItem value="Disputed">Disputed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setShowEditDetails(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleUpdateDetails}>
                            Save Changes
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

function Label({ children, className }: { children: React.ReactNode, className?: string }) {
    return <label className={cn("text-sm font-medium leading-none", className)}>{children}</label>
}
