"use client";

import { useState, useEffect } from "react";
import { SummaryCard } from "@/components/summary-card";
import { Building2, Users, Map as MapIcon, DollarSign, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DashboardStats {
  totalDevelopments: number;
  totalStands: number;
  activeClients: number;
  totalRevenue: number;
}

interface RecentDevelopment {
  id: string;
  name: string;
  code: string;
  stands: number;
  progress: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentDevelopments, setRecentDevelopments] = useState<RecentDevelopment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      setLoading(true);
      
      // Fetch developments
      const devRes = await fetch("/api/developments");
      if (devRes.ok) {
        const developments = await devRes.json();
        
        // Calculate stats
        const totalDevelopments = developments.length;
        const totalStands = developments.reduce((sum: number, d: any) => sum + (d.totalStands || 0), 0);
        const totalRevenue = developments.reduce((sum: number, d: any) => sum + (d.totalReceived || 0), 0);
        
        // Map to recent developments format
        const recent = developments.slice(0, 5).map((d: any) => ({
          id: d.id,
          name: d.name,
          code: d.code,
          stands: d.totalStands || 0,
          progress: d.totalStands > 0 ? Math.round((d.soldStands / d.totalStands) * 100) : 0,
        }));
        
        setRecentDevelopments(recent);
        
        // Fetch clients count
        const clientsRes = await fetch("/api/clients");
        let activeClients = 0;
        if (clientsRes.ok) {
          const clientsData = await clientsRes.json();
          activeClients = clientsData.clients?.length || 0;
        }
        
        setStats({
          totalDevelopments,
          totalStands,
          activeClients,
          totalRevenue,
        });
      }
    } catch (err) {
      toast.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1>
        <p className="text-slate-500">Welcome back. Here&apos;s what&apos;s happening today.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Total Developments"
          value={stats?.totalDevelopments?.toString() || "0"}
          icon={Building2}
          description="Active developments"
        />
        <SummaryCard
          title="Total Stands"
          value={stats?.totalStands?.toLocaleString() || "0"}
          icon={MapIcon}
          description="Total inventory"
        />
        <SummaryCard
          title="Active Clients"
          value={stats?.activeClients?.toString() || "0"}
          icon={Users}
          description="Registered clients"
        />
        <SummaryCard
          title="Total Revenue"
          value={`$${((stats?.totalRevenue || 0) / 1000000).toFixed(1)}M`}
          icon={DollarSign}
          description="Lifetime revenue"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-4 rounded-xl border bg-white p-6 shadow-sm">
          <h3 className="font-semibold mb-4">Recent Developments</h3>
          <div className="space-y-4">
            {recentDevelopments.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                <p>No developments yet</p>
                <p className="text-sm mt-2">Create your first development to get started</p>
              </div>
            ) : (
              recentDevelopments.map((dev) => (
                <div key={dev.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
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
              ))
            )}
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
