"use client"

import { useState, useRef } from "react"
import { Building2, Upload, Palette, ShieldCheck, Globe, Image, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { ColorPicker } from "@/components/color-picker"
import { ReportHeaderPreview } from "@/components/report-header-preview"
import { cn } from "@/lib/utils"
import { toast } from "sonner"

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
    const fileInputRef = useRef<HTMLInputElement>(null)

    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Validate file type
        if (!file.type.startsWith('image/')) {
            toast.error('Please upload an image file')
            return
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            toast.error('File size must be less than 2MB')
            return
        }

        setUploading(true)

        try {
            // Convert to base64 for preview
            const reader = new FileReader()
            reader.onloadend = () => {
                setLogo(reader.result as string)
                setUploading(false)
                toast.success('Logo uploaded successfully')
            }
            reader.readAsDataURL(file)

            // TODO: Upload to Supabase Storage
            // const { data, error } = await supabase.storage
            //     .from('logos')
            //     .upload(`branding/${Date.now()}_${file.name}`, file)
            
        } catch (err) {
            toast.error('Failed to upload logo')
            setUploading(false)
        }
    }

    const removeLogo = () => {
        setLogo(null)
        if (fileInputRef.current) {
            fileInputRef.current.value = ''
        }
    }

    const handleSave = async () => {
        // TODO: Save branding profile to database
        toast.success('Branding settings saved successfully')
    }

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Global Branding</h1>
                <p className="text-muted-foreground">Manage the default brand profile used across all reports and statements.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-7 space-y-6">
                    {/* Logo Upload */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Image className="h-4 w-4" /> Company Logo
                            </CardTitle>
                            <CardDescription>Upload your company logo to display on reports and statements.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleLogoUpload}
                                accept="image/*"
                                className="hidden"
                            />
                            
                            {logo ? (
                                <div className="relative inline-block">
                                    <img 
                                        src={logo} 
                                        alt="Company Logo" 
                                        className="h-24 w-auto object-contain border rounded-lg p-2"
                                    />
                                    <button
                                        onClick={removeLogo}
                                        className="absolute -top-2 -right-2 h-6 w-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <div 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-slate-50 transition-colors"
                                >
                                    {uploading ? (
                                        <Loader2 className="h-8 w-8 mx-auto mb-2 animate-spin text-blue-600" />
                                    ) : (
                                        <Upload className="h-8 w-8 mx-auto mb-2 text-slate-400" />
                                    )}
                                    <p className="text-sm font-medium text-slate-700">
                                        {uploading ? 'Uploading...' : 'Click to upload logo'}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        PNG, JPG, SVG up to 2MB
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Building2 className="h-4 w-4" /> Company Information
                            </CardTitle>
                            <CardDescription>Official details appearing on branded outputs.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Company Name</Label>
                                <Input 
                                    value={profile.companyName} 
                                    onChange={e => setProfile({ ...profile, companyName: e.target.value })}
                                    placeholder="Enter company name"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Support Email</Label>
                                    <Input 
                                        type="email" 
                                        value={profile.email} 
                                        onChange={e => setProfile({ ...profile, email: e.target.value })}
                                        placeholder="email@example.com"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Website</Label>
                                    <Input 
                                        value={profile.website} 
                                        onChange={e => setProfile({ ...profile, website: e.target.value })}
                                        placeholder="www.example.com"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Head Office Address</Label>
                                <Input 
                                    value={profile.address} 
                                    onChange={e => setProfile({ ...profile, address: e.target.value })}
                                    placeholder="Enter full address"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-bold flex items-center gap-2">
                                <Palette className="h-4 w-4" /> Color Palette
                            </CardTitle>
                            <CardDescription>Primary themes used for headers, badges, and progress bars.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <ColorPicker
                                    label="Primary"
                                    value={profile.primaryColor}
                                    onChange={v => setProfile({ ...profile, primaryColor: v })}
                                />
                                <ColorPicker
                                    label="Secondary"
                                    value={profile.secondaryColor}
                                    onChange={v => setProfile({ ...profile, secondaryColor: v })}
                                />
                                <ColorPicker
                                    label="Accent"
                                    value={profile.accentColor}
                                    onChange={v => setProfile({ ...profile, accentColor: v })}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end gap-3 pb-8">
                        <Button variant="outline">Discard Changes</Button>
                        <Button 
                            className="bg-slate-900"
                            onClick={handleSave}
                        >
                            <ShieldCheck className="mr-2 h-4 w-4" /> 
                            Save Branding Profile
                        </Button>
                    </div>
                </div>

                <div className="lg:col-span-5 space-y-6">
                    <div className="sticky top-6 space-y-6">
                        <Card className="border-2 border-blue-100 shadow-xl">
                            <CardHeader className="bg-blue-50/50">
                                <CardTitle className="text-sm font-bold flex items-center justify-between">
                                    <span>Live Preview</span>
                                    <Badge variant="outline" className="bg-white">Official Template</Badge>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                                <ReportHeaderPreview
                                    companyName={profile.companyName || "Your Company Name"}
                                    logo={logo}
                                    colors={{
                                        primary: profile.primaryColor,
                                        secondary: profile.secondaryColor,
                                        accent: profile.accentColor,
                                    }}
                                />
                                <div className="mt-8 space-y-4">
                                    <h4 className="text-xs font-bold uppercase text-slate-400">Application Preview</h4>
                                    <div className="flex items-center gap-3">
                                        <Button style={{ backgroundColor: profile.primaryColor }} className="text-white">Primary Button</Button>
                                        <Button variant="outline" style={{ borderColor: profile.secondaryColor, color: profile.secondaryColor }}>Outline Action</Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-slate-900 text-white overflow-hidden">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-xs font-bold flex items-center gap-2 opacity-60">
                                    <Globe className="h-3 w-3" /> System Status
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="font-mono text-[10px] pb-6">
                                Branding configuration active
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
