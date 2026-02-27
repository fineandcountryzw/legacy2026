'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { DollarSign, Loader2, Building, Home, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PAYOUT_TYPE_OPTIONS } from '@/lib/auth/rbac';
import { formatCurrency } from '@/lib/utils';

interface Development {
  id: string;
  name: string;
}

interface Stand {
  id: string;
  standNumber: string;
  developmentName: string;
  balance: number;
  clientName?: string;
}

interface PayoutCalculation {
  totalReceived: number;
  fcCommission: number;
  fcAdminFees: number;
  otherDeductions: number;
  netPayout: number;
}

interface PayoutRequestFormProps {
  onSuccess?: () => void;
}

export function PayoutRequestForm({ onSuccess }: PayoutRequestFormProps) {
  const [developments, setDevelopments] = useState<Development[]>([]);
  const [stands, setStands] = useState<Stand[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    developmentId: '',
    standId: '',
    developerName: '',
    amount: '',
    payoutType: '',
    description: '',
    periodStart: '',
    periodEnd: '',
  });
  
  const [selectedStand, setSelectedStand] = useState<Stand | null>(null);
  const [calculation, setCalculation] = useState<PayoutCalculation | null>(null);
  const [calculating, setCalculating] = useState(false);

  // Fetch developments on mount
  useEffect(() => {
    const fetchDevelopments = async () => {
      try {
        const response = await fetch('/api/developments');
        if (!response.ok) throw new Error('Failed to fetch developments');
        const data = await response.json();
        setDevelopments(data.developments || []);
      } catch (error) {
        toast.error('Failed to load developments');
        console.error(error);
      }
    };
    fetchDevelopments();
  }, []);

  // Fetch stands when development changes
  useEffect(() => {
    if (!formData.developmentId) {
      setStands([]);
      return;
    }
    
    const fetchStands = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/stands?developmentId=${formData.developmentId}`);
        if (!response.ok) throw new Error('Failed to fetch stands');
        const data = await response.json();
        // Filter stands with positive balance
        const standsWithBalance = (data.stands || []).filter(
          (s: Stand) => s.balance > 0
        );
        setStands(standsWithBalance);
      } catch (error) {
        toast.error('Failed to load stands');
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchStands();
  }, [formData.developmentId]);

  // Update selected stand and calculate payout when standId changes
  useEffect(() => {
    const stand = stands.find(s => s.id === formData.standId);
    setSelectedStand(stand || null);
    
    // Auto-set developer name based on development
    const development = developments.find(d => d.id === formData.developmentId);
    if (development && !formData.developerName) {
      setFormData(prev => ({ ...prev, developerName: development.name }));
    }
    
    // Calculate net payout when stand is selected
    if (formData.standId) {
      calculatePayout(formData.standId);
    } else {
      setCalculation(null);
    }
  }, [formData.standId, stands, developments, formData.developmentId]);
  
  // Calculate net payout for a stand
  const calculatePayout = async (standId: string) => {
    try {
      setCalculating(true);
      const response = await fetch(`/api/payouts/calculate?standId=${standId}`);
      if (!response.ok) throw new Error('Failed to calculate payout');
      const data = await response.json();
      setCalculation(data);
      // Auto-fill amount with net payout
      setFormData(prev => ({ 
        ...prev, 
        amount: data.netPayout.toString()
      }));
    } catch (error) {
      console.error('Error calculating payout:', error);
      toast.error('Failed to calculate payout breakdown');
    } finally {
      setCalculating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedStand) {
      toast.error('Please select a stand');
      return;
    }
    
    const amount = parseFloat(formData.amount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    
    if (amount > selectedStand.balance) {
      toast.error(`Amount exceeds available balance of ${formatCurrency(selectedStand.balance)}`);
      return;
    }
    
    try {
      setSubmitting(true);
      const response = await fetch('/api/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          standId: formData.standId,
          developerName: formData.developerName,
          amount: amount,
          payoutType: formData.payoutType,
          description: formData.description,
          periodStart: formData.periodStart || null,
          periodEnd: formData.periodEnd || null,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to request payout');
      }
      
      toast.success('Payout requested successfully');
      
      // Reset form
      setFormData({
        developmentId: '',
        standId: '',
        developerName: '',
        amount: '',
        payoutType: '',
        description: '',
        periodStart: '',
        periodEnd: '',
      });
      setSelectedStand(null);
      setCalculation(null);
      
      onSuccess?.();
    } catch (error) {
      toast.error((error as Error).message || 'Failed to request payout');
      console.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Request Developer Payout
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Development Select */}
          <div className="space-y-2">
            <Label htmlFor="development">Development</Label>
            <Select
              value={formData.developmentId}
              onValueChange={(value) => 
                setFormData(prev => ({ 
                  ...prev, 
                  developmentId: value, 
                  standId: '' 
                }))
              }
            >
              <SelectTrigger id="development">
                <Building className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select development" />
              </SelectTrigger>
              <SelectContent>
                {developments.map((dev) => (
                  <SelectItem key={dev.id} value={dev.id}>
                    {dev.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Stand Select */}
          <div className="space-y-2">
            <Label htmlFor="stand">Stand</Label>
            <Select
              value={formData.standId}
              onValueChange={(value) => setFormData(prev => ({ ...prev, standId: value }))}
              disabled={!formData.developmentId || loading}
            >
              <SelectTrigger id="stand">
                <Home className="h-4 w-4 mr-2" />
                <SelectValue placeholder={loading ? 'Loading...' : 'Select stand'} />
              </SelectTrigger>
              <SelectContent>
                {stands.map((stand) => (
                  <SelectItem key={stand.id} value={stand.id}>
                    Stand {stand.standNumber} - {formatCurrency(stand.balance)} available
                    {stand.clientName && ` (${stand.clientName})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {stands.length === 0 && formData.developmentId && !loading && (
              <p className="text-sm text-muted-foreground">
                No stands with available balance found in this development.
              </p>
            )}
          </div>

          {/* Stand Balance & Payout Calculation */}
          {selectedStand && calculation && (
            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Calculator className="h-4 w-4 text-blue-600" />
                <h4 className="font-medium text-sm">Payout Calculation</h4>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stand:</span>
                  <span className="font-medium">{selectedStand.standNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Customer Payments:</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(calculation.totalReceived)}
                  </span>
                </div>
                
                <div className="border-t pt-2 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Less F&C Retain:</p>
                  <div className="flex justify-between pl-4">
                    <span className="text-muted-foreground">Commission:</span>
                    <span className="text-red-500">-{formatCurrency(calculation.fcCommission)}</span>
                  </div>
                  <div className="flex justify-between pl-4">
                    <span className="text-muted-foreground">Admin Fees:</span>
                    <span className="text-red-500">-{formatCurrency(calculation.fcAdminFees)}</span>
                  </div>
                </div>
                
                {calculation.otherDeductions > 0 && (
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>(Other deductions go to developer:)</span>
                    <span>+{formatCurrency(calculation.otherDeductions)}</span>
                  </div>
                )}
                
                <div className="border-t pt-2 flex justify-between font-bold">
                  <span>Net Payout to Developer:</span>
                  <span className="text-blue-600">{formatCurrency(calculation.netPayout)}</span>
                </div>
              </div>
              
              {selectedStand.clientName && (
                <p className="text-sm text-muted-foreground pt-2 border-t">
                  <strong>Client:</strong> {selectedStand.clientName}
                </p>
              )}
            </div>
          )}
          
          {calculating && (
            <div className="bg-muted p-3 rounded-lg flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Calculating payout...</span>
            </div>
          )}

          {/* Developer Name */}
          <div className="space-y-2">
            <Label htmlFor="developerName">Developer Name</Label>
            <Input
              id="developerName"
              value={formData.developerName}
              onChange={(e) => setFormData(prev => ({ ...prev, developerName: e.target.value }))}
              placeholder="Enter developer name"
              required
            />
          </div>

          {/* Payout Type */}
          <div className="space-y-2">
            <Label htmlFor="payoutType">Payout Type</Label>
            <Select
              value={formData.payoutType}
              onValueChange={(value) => setFormData(prev => ({ ...prev, payoutType: value }))}
            >
              <SelectTrigger id="payoutType">
                <SelectValue placeholder="Select payout type" />
              </SelectTrigger>
              <SelectContent>
                {PAYOUT_TYPE_OPTIONS.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                max={selectedStand?.balance}
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
                className="pl-10"
                required
              />
            </div>
            {selectedStand && (
              <p className="text-xs text-muted-foreground">
                Maximum: {formatCurrency(selectedStand.balance)}
              </p>
            )}
          </div>

          {/* Period Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="periodStart">Period Start (Optional)</Label>
              <Input
                id="periodStart"
                type="date"
                value={formData.periodStart}
                onChange={(e) => setFormData(prev => ({ ...prev, periodStart: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="periodEnd">Period End (Optional)</Label>
              <Input
                id="periodEnd"
                type="date"
                value={formData.periodEnd}
                onChange={(e) => setFormData(prev => ({ ...prev, periodEnd: e.target.value }))}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Enter any additional details..."
              rows={3}
            />
          </div>

          {/* Submit Button */}
          <Button 
            type="submit" 
            className="w-full"
            disabled={submitting || !formData.standId}
          >
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Submit Payout Request
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
