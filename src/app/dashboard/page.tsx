import { SummaryCard } from "@/components/summary-card";
import { Building2, Users, Map as MapIcon, DollarSign } from "lucide-react";

export default function DashboardPage() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
                <p className="text-slate-500">Welcome back. Here's what's happening today.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <SummaryCard
                    title="Total Developments"
                    value="12"
                    icon={Building2}
                    description="Across 3 regions"
                />
                <SummaryCard
                    title="Total Stands"
                    value="1,284"
                    icon={MapIcon}
                    description="84% assigned"
                    trend={{ value: 12, isPositive: true }}
                />
                <SummaryCard
                    title="Active Clients"
                    value="956"
                    icon={Users}
                    description="12 new this month"
                />
                <SummaryCard
                    title="Total Revenue"
                    value="$4.2M"
                    icon={DollarSign}
                    description="+18.2% from last year"
                    trend={{ value: 4.5, isPositive: true }}
                />
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <div className="col-span-4 rounded-xl border bg-white p-6 shadow-sm">
                    <h3 className="font-semibold mb-4">Recent Developments</h3>
                    <div className="space-y-4">
                        {[
                            { name: "Green Valley Estate", code: "GVE", stands: 150, progress: 80 },
                            { name: "Sunset Ridge", code: "SSR", stands: 80, progress: 56 },
                            { name: "Riverbend Park", code: "RBP", stands: 200, progress: 90 },
                        ].map((dev) => (
                            <div key={dev.code} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                <div>
                                    <p className="font-medium">{dev.name}</p>
                                    <p className="text-sm text-slate-500">{dev.stands} Stands • {dev.code}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-semibold">{dev.progress}% Sold</p>
                                    <div className="w-24 h-2 bg-slate-100 rounded-full mt-1">
                                        <div
                                            className="h-full bg-blue-600 rounded-full"
                                            style={{ width: `${dev.progress}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="col-span-3 rounded-xl border bg-white p-6 shadow-sm">
                    <h3 className="font-semibold mb-4">Quick Actions</h3>
                    <div className="grid grid-cols-1 gap-2">
                        {[
                            { label: "Upload New Inventory", href: "/dashboard/uploads", icon: DollarSign },
                            { label: "Generate Statements", href: "/dashboard/statements", icon: Users },
                            { label: "View All Stands", href: "/dashboard/stands", icon: MapIcon },
                        ].map((action) => (
                            <a
                                key={action.label}
                                href={action.href}
                                className="flex items-center gap-3 rounded-lg border p-3 text-sm font-medium hover:bg-slate-50 transition-colors"
                            >
                                <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-100 text-slate-600">
                                    <action.icon size={18} />
                                </div>
                                {action.label}
                            </a>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
