"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface ReportHeaderPreviewProps {
    companyName: string
    colors: {
        primary: string
        secondary: string
        accent: string
    }
    logoUrl?: string
}

export function ReportHeaderPreview({
    companyName,
    colors,
    logoUrl,
}: ReportHeaderPreviewProps) {
    return (
        <Card className="overflow-hidden border-2" style={{ borderColor: colors.primary }}>
            <CardHeader
                className="flex flex-row items-center justify-between p-6 text-white"
                style={{ backgroundColor: colors.primary }}
            >
                <div className="flex items-center gap-4">
                    <div
                        className="flex h-12 w-12 items-center justify-center rounded bg-white text-xl font-bold"
                        style={{ color: colors.primary }}
                    >
                        {logoUrl ? <img src={logoUrl} alt="Logo" className="h-8 w-8 object-contain" /> : "F&C"}
                    </div>
                    <div>
                        <h3 className="text-lg font-bold leading-none">{companyName}</h3>
                        <p className="mt-1 text-xs opacity-80 text-white/80">Property Development Statement</p>
                    </div>
                </div>
                <Badge
                    variant="secondary"
                    className="text-white"
                    style={{ backgroundColor: colors.secondary }}
                >
                    CONFIDENTIAL
                </Badge>
            </CardHeader>
            <CardContent className="bg-zinc-50 p-4">
                <div className="flex justify-between border-b pb-2 text-[10px] uppercase tracking-wider text-slate-400">
                    <span>Reference: INV-2024-001</span>
                    <span>Date: March 10, 2024</span>
                </div>
                <div className="mt-4 h-2 w-full rounded-full bg-slate-200">
                    <div
                        className="h-full rounded-full"
                        style={{ width: "65%", backgroundColor: colors.accent }}
                    />
                </div>
                <div className="mt-2 text-center text-[10px] text-slate-500 italic">
                    Draft Preview - Branding reflects selection
                </div>
            </CardContent>
        </Card>
    )
}
