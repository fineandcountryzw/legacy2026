"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/data-table";
import { 
  User, 
  Phone, 
  Mail, 
  FileText, 
  MapPin, 
  Loader2,
  Edit,
  Download,
  Home,
  Receipt
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { StatusBadge } from "@/components/status-badge";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  id_number: string;
  stands: Stand[];
  receipts: Receipt[];
  totalPaid: number;
  totalBalance: number;
}

interface Stand {
  id: string;
  standNumber: string;
  developmentName: string;
  currency: string;
  status: "Available" | "Sold" | "Unassigned" | "Disputed";
  agreedPrice: number;
  totalPaid: number;
  balance: number;
}

interface Receipt {
  id: string;
  date: string;
  reference: string;
  description: string;
  amount: number;
  stand?: {
    stand_inventory?: {
      stand_number: string;
    };
  };
}

export default function ClientDetailPage() {
  const { id } = useParams();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchClient();
    }
  }, [id]);

  async function fetchClient() {
    try {
      setLoading(true);
      const res = await fetch(`/api/clients/${id}`);
      if (!res.ok) throw new Error("Failed to fetch client");
      const data = await res.json();
      setClient(data);
    } catch (err) {
      toast.error("Failed to load client details");
    } finally {
      setLoading(false);
    }
  }

  const standColumns = [
    {
      header: "Stand",
      accessorKey: "standNumber",
      cell: (stand: Stand) => (
        <div>
          <p className="font-medium">Stand {stand.standNumber}</p>
          <p className="text-sm text-slate-500">{stand.developmentName}</p>
        </div>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (stand: Stand) => <StatusBadge status={stand.status} />,
    },
    {
      header: "Agreed Price",
      accessorKey: "agreedPrice",
      cell: (stand: Stand) => (
        <span className="font-medium">
          ${(stand.agreedPrice || 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Paid",
      accessorKey: "totalPaid",
      cell: (stand: Stand) => (
        <span className="text-emerald-600">
          ${(stand.totalPaid || 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Balance",
      accessorKey: "balance",
      cell: (stand: Stand) => (
        <span className={`font-medium ${(stand.balance || 0) > 0 ? 'text-red-600' : 'text-slate-500'}`}>
          ${(stand.balance || 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Actions",
      id: "actions",
      cell: (stand: Stand) => (
        <Link href={`/dashboard/stands/${stand.id}`}>
          <Button variant="ghost" size="sm">View</Button>
        </Link>
      ),
    },
  ];

  const receiptColumns = [
    {
      header: "Date",
      accessorKey: "date",
      cell: (receipt: Receipt) => (
        <span>{new Date(receipt.date).toLocaleDateString()}</span>
      ),
    },
    {
      header: "Reference",
      accessorKey: "reference",
      cell: (receipt: Receipt) => (
        <span className="font-mono text-sm">{receipt.reference}</span>
      ),
    },
    {
      header: "Stand",
      accessorKey: "stand",
      cell: (receipt: Receipt) => (
        <span>{receipt.stand?.stand_inventory?.stand_number || "N/A"}</span>
      ),
    },
    {
      header: "Description",
      accessorKey: "description",
    },
    {
      header: "Amount",
      accessorKey: "amount",
      cell: (receipt: Receipt) => (
        <span className="font-medium text-emerald-600">
          ${(receipt.amount || 0).toLocaleString()}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Client not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
            <User className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{client.name}</h1>
            <div className="flex items-center gap-4 text-sm text-slate-500 mt-1">
              {client.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-4 w-4" />
                  {client.phone}
                </span>
              )}
              {client.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-4 w-4" />
                  {client.email}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            Edit Profile
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Home className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Stands</p>
                <p className="text-2xl font-bold">{client.stands?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-100 rounded-lg">
                <Receipt className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total Paid</p>
                <p className="text-2xl font-bold">${(client.totalPaid || 0).toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-100 rounded-lg">
                <FileText className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Outstanding</p>
                <p className="text-2xl font-bold text-red-600">
                  ${(client.totalBalance || 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <MapPin className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">ID Number</p>
                <p className="text-lg font-bold">{client.id_number || "N/A"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="stands" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stands">Stands</TabsTrigger>
          <TabsTrigger value="receipts">Receipts & Payments</TabsTrigger>
          <TabsTrigger value="statements">Statements</TabsTrigger>
        </TabsList>

        <TabsContent value="stands">
          <Card>
            <CardHeader>
              <CardTitle>Client Stands</CardTitle>
            </CardHeader>
            <CardContent>
              {client.stands?.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Home className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <p>No stands assigned to this client</p>
                </div>
              ) : (
                <DataTable columns={standColumns} data={client.stands} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipts">
          <Card>
            <CardHeader>
              <CardTitle>Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              {client.receipts?.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Receipt className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <p>No payments recorded</p>
                </div>
              ) : (
                <DataTable columns={receiptColumns} data={client.receipts} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statements">
          <Card>
            <CardHeader>
              <CardTitle>Generate Statements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-slate-500">
                  Generate and download statements for each stand.
                </p>
                <div className="grid gap-4">
                  {client.stands?.map((stand) => (
                    <div 
                      key={stand.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">Stand {stand.standNumber}</p>
                        <p className="text-sm text-slate-500">{stand.developmentName}</p>
                      </div>
                      <Button variant="outline" size="sm">
                        <Download className="h-4 w-4 mr-2" />
                        Download Statement
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
