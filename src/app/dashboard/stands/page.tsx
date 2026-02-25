"use client";

import { useState } from "react";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Stand } from "@/types";
import { Search, Filter, Eye } from "lucide-react";
import { MOCK_STANDS } from "@/lib/constants";
import Link from "next/link";
import { Money } from "@/components/money"; // Assuming Money component exists

export default function StandsPage() {
    const [searchTerm, setSearchTerm] = useState("");

    const columns: any[] = [
        {
            header: "Stand Number",
            accessorKey: "standNumber",
            cell: (item: Stand) => (
                <Link href={`/dashboard/stands/${item.id}`} className="font-bold text-blue-600 hover:underline">
                    {item.standNumber}
                </Link>
            )
        },
        { header: "Development", accessorKey: "developmentName" },
        { header: "Type", accessorKey: "standTypeLabel" },
        {
            header: "Status",
            accessorKey: "status",
            cell: (item: Stand) => <StatusBadge status={item.status} />
        },
        {
            header: "Client",
            accessorKey: "clientName",
            cell: (item: Stand) => item.clientName || <span className="text-slate-400 italic font-normal text-xs">Unassigned</span>
        },
        {
            header: "Agreed Price",
            accessorKey: "agreedPrice",
            cell: (item: Stand) => <Money amount={item.agreedPrice} />
        },
        {
            header: "Total Paid",
            accessorKey: "totalPaid",
            cell: (item: Stand) => <Money amount={item.totalPaid} />
        },
        {
            header: "Balance",
            accessorKey: "balance",
            cell: (item: Stand) => <Money amount={item.balance} className="text-red-500" />
        },
        {
            header: "Actions",
            id: "actions",
            cell: (item: Stand) => (
                <Link href={`/dashboard/stands/${item.id}`}>
                    <Button variant="ghost" size="sm">View</Button>
                </Link>
            )
        },
    ];

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900">Stand Inventory</h1>
                    <p className="text-slate-500">Manage and track all individual property stands.</p>
                </div>
                <Button>Add New Stand</Button>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center bg-white p-4 rounded-xl border">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                    <Input
                        placeholder="Search by stand number..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm">
                        <Filter className="h-4 w-4 mr-2" />
                        All Developments
                    </Button>
                    <Button variant="outline" size="sm">
                        Status: All
                    </Button>
                </div>
            </div>

            <div className="rounded-xl border bg-white p-6 shadow-sm">
                <DataTable
                    columns={columns}
                    data={MOCK_STANDS}
                    pagination={{
                        currentPage: 1,
                        totalPages: 10,
                        onPageChange: () => { },
                    }}
                />
            </div>
        </div>
    );
}
