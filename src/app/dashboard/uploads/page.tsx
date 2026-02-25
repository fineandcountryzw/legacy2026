"use client";

import { FileUpload } from "@/components/file-upload";
import { DataTable } from "@/components/data-table";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { UploadHistory } from "@/types";
import { Eye } from "lucide-react";

const MOCK_HISTORY: UploadHistory[] = [
    {
        id: "1",
        fileName: "March_Collections_GVE.xlsx",
        developmentName: "Green Valley Estate",
        date: "2024-03-15",
        standsDetected: 120,
        transactionsDetected: 450,
        status: "Completed",
    },
    {
        id: "2",
        fileName: "SSR_Standalone_Stands.xlsx",
        developmentName: "Sunset Ridge",
        date: "2024-03-14",
        standsDetected: 45,
        transactionsDetected: 0,
        status: "Completed",
    },
    {
        id: "3",
        fileName: "Incomplete_Upload.xlsx",
        date: "2024-03-12",
        standsDetected: 0,
        transactionsDetected: 12,
        status: "Failed",
    },
];

export default function UploadsPage() {
    const handleFileUpload = (file: File) => {
        console.log("Uploading file:", file.name);
        // Mock upload logic
    };

    const columns = [
        { header: "File Name", accessorKey: "fileName" as keyof UploadHistory },
        {
            header: "Development",
            accessorKey: (item: UploadHistory) => item.developmentName || "N/A"
        },
        { header: "Date", accessorKey: "date" as keyof UploadHistory },
        { header: "Stands", accessorKey: "standsDetected" as keyof UploadHistory },
        { header: "Transactions", accessorKey: "transactionsDetected" as keyof UploadHistory },
        {
            header: "Status",
            accessorKey: "status" as keyof UploadHistory,
            cell: (item: UploadHistory) => <StatusBadge status={item.status} />
        },
        {
            header: "Action",
            accessorKey: "id" as keyof UploadHistory,
            cell: (item: UploadHistory) => (
                <Button variant="ghost" size="sm">
                    <Eye size={16} className="mr-2" />
                    View
                </Button>
            )
        },
    ];

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-900">Uploads</h1>
                <p className="text-slate-500">Import inventory and transaction data from Excel files.</p>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <div className="rounded-xl border bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-semibold mb-4">New Upload</h2>
                        <FileUpload onUpload={handleFileUpload} accept=".xlsx,.xls" />
                    </div>

                    <div className="rounded-xl border bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-semibold mb-4">Import History</h2>
                        <DataTable
                            columns={columns}
                            data={MOCK_HISTORY}
                            pagination={{
                                currentPage: 1,
                                totalPages: 1,
                                onPageChange: () => { },
                            }}
                        />
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-xl border bg-white p-6 shadow-sm">
                        <h2 className="text-lg font-semibold mb-4">Upload Tips</h2>
                        <ul className="space-y-3 text-sm text-slate-600">
                            <li className="flex gap-2">
                                <span className="text-blue-600 font-bold">•</span>
                                Ensure Excel columns match the template.
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-600 font-bold">•</span>
                                Date formats should be YYYY-MM-DD.
                            </li>
                            <li className="flex gap-2">
                                <span className="text-blue-600 font-bold">•</span>
                                Amount fields should only contain numbers.
                            </li>
                        </ul>
                        <Button variant="outline" className="w-full mt-6">
                            Download Template
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
