'use client';

import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Clock, 
  DollarSign,
  Building,
  User,
  Calendar,
  ArrowRight,
  Loader2,
  Filter,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DeveloperPayout, PayoutSummary } from '@/lib/auth/types';
import { PAYOUT_STATUS_CONFIG, PAYOUT_TYPE_OPTIONS } from '@/lib/auth/rbac';
import { formatCurrency, formatDate } from '@/lib/utils';

interface PayoutApprovalQueueProps {
  onPayoutUpdated?: () => void;
}

export function PayoutApprovalQueue({ onPayoutUpdated }: PayoutApprovalQueueProps) {
  const [payouts, setPayouts] = useState<DeveloperPayout[]>([]);
  const [summary, setSummary] = useState<PayoutSummary['summary'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPayout, setSelectedPayout] = useState<DeveloperPayout | null>(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [processing, setProcessing] = useState(false);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [developerFilter, setDeveloperFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('PENDING');

  const fetchPayouts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter && statusFilter !== 'all') params.append('status', statusFilter);
      if (developerFilter && developerFilter !== 'all') params.append('developer', developerFilter);
      
      const response = await fetch(`/api/payouts?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch payouts');
      
      const data = await response.json();
      setPayouts(data.payouts);
      setSummary(data.summary);
    } catch (error) {
      toast.error('Failed to load payouts');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, [statusFilter, developerFilter]);

  const handleApprove = async () => {
    if (!selectedPayout) return;
    
    try {
      setProcessing(true);
      const response = await fetch(`/api/payouts/${selectedPayout.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true, notes: approvalNotes }),
      });
      
      if (!response.ok) throw new Error('Failed to approve payout');
      
      toast.success('Payout approved successfully');
      setSelectedPayout(null);
      setApprovalNotes('');
      setActionType(null);
      fetchPayouts();
      onPayoutUpdated?.();
    } catch (error) {
      toast.error('Failed to approve payout');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPayout) return;
    
    try {
      setProcessing(true);
      const response = await fetch(`/api/payouts/${selectedPayout.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: false, notes: approvalNotes }),
      });
      
      if (!response.ok) throw new Error('Failed to reject payout');
      
      toast.success('Payout rejected');
      setSelectedPayout(null);
      setApprovalNotes('');
      setActionType(null);
      fetchPayouts();
      onPayoutUpdated?.();
    } catch (error) {
      toast.error('Failed to reject payout');
      console.error(error);
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkPaid = async (payout: DeveloperPayout) => {
    // This would open a dialog to enter payment details
    // For now, just a placeholder
    toast.info('Mark as paid functionality - implement payment dialog');
  };

  const filteredPayouts = payouts.filter(payout => {
    const searchMatch = 
      searchTerm === '' ||
      payout.developerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payout.standNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payout.developmentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payout.requestedByName?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return searchMatch;
  });

  // Get unique developers for filter
  const developers = Array.from(new Set(payouts.map(p => p.developerName)));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold">{summary.totalPending}</p>
                  <p className="text-sm text-yellow-600">{formatCurrency(summary.pendingAmount)}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Approved</p>
                  <p className="text-2xl font-bold">{summary.totalApproved}</p>
                  <p className="text-sm text-blue-600">{formatCurrency(summary.approvedAmount)}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Paid</p>
                  <p className="text-2xl font-bold">{summary.totalPaid}</p>
                  <p className="text-sm text-green-600">{formatCurrency(summary.paidAmount)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Value</p>
                  <p className="text-2xl font-bold">
                    {formatCurrency(summary.pendingAmount + summary.approvedAmount + summary.paidAmount)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {summary.totalPending + summary.totalApproved + summary.totalPaid} payouts
                  </p>
                </div>
                <AlertCircle className="h-8 w-8 text-gray-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search payouts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="PAID">Paid</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={developerFilter} onValueChange={setDeveloperFilter}>
              <SelectTrigger className="w-[180px]">
                <Building className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Developer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Developers</SelectItem>
                {developers.map(dev => (
                  <SelectItem key={dev} value={dev}>{dev}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Payouts Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            {statusFilter === 'PENDING' ? 'Pending Approvals' : 'All Payouts'}
            {filteredPayouts.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({filteredPayouts.length})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPayouts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No payouts found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPayouts.map((payout) => {
                const statusConfig = PAYOUT_STATUS_CONFIG[payout.status];
                const payoutTypeLabel = PAYOUT_TYPE_OPTIONS.find(
                  t => t.value === payout.payoutType
                )?.label || payout.payoutType;
                
                return (
                  <div
                    key={payout.id}
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Stand & Developer Info */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={`${statusConfig.bgColor} ${statusConfig.color} border-0`}>
                            {statusConfig.label}
                          </Badge>
                          <Badge variant="outline">{payoutTypeLabel}</Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Stand</p>
                            <p className="font-medium">{payout.standNumber || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Development</p>
                            <p className="font-medium">{payout.developmentName || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Developer</p>
                            <p className="font-medium">{payout.developerName}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Net Payout</p>
                            <p className="font-medium text-lg text-blue-600">{formatCurrency(payout.amount)}</p>
                          </div>
                        </div>
                        
                        {/* Payout Breakdown */}
                        {(payout.totalReceived !== undefined) && (
                          <div className="mt-3 p-3 bg-muted/50 rounded text-xs space-y-1">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Total Received:</span>
                              <span>{formatCurrency(payout.totalReceived)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">F&C Commission:</span>
                              <span className="text-red-500">-{formatCurrency(payout.fcCommission || 0)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">F&C Admin Fees:</span>
                              <span className="text-red-500">-{formatCurrency(payout.fcAdminFees || 0)}</span>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            Requested by {payout.requestedByName || 'Unknown'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(payout.requestedAt)}
                          </span>
                          {payout.periodStart && payout.periodEnd && (
                            <span className="flex items-center gap-1 text-blue-600">
                              <Calendar className="h-3 w-3" />
                              Period: {formatDate(payout.periodStart)} - {formatDate(payout.periodEnd)}
                            </span>
                          )}
                        </div>
                        
                        {payout.description && (
                          <p className="mt-2 text-sm text-muted-foreground">
                            {payout.description}
                          </p>
                        )}
                        
                        {payout.approvalNotes && (
                          <p className="mt-2 text-sm bg-muted p-2 rounded">
                            <strong>Notes:</strong> {payout.approvalNotes}
                          </p>
                        )}
                      </div>
                      
                      {/* Right: Actions */}
                      <div className="flex items-center gap-2">
                        {payout.status === 'PENDING' && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedPayout(payout);
                                setActionType('reject');
                              }}
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedPayout(payout);
                                setActionType('approve');
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Approve
                            </Button>
                          </>
                        )}
                        
                        {payout.status === 'APPROVED' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkPaid(payout)}
                          >
                            <DollarSign className="h-4 w-4 mr-1" />
                            Mark Paid
                          </Button>
                        )}
                        
                        {payout.status === 'PAID' && (
                          <div className="text-sm text-muted-foreground">
                            <p>Paid by {payout.paidByName}</p>
                            <p>{formatDate(payout.paidAt)}</p>
                            <p className="text-xs">{payout.paymentMethod} - {payout.paymentReference}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Approval/Rejection Dialog */}
      <Dialog open={!!selectedPayout} onOpenChange={() => setSelectedPayout(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve Payout' : 'Reject Payout'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve' 
                ? 'Are you sure you want to approve this payout?' 
                : 'Are you sure you want to reject this payout?'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPayout && (
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p><strong>Developer:</strong> {selectedPayout.developerName}</p>
              <p><strong>Amount:</strong> {formatCurrency(selectedPayout.amount)}</p>
              <p><strong>Stand:</strong> {selectedPayout.standNumber}</p>
              <p><strong>Development:</strong> {selectedPayout.developmentName}</p>
            </div>
          )}
          
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {actionType === 'approve' ? 'Approval Notes (optional)' : 'Rejection Reason'}
            </label>
            <Textarea
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder={actionType === 'approve' ? 'Add any notes...' : 'Please provide a reason...'}
            />
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedPayout(null);
                setApprovalNotes('');
                setActionType(null);
              }}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              variant={actionType === 'reject' ? 'destructive' : 'default'}
              onClick={actionType === 'approve' ? handleApprove : handleReject}
              disabled={processing || (actionType === 'reject' && !approvalNotes.trim())}
            >
              {processing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {actionType === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
