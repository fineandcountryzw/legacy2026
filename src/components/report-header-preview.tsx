"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Mail, MapPin, Globe } from "lucide-react"

interface ReportHeaderPreviewProps {
    companyName: string
    colors: {
        primary: string
        secondary: string
        accent: string
    }
    logo?: string | null
    address?: string
    email?: string
    website?: string
}

export function ReportHeaderPreview({
    companyName,
    colors,
    logo,
    address,
    email,
    website
}: ReportHeaderPreviewProps) {
    return (
        <Card className="overflow-hidden border-none shadow-2xl bg-white ring-1 ring-slate-200/50">
            {/* Top Accent Bar */}
            <div className="h-1.5 w-full" style={{ backgroundColor: colors.accent }} />

            <CardContent className="p-0">
                <div className="p-8 flex flex-col md:flex-row justify-between gap-6">
                    <div className="flex items-start gap-5">
                        <div
                            className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-50 border border-slate-100 shadow-sm overflow-hidden"
                        >
                            {logo ? (
                                <img src={logo} alt="Logo" className="h-full w-full object-contain p-2" />
                            ) : (
                                <div className="text-[10px] font-black tracking-tighter text-slate-300 uppercase leading-none text-center">
                                    Your<br />Logo
                                </div>
                            )}
                        </div>
                        <div>
                            <h3 className="text-2xl font-black tracking-tight text-slate-900 leading-tight">
                                {companyName || "Company Name"}
                            </h3>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[11px] font-medium text-slate-500 uppercase tracking-widest">
                                {email && <span className="flex items-center gap-1.5"><Mail className="h-3 w-3 translate-y-[-0.5px]" /> {email}</span>}
                                {website && <span className="flex items-center gap-1.5"><Globe className="h-3 w-3 translate-y-[-0.5px]" /> {website}</span>}
                            </div>
                        </div>
                    </div>

                    <div className="text-right flex flex-col items-end gap-1">
                        <Badge
                            variant="outline"
                            className="bg-slate-50 border-slate-200 text-slate-600 font-bold tracking-widest text-[10px] py-1 px-3"
                        >
                            OFFICIAL DOCUMENT
                        </Badge>
                        <div className="mt-2 text-[11px] text-slate-400 font-medium max-w-[200px] leading-relaxed">
                            {address || "Head Office Address, Zimbabwe"}
                        </div>
                    </div>
                </div>

                <div className="px-8 pb-8">
                    <div className="flex items-center justify-between py-4 border-t border-slate-100">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Document Ref</span>
                            <span className="text-sm font-mono font-bold text-slate-700">STMT-2024-X99</span>
                        </div>
                        <div className="flex flex-col gap-1 text-right">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Issue Date</span>
                            <span className="text-sm font-bold text-slate-700">{new Date().toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                        </div>
                    </div>

                    <div className="mt-6 p-6 rounded-2xl bg-slate-50/50 border border-slate-100 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.03] pointer-events-none -mr-8 -mt-8">
                            <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
                                <path fill={colors.primary} d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,79.6,-46.2C87.4,-33.3,90.1,-17.7,89.5,-2.3C88.9,13.1,85.1,28.3,77.5,41.4C69.8,54.5,58.3,65.5,44.8,72.7C31.3,79.9,15.7,83.3,0.3,82.7C-15.1,82.1,-30.2,77.5,-44.1,70.5C-57.9,63.5,-70.5,54.1,-78.4,41.4C-86.3,28.7,-89.6,12.7,-88.7,-3.1C-87.8,-18.9,-82.7,-34.5,-73.8,-47.3C-64.9,-60.1,-52.3,-70.1,-38.4,-77.4C-24.5,-84.7,-12.3,-89.3,1.3,-91.5C14.8,-93.7,29.6,-93.5,44.7,-76.4Z" transform="translate(100 100)" />
                            </svg>
                        </div>

                        <div className="flex justify-between items-end">
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Outstanding Total</span>
                                <div className="text-4xl font-black tracking-tight" style={{ color: colors.primary }}>
                                    $42,500.00
                                </div>
                            </div>
                            <div
                                className="h-1.5 w-32 rounded-full bg-slate-200"
                            >
                                <div
                                    className="h-full rounded-full shadow-sm"
                                    style={{ width: "75%", backgroundColor: colors.secondary }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
