"use client";

import { useState, useEffect } from "react";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Stand } from "@/types";
import { Search, Filter, Eye, Loader2 } from "lucide-react";
import Link from "next/link";
import { Money } from "@/components/money";
import { toast } from "sonner";

export default function StandsPage() {
    const [searchTerm, setSearchTerm] = useState("");
    const [stands, setStands] = useState<Stand[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStands();
    }, []);

    const fetchStands = async () => {
        try {
            setLoading(true);
            const res = await fetch("/api/stands");
            if (!res.ok) throw new Error("Failed to fetch stands");
            const data = await res.json();
            setStands(data.stands || []);
        } catch (err) {
            toast.error("Failed to load stands");
        } finally {
            setLoading(false);
        }
    };

    const filteredStands = stands.filter(s => 
        s.standNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.developmentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.clientName?.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
            cell: (item: Stand) => <Money amount={item.agreedPrice || 0} />
        },
        {
            header: "Total Paid",
            accessorKey: "totalPaid",
            cell: (item: Stand) => <Money amount={item.totalPaid || 0} />
        },
        {
            header: "Balance",
            accessorKey: "balance",
            cell: (item: Stand) => <Money amount={item.balance || 0} className="text-red-500" />
        },
        {
            header: "Actions",
            id: "actions",
            cell: (item: Stand) => (
                <Link href={`/dashboard/stands/${item.id}`}>
                    <Button variant="ghost" size="sm"><Eye className="h-4 w-4 mr-1" /> View</Button>
                </Link>
            )
        },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
        );
    }

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
                        placeholder="Search by stand number, development, or client..."
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
                {filteredStands.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">
                        <p>No stands found</p>
                        <p className="text-sm mt-2">Import a ledger file to create stands</p>
                    </div>
                ) : (
                    <DataTable
                        columns={columns}
                        data={filteredStands}
                        pagination={{
                            currentPage: 1,
                            totalPages: Math.ceil(filteredStands.length / 10),
                            onPageChange: () => { },
                        }}
                    />
                )}
            </div>
        </div>
    );
}
