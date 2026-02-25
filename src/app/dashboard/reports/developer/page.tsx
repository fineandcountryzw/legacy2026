"use client"

import { Building2, Download, Printer, Filter, Calendar } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DataTable } from "@/components/data-table"
import { Money } from "@/components/money"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MOCK_DEVELOPMENTS } from "@/lib/constants"
import { ReportHeaderPreview } from "@/components/report-header-preview"
import { Separator } from "@/components/ui/separator"

export default function DeveloperReportPage() {
    const selectedDev = MOCK_DEVELOPMENTS[0]

    const allocationSummaryColumns: any[] = [
        { header: "Category", accessorKey: "category", cell: (row: any) => <span className="font-medium">{row.category}</span> },
        { header: "Total Received", accessorKey: "received", cell: (row: any) => <Money amount={row.received} /> },
        { header: "Refunds", accessorKey: "refunds", cell: (row: any) => <Money amount={row.refunds} className="text-red-500" /> },
        { header: "Net Amount", accessorKey: "net", cell: (row: any) => <Money amount={row.net} /> },
        { header: "Payable to Dev", accessorKey: "payable", cell: (row: any) => <Money amount={row.payable} className="text-emerald-600" /> },
    ]

    const summaryData = [
        { category: "Capital Payments", received: 1150000, refunds: 10000, net: 1140000, payable: 1083000 },
        { category: "Admin Fees", received: 50000, refunds: 5000, net: 45000, payable: 17000 },
    ]

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Developer Reports</h1>
                    <p className="text-muted-foreground">Generate and export official financial reports for developers.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline"><Printer className="mr-2 h-4 w-4" /> Print</Button>
                    <Button><Download className="mr-2 h-4 w-4" /> Export PDF</Button>
                </div>
            </div>

            <Card className="bg-slate-50/50 border-slate-200">
                <CardContent className="p-6">
                    <div className="flex flex-wrap gap-4 items-end">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">Development</label>
                            <Select defaultValue="dev-1">
                                <SelectTrigger className="w-[300px] bg-white text-slate-900 border-slate-200">
                                    <SelectValue placeholder="Select Development" />
                                </SelectTrigger>
                                <SelectContent>
                                    {MOCK_DEVELOPMENTS.map(dev => (
                                        <SelectItem key={dev.id} value={dev.id}>{dev.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase text-slate-500">Date Range</label>
                            <Select defaultValue="this-month">
                                <SelectTrigger className="w-[180px] bg-white text-slate-900 border-slate-200">
                                    <SelectValue placeholder="Select Range" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="this-month">This Month</SelectItem>
                                    <SelectItem value="last-month">Last Month</SelectItem>
                                    <SelectItem value="q1">Q1 Performance</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <Button variant="outline"><Filter className="mr-2 h-4 w-4" /> Run Report</Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-8">
                    <Card className="overflow-hidden border-none shadow-xl">
                        <CardHeader className="bg-white p-0">
                            <ReportHeaderPreview
                                companyName={selectedDev.name}
                                colors={selectedDev.branding?.colors || { primary: "#0f172a", secondary: "#2563eb", accent: "#3b82f6" }}
                            />
                        </CardHeader>
                        <CardContent className="p-8 bg-white">
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-bold mb-4">Financial Summary</h3>
                                    <DataTable columns={allocationSummaryColumns} data={summaryData} pagination={false} />
                                </div>

                                <Separator />

                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400">Fine & Country Summary</h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span>Total Commissions</span>
                                                <Money amount={57000} />
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span>Admin Fees</span>
                                                <Money amount={28000} />
                                            </div>
                                            <div className="flex justify-between font-bold border-t pt-2 text-blue-600">
                                                <span>Total Retain</span>
                                                <Money amount={85000} />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-3">
                                        <h4 className="text-sm font-bold uppercase tracking-wider text-slate-400">Developer Summary</h4>
                                        <div className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span>Gross Sales Revenue</span>
                                                <Money amount={1140000} />
                                            </div>
                                            <div className="flex justify-between text-sm">
                                                <span>Less F&C Retain</span>
                                                <Money amount={(85000)} className="text-red-500" />
                                            </div>
                                            <div className="flex justify-between font-bold border-t pt-2 text-emerald-600">
                                                <span>Net Payable</span>
                                                <Money amount={1055000} />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-12 text-[10px] text-center text-slate-400 border-t pt-8">
                                Generated by StandInv Platform on {new Date().toLocaleDateString()}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm font-bold">Quick Export</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button variant="outline" className="w-full justify-start"><Download className="mr-2 h-4 w-4" /> PDF Statement</Button>
                            <Button variant="outline" className="w-full justify-start"><Download className="mr-2 h-4 w-4" /> Excel Ledger</Button>
                            <Button variant="outline" className="w-full justify-start"><Printer className="mr-2 h-4 w-4" /> Print Summary</Button>
                        </CardContent>
                    </Card>

                    <Card className="bg-blue-600 text-white border-none">
                        <CardContent className="p-6 space-y-4">
                            <h3 className="font-bold">Next Payout</h3>
                            <div>
                                <p className="text-xs text-blue-100 opacity-80 font-medium">Next scheduled settlement:</p>
                                <p className="text-xl font-bold">March 31, 2024</p>
                            </div>
                            <Button variant="secondary" className="w-full text-blue-600">Request Advance</Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
