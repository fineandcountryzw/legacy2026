"use client"

import { useState, useEffect } from "react"
import { Building2, Plus, Edit2, Eye, Loader2, Trash2 } from "lucide-react"
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
import { createDevelopment, updateDevelopment, deleteDevelopment } from "./actions"

export default function DevelopmentsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedDev, setSelectedDev] = useState<Partial<Development> | null>(null)
    const [developments, setDevelopments] = useState<Development[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    // Stand types with simplified pricing
    const [standTypes, setStandTypes] = useState<any[]>([])
    // Simplified fees: Legal/AOS combined, Admin, and Commission (fixed deductible)
    const [fees, setFees] = useState({
        legalFee: 0,      // Combined Legal & AOS fee
        adminFee: 0,      // F&C processing fee
        commission: 0,    // Fixed commission deducted from base price for developer payout
    })
    const [colors, setColors] = useState({
        primary: "#0f172a",
        secondary: "#2563eb",
        accent: "#3b82f6"
    })
    // Form field states for controlled inputs
    const [formData, setFormData] = useState({
        name: "",
        code: "",
        currency: "USD",
        developerName: "",
        developerContacts: "",
        email: "",
        phone: "",
        address: "",
        website: "",
    })

    // Fetch developments on mount
    useEffect(() => {
        fetchDevelopments()
    }, [])

    // Sync local state when selectedDev changes
    useEffect(() => {
        console.log("=== selectedDev changed ===", selectedDev?.id, selectedDev?.name)
        if (selectedDev) {
            setStandTypes(selectedDev.standTypes || [])
            // Extract fees from costs array or use defaults
            const costs = selectedDev.costs || []
            setFees({
                legalFee: costs.find((c: any) => c.name?.toLowerCase().includes('legal') || c.name?.toLowerCase().includes('aos'))?.value || 0,
                adminFee: costs.find((c: any) => c.name?.toLowerCase().includes('admin'))?.value || 0,
                commission: (selectedDev as any).commissionFixed || (selectedDev as any).commission_rate || 0,
            })
            setColors({
                primary: (selectedDev as any).primary_color || "#0f172a",
                secondary: (selectedDev as any).secondary_color || "#2563eb",
                accent: (selectedDev as any).accent_color || "#3b82f6"
            })
            // Set form data for controlled inputs
            setFormData({
                name: selectedDev.name || "",
                code: selectedDev.code || "",
                currency: selectedDev.currency || "USD",
                developerName: selectedDev.developerName || "",
                developerContacts: selectedDev.developerContacts || "",
                email: (selectedDev as any).email || "",
                phone: (selectedDev as any).phone || "",
                address: (selectedDev as any).address || "",
                website: (selectedDev as any).website || "",
            })
        } else {
            setStandTypes([])
            setFees({ legalFee: 0, adminFee: 0, commission: 0 })
            setColors({ primary: "#0f172a", secondary: "#2563eb", accent: "#3b82f6" })
            setFormData({
                name: "",
                code: "",
                currency: "USD",
                developerName: "",
                developerContacts: "",
                email: "",
                phone: "",
                address: "",
                website: "",
            })
        }
    }, [selectedDev, isModalOpen])

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
            // Debug: Log form data state
            console.log("=== FORM SUBMISSION ===")
            console.log("Editing:", selectedDev?.id || "NEW")
            console.log("Form data:", formData)

            // Ensure required fields have values
            if (!formData.name || formData.name.trim() === "") {
                throw new Error("Development name is required")
            }
            if (!formData.code || formData.code.trim() === "") {
                throw new Error("Development code is required")
            }

            // Build FormData for server action
            const serverFormData = new FormData()
            serverFormData.append("name", formData.name)
            serverFormData.append("code", formData.code)
            serverFormData.append("currency", formData.currency)
            serverFormData.append("developerName", formData.developerName)
            serverFormData.append("developerContacts", formData.developerContacts)
            serverFormData.append("email", formData.email)
            serverFormData.append("phone", formData.phone)
            serverFormData.append("address", formData.address)
            serverFormData.append("website", formData.website)

            // Build costs array from simplified fees
            const costs = [
                ...(fees.legalFee > 0 ? [{ name: "Legal/AOS Fee", type: "fixed", value: fees.legalFee, payTo: "third_party", appliesTo: "all" }] : []),
                ...(fees.adminFee > 0 ? [{ name: "Admin Fee", type: "fixed", value: fees.adminFee, payTo: "fine_country", appliesTo: "all" }] : []),
            ]
            
            // Add fixed commission to form data (for developer payout calculation)
            serverFormData.append("commissionFixed", fees.commission.toString())
            
            // Add serialized dynamic data
            serverFormData.append("standTypes", JSON.stringify(standTypes))
            serverFormData.append("costs", JSON.stringify(costs))
            serverFormData.append("primaryColor", colors.primary)
            serverFormData.append("secondaryColor", colors.secondary)
            serverFormData.append("accentColor", colors.accent)

            if (selectedDev?.id) {
                await updateDevelopment(selectedDev.id, serverFormData)
            } else {
                await createDevelopment(serverFormData)
            }

            setIsModalOpen(false)
            fetchDevelopments()
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to save development")
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
            header: "Actions",
            id: "actions",
            cell: (row: Development) => (
                <div className="flex gap-2">
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedDev(row); setIsModalOpen(true); }}>
                        <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={async () => {
                        if (confirm("Are you sure you want to delete this development?")) {
                            await deleteDevelopment(row.id!)
                            fetchDevelopments()
                        }
                    }}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            )
        },
    ]

    const addStandType = () => {
        setStandTypes([...standTypes, { label: "Standard Plot", sizeSqm: 300, basePrice: 0 }])
    }

    const removeStandType = (index: number) => {
        setStandTypes(standTypes.filter((_, i) => i !== index))
    }

    const updateStandType = (index: number, field: string, value: any) => {
        const newTypes = [...standTypes]
        newTypes[index] = { ...newTypes[index], [field]: value }
        setStandTypes(newTypes)
    }

    if (loading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
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
                maxWidth="max-w-5xl"
            >
                <form 
                    key={selectedDev?.id || 'new'} 
                    onSubmit={handleSubmit} 
                    className="space-y-6"
                >
                    <Tabs defaultValue="basics" className="w-full">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="basics">Basics</TabsTrigger>
                            <TabsTrigger value="pricing">Pricing & Fees</TabsTrigger>
                            <TabsTrigger value="branding">Branding</TabsTrigger>
                        </TabsList>

                        <TabsContent value="basics" className="space-y-6 pt-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Development Name *</Label>
                                    <Input 
                                        id="name" 
                                        name="name" 
                                        value={formData.name}
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        placeholder="e.g., Lakeview Estate"
                                        required 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="code">Unique Code (Short) *</Label>
                                    <Input 
                                        id="code" 
                                        name="code" 
                                        value={formData.code}
                                        onChange={(e) => setFormData({...formData, code: e.target.value})}
                                        placeholder="e.g., LKEV"
                                        required 
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="currency">Base Currency</Label>
                                    <Select 
                                        name="currency" 
                                        value={formData.currency}
                                        onValueChange={(value) => setFormData({...formData, currency: value})}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="USD">USD - US Dollar</SelectItem>
                                            <SelectItem value="ZIG">ZiG - Zimbabwe Gold</SelectItem>
                                            <SelectItem value="ZAR">ZAR - South African Rand</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <Separator />

                            <div className="space-y-4">
                                <h3 className="font-semibold text-sm uppercase tracking-wider text-slate-500">Contact & Entity Details</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="developerName">Developer/Owner Entity</Label>
                                        <Input 
                                            id="developerName" 
                                            name="developerName" 
                                            value={formData.developerName}
                                            onChange={(e) => setFormData({...formData, developerName: e.target.value})}
                                            required 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="developerContacts">Primary Contacts</Label>
                                        <Input 
                                            id="developerContacts" 
                                            name="developerContacts" 
                                            value={formData.developerContacts}
                                            onChange={(e) => setFormData({...formData, developerContacts: e.target.value})}
                                            placeholder="Phone, Support name" 
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Official Email</Label>
                                        <Input 
                                            id="email" 
                                            name="email" 
                                            type="email" 
                                            value={formData.email}
                                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="phone">Official Phone</Label>
                                        <Input 
                                            id="phone" 
                                            name="phone" 
                                            value={formData.phone}
                                            onChange={(e) => setFormData({...formData, phone: e.target.value})}
                                        />
                                    </div>
                                    <div className="col-span-2 space-y-2">
                                        <Label htmlFor="address">Physical Address</Label>
                                        <Input 
                                            id="address" 
                                            name="address" 
                                            value={formData.address}
                                            onChange={(e) => setFormData({...formData, address: e.target.value})}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="website">Website URL</Label>
                                        <Input 
                                            id="website" 
                                            name="website" 
                                            value={formData.website}
                                            onChange={(e) => setFormData({...formData, website: e.target.value})}
                                        />
                                    </div>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="pricing" className="pt-4 space-y-6">
                            {/* Base Price Section */}
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-medium">Base Stand Price</h3>
                                        <p className="text-xs text-slate-500">Default price for stands in this development</p>
                                    </div>
                                    <Button 
                                        type="button" 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={() => setStandTypes([...standTypes, { label: "Standard Plot", sizeSqm: 300, basePrice: 0 }])}
                                    >
                                        <Plus className="mr-2 h-3 w-3" /> Add Price Tier
                                    </Button>
                                </div>
                                
                                {standTypes.length === 0 ? (
                                    <div className="rounded-lg border border-dashed border-slate-300 p-6 text-center">
                                        <p className="text-sm text-slate-500 mb-3">No pricing set yet</p>
                                        <Button 
                                            type="button" 
                                            variant="outline" 
                                            onClick={() => setStandTypes([{ label: "Standard Plot", sizeSqm: 300, basePrice: 0 }])}
                                        >
                                            Set Base Price
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="grid gap-3">
                                        {standTypes.map((st, i) => (
                                            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-slate-50">
                                                <div className="flex-1">
                                                    <Label className="text-xs text-slate-500">Label</Label>
                                                    <Input 
                                                        value={st.label} 
                                                        onChange={(e) => updateStandType(i, "label", e.target.value)}
                                                        className="h-8"
                                                        placeholder="e.g., Standard Plot"
                                                    />
                                                </div>
                                                <div className="w-24">
                                                    <Label className="text-xs text-slate-500">Size (sqm)</Label>
                                                    <Input 
                                                        type="number" 
                                                        value={st.sizeSqm} 
                                                        onChange={(e) => updateStandType(i, "sizeSqm", parseFloat(e.target.value) || 0)}
                                                        className="h-8"
                                                    />
                                                </div>
                                                <div className="w-32">
                                                    <Label className="text-xs text-slate-500">Base Price ($)</Label>
                                                    <Input 
                                                        type="number" 
                                                        value={st.basePrice} 
                                                        onChange={(e) => updateStandType(i, "basePrice", parseFloat(e.target.value) || 0)}
                                                        className="h-8"
                                                        placeholder="0"
                                                    />
                                                </div>
                                                <Button 
                                                    type="button" 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="text-red-500 mt-5" 
                                                    onClick={() => removeStandType(i)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <Separator />

                            {/* Standard Fees Section */}
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-medium">Standard Fees & Deductions</h3>
                                    <p className="text-xs text-slate-500">Fees shown on client statements and commission deducted for developer payouts</p>
                                </div>
                                
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="p-4 rounded-lg border bg-amber-50 border-amber-200">
                                        <Label className="text-xs text-amber-600 font-medium">Legal & AOS Fee</Label>
                                        <p className="text-xs text-amber-500 mb-2">Combined legal fee</p>
                                        <Input
                                            type="number"
                                            value={fees.legalFee || ""}
                                            onChange={(e) => setFees({ ...fees, legalFee: parseFloat(e.target.value) || 0 })}
                                            className="h-8 bg-white"
                                            placeholder="0"
                                        />
                                    </div>
                                    
                                    <div className="p-4 rounded-lg border bg-purple-50 border-purple-200">
                                        <Label className="text-xs text-purple-600 font-medium">Admin Fee</Label>
                                        <p className="text-xs text-purple-500 mb-2">F&C processing fee</p>
                                        <Input
                                            type="number"
                                            value={fees.adminFee || ""}
                                            onChange={(e) => setFees({ ...fees, adminFee: parseFloat(e.target.value) || 0 })}
                                            className="h-8 bg-white"
                                            placeholder="0"
                                        />
                                    </div>
                                    
                                    <div className="p-4 rounded-lg border bg-emerald-50 border-emerald-200">
                                        <Label className="text-xs text-emerald-600 font-medium">F&C Commission</Label>
                                        <p className="text-xs text-emerald-500 mb-2">Fixed amount deducted from base price</p>
                                        <Input
                                            type="number"
                                            value={fees.commission || ""}
                                            onChange={(e) => setFees({ ...fees, commission: parseFloat(e.target.value) || 0 })}
                                            className="h-8 bg-white"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                
                                <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                                    <span className="font-medium">How it works:</span> Legal & Admin fees appear on client statements. 
                                    The F&C Commission is a fixed amount deducted from the base price to calculate net developer payout 
                                    (e.g., $5,000 commission on $100,000 stand = $5,000 retained by F&C, $95,000 paid to developer).
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="branding" className="pt-4 space-y-6">
                            <div className="grid grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="space-y-4">
                                        <ColorPicker
                                            label="Primary Color"
                                            value={colors.primary}
                                            onChange={(val) => setColors({ ...colors, primary: val })}
                                        />
                                        <ColorPicker
                                            label="Secondary Color"
                                            value={colors.secondary}
                                            onChange={(val) => setColors({ ...colors, secondary: val })}
                                        />
                                        <ColorPicker
                                            label="Accent Color"
                                            value={colors.accent}
                                            onChange={(val) => setColors({ ...colors, accent: val })}
                                        />
                                    </div>
                                    <Separator />
                                    <div className="p-4 bg-slate-50 rounded-lg space-y-2">
                                        <h4 className="text-xs font-bold uppercase text-slate-400">Branding Strategy</h4>
                                        <p className="text-xs text-slate-500 leading-relaxed">
                                            These colors will be used for specific project reports, invoices, and payment receipts.
                                            Project-specific branding overrides the default agency branding.
                                        </p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <Label className="text-slate-400 uppercase text-[10px] font-bold">Standard Header Preview</Label>
                                    <ReportHeaderPreview
                                        companyName={selectedDev?.name || "New Development"}
                                        colors={colors}
                                    />
                                    <div className="mt-4 border rounded-xl overflow-hidden shadow-sm">
                                        <div className="bg-slate-900 p-2 text-white text-[10px] flex justify-between">
                                            <span>Document Simulation</span>
                                            <span className="opacity-50">Invoice #INV-001</span>
                                        </div>
                                        <div className="p-4 space-y-3 bg-white">
                                            <div className="flex gap-2">
                                                <div className="w-12 h-1 bg-slate-100 rounded" style={{ backgroundColor: colors.primary }}></div>
                                                <div className="w-8 h-1 bg-slate-100 rounded" style={{ backgroundColor: colors.secondary }}></div>
                                            </div>
                                            <div className="h-2 w-full bg-slate-50 rounded"></div>
                                            <div className="h-2 w-3/4 bg-slate-50 rounded"></div>
                                            <div className="h-2 w-1/2 bg-slate-50 rounded"></div>
                                            <div className="pt-4 flex justify-between">
                                                <div className="w-20 h-6 rounded" style={{ backgroundColor: colors.primary }}></div>
                                                <div className="w-12 h-6 rounded border"></div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="mt-8 flex justify-end gap-3 pt-6 border-t">
                        <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isSubmitting} className="min-w-[140px]">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {selectedDev ? "Update Project" : "Create Project"}
                        </Button>
                    </div>
                </form>
            </FormModal>
        </div>
    )
}
