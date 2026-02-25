"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { Search, Plus, User, Phone, Mail, FileText, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string;
  id_number: string;
  standsCount: number;
  totalPaid: number;
  balance: number;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    try {
      setLoading(true);
      const res = await fetch("/api/clients");
      if (!res.ok) throw new Error("Failed to fetch clients");
      const data = await res.json();
      setClients(data.clients || []);
    } catch (err) {
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateClient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreating(true);
    
    const formData = new FormData(e.currentTarget);
    const clientData = {
      name: formData.get("name"),
      email: formData.get("email"),
      phone: formData.get("phone"),
      idNumber: formData.get("idNumber"),
    };

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clientData),
      });

      if (!res.ok) throw new Error("Failed to create client");
      
      toast.success("Client created successfully");
      setIsCreateOpen(false);
      fetchClients();
    } catch (err) {
      toast.error("Failed to create client");
    } finally {
      setCreating(false);
    }
  }

  const filteredClients = clients.filter(client =>
    client.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.phone?.includes(searchQuery) ||
    client.id_number?.includes(searchQuery)
  );

  const columns = [
    {
      header: "Client",
      accessorKey: "name",
      cell: (client: Client) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
            <User className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <Link 
              href={`/dashboard/clients/${client.id}`}
              className="font-medium text-blue-600 hover:underline"
            >
              {client.name}
            </Link>
            {client.email && (
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {client.email}
              </p>
            )}
          </div>
        </div>
      ),
    },
    {
      header: "Phone / ID",
      accessorKey: "phone",
      cell: (client: Client) => (
        <div className="space-y-1">
          {client.phone && (
            <p className="text-sm flex items-center gap-1">
              <Phone className="h-3 w-3 text-slate-400" />
              {client.phone}
            </p>
          )}
          {client.id_number && (
            <p className="text-sm text-slate-500">ID: {client.id_number}</p>
          )}
        </div>
      ),
    },
    {
      header: "Stands",
      accessorKey: "standsCount",
      cell: (client: Client) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {client.standsCount || 0} stands
        </span>
      ),
    },
    {
      header: "Total Paid",
      accessorKey: "totalPaid",
      cell: (client: Client) => (
        <span className="font-medium text-emerald-600">
          ${(client.totalPaid || 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Balance",
      accessorKey: "balance",
      cell: (client: Client) => (
        <span className={`font-medium ${(client.balance || 0) > 0 ? 'text-red-600' : 'text-slate-500'}`}>
          ${(client.balance || 0).toLocaleString()}
        </span>
      ),
    },
    {
      header: "Actions",
      id: "actions",
      cell: (client: Client) => (
        <div className="flex gap-2">
          <Link href={`/dashboard/clients/${client.id}`}>
            <Button variant="ghost" size="sm">
              <FileText className="h-4 w-4 mr-1" />
              View
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clients</h1>
          <p className="text-slate-500">Manage your clients and their stands.</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create New Client</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateClient} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input id="name" name="name" required placeholder="Enter client name" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" placeholder="email@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" placeholder="+263..." />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="idNumber">National ID / Passport</Label>
                <Input id="idNumber" name="idNumber" placeholder="Enter ID number" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Client"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name, phone, or ID..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredClients}
              pagination={{
                currentPage: 1,
                totalPages: Math.ceil(filteredClients.length / 10) || 1,
                onPageChange: () => {},
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
