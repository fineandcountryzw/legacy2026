"use client"

import { useState, useEffect } from "react"
import { Building2, Plus, Edit2, Eye, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/data-table"
import { Money } from "@/components/money"
import { FormModal } from "@/components/form-modal"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { ColorPicker } from "@/components/color-picker"
import { ReportHeaderPreview } from "@/components/report-header-preview"
import { Development } from "@/types"
import { createDevelopment } from "./actions"

export default function DevelopmentsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedDev, setSelectedDev] = useState<Partial<Development> | null>(null)
    const [developments, setDevelopments] = useState<Development[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Fetch developments on mount
    useEffect(() => {
        fetchDevelopments()
    }, [])

    async function fetchDevelopments() {
        try {
            setLoading(true)
            setError(null)
            const response = await fetch("/api/developments")
            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.details || errorData.error || "Failed to fetch developments")
            }
            const data = await response.json()
            setDevelopments(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred")
        } finally {
            setLoading(false)
        }
    }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setIsSubmitting(true)
        
        try {
            const formData = new FormData(e.currentTarget)
            await createDevelopment(formData)
            setIsModalOpen(false)
            fetchDevelopments()
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to create development")
        } finally {
            setIsSubmitting(false)
        }
    }

    const columns: any[] = [
        {
            header: "Name",
            accessorKey: "name",
            cell: (row: Development) => <span className="font-semibold">{row.name}</span>
        },
        { header: "Code", accessorKey: "code" },
        { header: "Currency", accessorKey: "currency" },
        { header: "Stands", accessorKey: "totalStands" },
        {
            header: "Received",
            accessorKey: "totalReceived",
            cell: (row: Development) => <Money amount={row.totalReceived} currency={row.currency} />
        },
        {
            header: "Payable",
            accessorKey: "developerPayable",
            cell: (row: Development) => <Money amount={row.developerPayable} currency={row.currency} className="text-emerald-600" />
        },
        {
            header: "F&C Retain",
            accessorKey: "fineCountryRetain",
            cell: (row: Development) => <Money amount={row.fineCountryRetain} currency={row.currency} className="text-blue-600" />
        },
        {
            header: "Actions",
            id: "actions",
            cell: (row: Development) => (
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedDev(row); setIsModalOpen(true); }}>
                        <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon">
                        <Eye className="h-4 w-4" />
                    </Button>
                </div>
            )
        },
    ]

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex h-[400px] flex-col items-center justify-center gap-4">
                <p className="text-red-500">Error: {error}</p>
                <Button onClick={fetchDevelopments}>Retry</Button>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Developments</h1>
                    <p className="text-muted-foreground">Manage property projects, pricing rules, and branding.</p>
                </div>
                <Button onClick={() => { setSelectedDev(null); setIsModalOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> Add Development
                </Button>
            </div>

            <DataTable columns={columns} data={developments} />

            <FormModal
                title={selectedDev ? "Edit Development" : "Add Development"}
                description="Configure development details, pricing rules, and branding."
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                maxWidth="max-w-4xl"
            >
                <form onSubmit={handleSubmit}>
                    <Tabs defaultValue="basics" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="basics">Basics</TabsTrigger>
                            <TabsTrigger value="types">Stand Types</TabsTrigger>
                            <TabsTrigger value="costs">Cost Items</TabsTrigger>
                            <TabsTrigger value="branding">Branding</TabsTrigger>
                        </TabsList>

                        <TabsContent value="basics" className="space-y-4 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Development Name</Label>
                                    <Input 
                                        id="name" 
                                        name="name" 
                                        placeholder="e.g. Green Valley Estate" 
                                        defaultValue={selectedDev?.name} 
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="code">Code</Label>
                                    <Input 
                                        id="code" 
                                        name="code" 
                                        placeholder="e.g. GVE" 
                                        defaultValue={selectedDev?.code}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="currency">Currency</Label>
                                    <Select name="currency" defaultValue={selectedDev?.currency || "USD"}>
                                        <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="USD">USD - US Dollar</SelectItem>
                                            <SelectItem value="ZIG">ZiG - Zimbabwe Gold</SelectItem>
                                            <SelectItem value="ZAR">ZAR - South African Rand</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="commissionRate">Commission Rate (%)</Label>
                                    <Input 
                                        id="commissionRate" 
                                        name="commissionRate" 
                                        type="number" 
                                        step="0.01"
                                        defaultValue={((selectedDev?.commissionRate || 0.05) * 100).toString()} 
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="developerName">Developer Name</Label>
                                <Input 
                                    id="developerName" 
                                    name="developerName" 
                                    placeholder="Owner/Developer Entity Name" 
                                    defaultValue={selectedDev?.developerName}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="developerContacts">Developer Contacts</Label>
                                <Input 
                                    id="developerContacts" 
                                    name="developerContacts" 
                                    placeholder="Email, phone, etc." 
                                    defaultValue={selectedDev?.developerContacts}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="types" className="pt-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-medium">Stand Types & Pricing</h3>
                                <Button type="button" size="sm" variant="outline">
                                    <Plus className="mr-2 h-3 w-3" /> Add Type
                                </Button>
                            </div>
                            <div className="rounded-md border">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-slate-50 font-medium">
                                            <th className="p-2 text-left">Label</th>
                                            <th className="p-2 text-left">Size (sqm)</th>
                                            <th className="p-2 text-left">Base Price</th>
                                            <th className="p-2 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b">
                                            <td className="p-2 font-medium">300sqm Corner</td>
                                            <td className="p-2">300</td>
                                            <td className="p-2">$15,000</td>
                                            <td className="p-2 text-right">
                                                <Button type="button" variant="ghost" size="sm">Edit</Button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </TabsContent>

                        <TabsContent value="costs" className="pt-4">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-medium">Cost Items & Fees</h3>
                                <Button type="button" size="sm" variant="outline">
                                    <Plus className="mr-2 h-3 w-3" /> Add Fee
                                </Button>
                            </div>
                            <div className="rounded-md border">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b bg-slate-50 font-medium">
                                            <th className="p-2 text-left">Name</th>
                                            <th className="p-2 text-left">Type</th>
                                            <th className="p-2 text-left">Value</th>
                                            <th className="p-2 text-left">Pay To</th>
                                            <th className="p-2 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b">
                                            <td className="p-2 font-medium">Admin Fee</td>
                                            <td className="p-2 text-slate-500 italic">Fixed</td>
                                            <td className="p-2">$500.00</td>
                                            <td className="p-2">Fine & Country</td>
                                            <td className="p-2 text-right">
                                                <Button type="button" variant="ghost" size="sm">Edit</Button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </TabsContent>

                        <TabsContent value="branding" className="pt-4 space-y-6">
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label>Report Logo</Label>
                                        <div className="flex items-center gap-4">
                                            <div className="h-16 w-16 border-2 border-dashed rounded flex items-center justify-center text-slate-400">
                                                <Plus className="h-6 w-6" />
                                            </div>
                                            <Button type="button" variant="outline" size="sm">Upload Logo</Button>
                                        </div>
                                    </div>
                                    <Separator />
                                    <ColorPicker
                                        label="Primary Brand Color"
                                        value="#0f172a"
                                        onChange={() => { }}
                                    />
                                </div>
                                <div className="space-y-4">
                                    <Label>Report Header Preview</Label>
                                    <ReportHeaderPreview
                                        companyName={selectedDev?.name || "New Development"}
                                        colors={{ primary: "#0f172a", secondary: "#2563eb", accent: "#3b82f6" }}
                                    />
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="mt-8 flex justify-end gap-3">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Development
                        </Button>
                    </div>
                </form>
            </FormModal>
        </div>
    )
}
