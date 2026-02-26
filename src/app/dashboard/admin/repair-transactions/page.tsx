"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle, CheckCircle, Wrench } from "lucide-react";
import { toast } from "sonner";

export default function RepairTransactionsPage() {
  const [orphanedCount, setOrphanedCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    checkOrphaned();
  }, []);

  const checkOrphaned = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/fix-orphaned-transactions");
      if (res.ok) {
        const data = await res.json();
        setOrphanedCount(data.orphanedTransactions);
      }
    } catch (err) {
      console.error("Error checking:", err);
    } finally {
      setLoading(false);
    }
  };

  const fixTransactions = async () => {
    try {
      setFixing(true);
      const res = await fetch("/api/fix-orphaned-transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      if (res.ok) {
        const data = await res.json();
        setResult(data);
        toast.success(`Fixed ${data.fixed} transactions`);
        checkOrphaned();
      } else {
        const err = await res.json();
        toast.error(err.error || "Fix failed");
      }
    } catch (err) {
      toast.error("Fix failed");
    } finally {
      setFixing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Repair Transactions</h1>
        <p className="text-slate-500">
          Fix orphaned transactions that were uploaded without a development selected.
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <AlertCircle className="h-6 w-6 text-amber-600 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800">Problem Detected</h3>
              <p className="text-sm text-amber-700 mt-2">
                When you uploaded files without selecting a development, transactions were created 
                but not linked to stands. This tool will link them based on stand numbers in the 
                transaction descriptions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5" />
            Transaction Repair Tool
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking...
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-4xl font-bold text-slate-900">{orphanedCount ?? "?"}</p>
              <p className="text-slate-500">Orphaned Transactions</p>
            </div>
          )}

          <Button 
            onClick={fixTransactions} 
            disabled={fixing || !orphanedCount || orphanedCount === 0}
            className="w-full"
          >
            {fixing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Fixing...
              </>
            ) : (
              <>
                <Wrench className="h-4 w-4 mr-2" />
                Link Transactions to Stands
              </>
            )}
          </Button>

          {result && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <span className="font-semibold">Repair Complete</span>
              </div>
              <p className="text-sm text-slate-600">
                Fixed: {result.fixed} | Failed: {result.failed}
              </p>
              {result.details?.fixed?.length > 0 && (
                <div className="mt-2 text-xs text-slate-500 max-h-40 overflow-auto">
                  {result.details.fixed.slice(0, 5).map((d: string, i: number) => (
                    <div key={i}>{d}</div>
                  ))}
                  {result.details.fixed.length > 5 && (
                    <div>...and {result.details.fixed.length - 5} more</div>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
