"use client"

import { useState, useRef, useEffect } from "react"
import { Building2, Upload, Palette, ShieldCheck, Globe, Image, X, Loader2, Sparkles, CheckCircle2, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ColorPicker } from "@/components/color-picker"
import { ReportHeaderPreview } from "@/components/report-header-preview"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import { getBrandProfile, saveBrandProfile } from "./actions"

const PRESETS = [
    { name: "Fine & Country", primary: "#0f172a", secondary: "#c5a059", accent: "#c5a059" },
    { name: "Executive Dark", primary: "#1e293b", secondary: "#334155", accent: "#64748b" },
    { name: "Modern Vibrant", primary: "#4f46e5", secondary: "#7c3aed", accent: "#2563eb" },
    { name: "Professional Green", primary: "#064e3b", secondary: "#065f46", accent: "#10b981" },
]

export default function BrandingSettingsPage() {
    const [profile, setProfile] = useState({
        companyName: "",
        primaryColor: "#0f172a",
        secondaryColor: "#2563eb",
        accentColor: "#3b82f6",
        address: "",
        email: "",
        website: "",
    })
    const [logo, setLogo] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [loading, setLoading] = useState(true)
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        async function loadProfile() {
            try {
                const data = await getBrandProfile()
                if (data) {
                    const contacts = data.contact_details as any || {}
                    setProfile({
                        companyName: data.company_name || "",
                        primaryColor: data.primary_color || "#0f172a",
                        secondaryColor: data.secondary_color || "#2563eb",
                        accentColor: data.accent_color || "#3b82f6",
                        address: contacts.address || "",
                        email: contacts.email || "",
                        website: contacts.website || "",
                    })
                    setLogo(data.logo_url)
                }
            } catch (err) {
                toast.error("Failed to load branding settings")
            } finally {
                setLoading(false)
            }
        }
        loadProfile()
    }, [])

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file')
            return
        }

        if (file.size > 2 * 1024 * 1024) {
            toast.error('File size must be less than 2MB')
            return
        }

        setUploading(true)

        try {
            const reader = new FileReader()
            reader.onloadend = () => {
                setLogo(reader.result as string)
                setUploading(false)
                toast.success('Logo uploaded for preview')
            }
            reader.readAsDataURL(file)
        } catch (err) {
            toast.error('Failed to process logo')
            setUploading(false)
        }
    }

    const applyPreset = (preset: typeof PRESETS[0]) => {
        setProfile(prev => ({
            ...prev,
            primaryColor: preset.primary,
            secondaryColor: preset.secondary,
            accentColor: preset.accent,
        }))
        toast.success(`Applied ${preset.name} theme`)
    }

    const handleSave = async () => {
        setSaving(true)
        try {
            await saveBrandProfile({
                ...profile,
                logoUrl: logo
            })
            toast.success('Branding profile saved successfully')
        } catch (err) {
            toast.error('Failed to save branding profile')
            console.error(err)
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="text-sm font-medium text-slate-500">Loading your brand identity...</p>
            </div>
        )
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="h-5 w-5 text-amber-500 fill-amber-500" />
                        <h1 className="text-3xl font-black tracking-tight text-slate-900">Brand Identity</h1>
                    </div>
                    <p className="text-slate-500 font-medium">Elevate your reports and customer statements with premium branding.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button variant="outline" className="font-bold">Discard</Button>
                    <Button
                        className="bg-slate-900 shadow-lg shadow-slate-200"
                        onClick={handleSave}
                        disabled={saving}
                    >
                        {saving ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <ShieldCheck className="mr-2 h-4 w-4" />
                        )}
                        {saving ? "Saving..." : "Save Identity"}
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 space-y-6">
                    {/* Style Presets */}
                    <Card className="border-none shadow-xl shadow-slate-200/50 overflow-hidden">
                        <div className="h-1 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                        <CardHeader>
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Palette className="h-4 w-4 text-indigo-500" /> Style Presets
                            </CardTitle>
                            <CardDescription>Quick-apply curated color palettes for a professional look.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {PRESETS.map(preset => (
                                    <button
                                        key={preset.name}
                                        onClick={() => applyPreset(preset)}
                                        className="group relative flex flex-col items-center gap-2 p-3 rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-all text-center"
                                    >
                                        <div className="flex -space-x-1.5">
                                            <div className="h-6 w-6 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: preset.primary }} />
                                            <div className="h-6 w-6 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: preset.secondary }} />
                                            <div className="h-6 w-6 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: preset.accent }} />
                                        </div>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 group-hover:text-indigo-600 transition-colors">
                                            {preset.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl shadow-slate-200/50">
                        <CardHeader>
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-blue-500" /> Core Assets
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                <div className="md:col-span-1">
                                    <Label className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3 block">Company Logo</Label>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleLogoUpload}
                                        accept="image/*"
                                        className="hidden"
                                    />

                                    {logo ? (
                                        <div className="group relative h-32 w-full rounded-2xl border-2 border-slate-100 bg-slate-50/50 flex items-center justify-center p-4 overflow-hidden transition-all hover:border-red-200">
                                            <img src={logo} alt="Logo" className="max-h-full max-w-full object-contain" />
                                            <button
                                                onClick={() => setLogo(null)}
                                                className="absolute inset-0 bg-red-500/90 text-white opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity"
                                            >
                                                <X className="h-6 w-6 mb-1" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest">Remove</span>
                                            </button>
                                        </div>
                                    ) : (
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            className="h-32 w-full border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 group transition-all"
                                        >
                                            {uploading ? (
                                                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                                            ) : (
                                                <Upload className="h-6 w-6 text-slate-400 group-hover:text-blue-500" />
                                            )}
                                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mt-2 group-hover:text-blue-600">
                                                {uploading ? "Processing..." : "Select Logo"}
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div className="md:col-span-3 space-y-4">
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Official Company Name</Label>
                                        <Input
                                            value={profile.companyName}
                                            onChange={e => setProfile({ ...profile, companyName: e.target.value })}
                                            placeholder="e.g. Fine & Country Zimbabwe"
                                            className="border-slate-100 focus:border-blue-200 h-11 font-medium"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Support Email</Label>
                                            <Input
                                                value={profile.email}
                                                onChange={e => setProfile({ ...profile, email: e.target.value })}
                                                placeholder="office@example.com"
                                                className="border-slate-100 h-11"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Official Website</Label>
                                            <Input
                                                value={profile.website}
                                                onChange={e => setProfile({ ...profile, website: e.target.value })}
                                                placeholder="www.fineandcountry.co.zw"
                                                className="border-slate-100 h-11"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="text-xs font-bold uppercase tracking-widest text-slate-400">Head Office Address</Label>
                                        <Input
                                            value={profile.address}
                                            onChange={e => setProfile({ ...profile, address: e.target.value })}
                                            placeholder="Enter registered business address"
                                            className="border-slate-100 h-11"
                                        />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-xl shadow-slate-200/50">
                        <CardHeader>
                            <CardTitle className="text-base font-bold flex items-center gap-2">
                                <Palette className="h-4 w-4 text-purple-500" /> Color Configuration
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <ColorPicker
                                    label="Primary (Brand)"
                                    value={profile.primaryColor}
                                    onChange={v => setProfile({ ...profile, primaryColor: v })}
                                />
                                <ColorPicker
                                    label="Secondary (Action)"
                                    value={profile.secondaryColor}
                                    onChange={v => setProfile({ ...profile, secondaryColor: v })}
                                />
                                <ColorPicker
                                    label="Accent (Details)"
                                    value={profile.accentColor}
                                    onChange={v => setProfile({ ...profile, accentColor: v })}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="lg:col-span-5">
                    <div className="sticky top-6 space-y-6">
                        <div className="flex items-center justify-between px-2">
                            <h2 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Professional Preview</h2>
                            <div className="flex items-center gap-1.5">
                                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[10px] font-bold text-slate-500 tracking-tighter uppercase">Live System</span>
                            </div>
                        </div>

                        <ReportHeaderPreview
                            companyName={profile.companyName}
                            logo={logo}
                            address={profile.address}
                            email={profile.email}
                            website={profile.website}
                            colors={{
                                primary: profile.primaryColor,
                                secondary: profile.secondaryColor,
                                accent: profile.accentColor,
                            }}
                        />

                        <Card className="bg-slate-900 border-none shadow-2xl p-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                                <ShieldCheck className="h-24 w-24 text-white" />
                            </div>
                            <CardContent className="p-0 space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-white/10 flex items-center justify-center">
                                        <Info className="h-5 w-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <h4 className="text-white font-bold text-sm">Deployment Ready</h4>
                                        <p className="text-slate-400 text-[10px] font-medium uppercase tracking-wider">All outputs will sync instantly</p>
                                    </div>
                                </div>
                                <Separator className="bg-white/10" />
                                <ul className="space-y-3">
                                    {[
                                        "Customer PDF Statements",
                                        "Inventory Audit Reports",
                                        "Developer Commission Summaries",
                                        "Transaction Receipts"
                                    ].map(item => (
                                        <li key={item} className="flex items-center gap-2 text-xs text-slate-300 font-medium">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-blue-500" />
                                            {item}
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    )
}

function Badge({ children, className, variant = "default" }: { children: React.ReactNode, className?: string, variant?: "default" | "outline" }) {
    const variants = {
        default: "bg-slate-900 text-white",
        outline: "border-slate-200 text-slate-900 border"
    }
    return <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase", variants[variant], className)}>{children}</span>
}
