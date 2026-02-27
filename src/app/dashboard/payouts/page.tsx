'use client';

import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PayoutApprovalQueue } from '@/components/payouts/PayoutApprovalQueue';
import { PayoutRequestForm } from '@/components/payouts/PayoutRequestForm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, List, PlusCircle } from 'lucide-react';

export default function PayoutsPage() {
  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Developer Payouts</h1>
      </div>

      <Tabs defaultValue="queue" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="queue" className="flex items-center gap-2">
            <List className="h-4 w-4" />
            Payout Queue
          </TabsTrigger>
          <TabsTrigger value="request" className="flex items-center gap-2">
            <PlusCircle className="h-4 w-4" />
            Request Payout
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="space-y-6">
          <PayoutApprovalQueue />
        </TabsContent>

        <TabsContent value="request" className="space-y-6">
          <div className="max-w-2xl">
            <PayoutRequestForm />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
