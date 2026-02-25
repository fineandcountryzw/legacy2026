"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/data-table";
import { 
  Search, 
  Plus, 
  User, 
  Mail, 
  Shield, 
  Loader2,
  MoreHorizontal,
  UserX
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface OrgUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "admin" | "finance" | "agent" | "auditor";
  status: "active" | "inactive" | "pending";
  lastActiveAt: string | null;
  createdAt: string;
}

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  finance: "Finance",
  agent: "Agent/Support",
  auditor: "Auditor",
};

const roleColors: Record<string, string> = {
  admin: "bg-purple-100 text-purple-800",
  finance: "bg-blue-100 text-blue-800",
  agent: "bg-green-100 text-green-800",
  auditor: "bg-orange-100 text-orange-800",
};

export default function UsersPage() {
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      setLoading(true);
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  async function handleInviteUser(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setInviting(true);
    
    const formData = new FormData(e.currentTarget);
    const userData = {
      email: formData.get("email"),
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      role: formData.get("role"),
    };

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.details || "Failed to invite user");
      }
      
      toast.success("User invited successfully");
      setIsInviteOpen(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to invite user");
    } finally {
      setInviting(false);
    }
  }

  async function handleUpdateRole(userId: string, newRole: string) {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) throw new Error("Failed to update role");
      
      toast.success("Role updated successfully");
      fetchUsers();
    } catch (err) {
      toast.error("Failed to update role");
    }
  }

  async function handleToggleStatus(userId: string, currentStatus: string) {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update status");
      
      toast.success(`User ${newStatus === "active" ? "activated" : "deactivated"} successfully`);
      fetchUsers();
    } catch (err) {
      toast.error("Failed to update status");
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm("Are you sure you want to remove this user?")) return;

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("Failed to delete user");
      
      toast.success("User removed successfully");
      fetchUsers();
    } catch (err) {
      toast.error("Failed to remove user");
    }
  }

  const filteredUsers = users.filter(user =>
    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.firstName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.lastName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns = [
    {
      header: "User",
      accessorKey: "email",
      cell: (user: OrgUser) => (
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
            <User className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <p className="font-medium">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-sm text-slate-500 flex items-center gap-1">
              <Mail className="h-3 w-3" />
              {user.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: "Role",
      accessorKey: "role",
      cell: (user: OrgUser) => (
        <Badge className={roleColors[user.role] || "bg-slate-100"}>
          <Shield className="h-3 w-3 mr-1" />
          {roleLabels[user.role] || user.role}
        </Badge>
      ),
    },
    {
      header: "Status",
      accessorKey: "status",
      cell: (user: OrgUser) => (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          user.status === "active" 
            ? "bg-green-100 text-green-800" 
            : user.status === "pending"
            ? "bg-yellow-100 text-yellow-800"
            : "bg-red-100 text-red-800"
        }`}>
          {user.status}
        </span>
      ),
    },
    {
      header: "Last Active",
      accessorKey: "lastActiveAt",
      cell: (user: OrgUser) => (
        <span className="text-sm text-slate-500">
          {user.lastActiveAt 
            ? new Date(user.lastActiveAt).toLocaleDateString() 
            : "Never"}
        </span>
      ),
    },
    {
      header: "Actions",
      id: "actions",
      cell: (user: OrgUser) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleUpdateRole(user.id, "admin")}>
              Set as Admin
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleUpdateRole(user.id, "finance")}>
              Set as Finance
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleUpdateRole(user.id, "agent")}>
              Set as Agent
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleUpdateRole(user.id, "auditor")}>
              Set as Auditor
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleToggleStatus(user.id, user.status)}
              className={user.status === "active" ? "text-red-600" : "text-green-600"}
            >
              {user.status === "active" ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleDeleteUser(user.id)}
              className="text-red-600"
            >
              Remove User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-slate-500">Manage organization users and their roles.</p>
        </div>
        <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Invite User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Invite New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleInviteUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input 
                  id="email" 
                  name="email" 
                  type="email" 
                  required 
                  placeholder="user@example.com" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" name="firstName" placeholder="First name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" name="lastName" placeholder="Last name" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role *</Label>
                <Select name="role" required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="agent">Agent/Support</SelectItem>
                    <SelectItem value="auditor">Auditor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={inviting}>
                  {inviting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Inviting...
                    </>
                  ) : (
                    "Send Invitation"
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
                placeholder="Search users..."
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
              data={filteredUsers}
              pagination={{
                currentPage: 1,
                totalPages: Math.ceil(filteredUsers.length / 10) || 1,
                onPageChange: () => {},
              }}
            />
          )}
        </CardContent>
      </Card>

      {/* Role Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Role Permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <Badge className="mb-2 bg-purple-100 text-purple-800">Administrator</Badge>
              <p className="text-slate-500">Full access to all features and settings</p>
            </div>
            <div>
              <Badge className="mb-2 bg-blue-100 text-blue-800">Finance</Badge>
              <p className="text-slate-500">Receipts, reconciliation, statements, reports</p>
            </div>
            <div>
              <Badge className="mb-2 bg-green-100 text-green-800">Agent/Support</Badge>
              <p className="text-slate-500">Client read-only, statement search and download</p>
            </div>
            <div>
              <Badge className="mb-2 bg-orange-100 text-orange-800">Auditor</Badge>
              <p className="text-slate-500">Read-only access + audit logs</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
