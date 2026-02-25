import { LucideIcon } from "lucide-react";

export type Status = "Available" | "Sold" | "Unassigned" | "Disputed" | "Processing" | "Completed" | "Failed";
export type Currency = "USD" | "ZIG" | "ZAR";
export type CostType = "fixed" | "percentage" | "per_sqm" | "per_stand";
export type AppliesTo = "all" | "sold_only" | "contract_only" | "transfer_only";
export type PayTo = "fine_country" | "developer" | "third_party";
export type AllocationType = "stand_price" | "admin_fee" | "legal_fee" | "commission" | "other_cost" | "refund";

export interface StandType {
    id: string;
    label: string;
    sizeSqm: number;
    basePrice: number;
    isActive: boolean;
}

export interface CostItem {
    id: string;
    name: string;
    type: CostType;
    value: number;
    appliesTo: AppliesTo;
    payTo: PayTo;
    isVariable: boolean;
    isActive: boolean;
}

export interface BrandProfile {
    id: string;
    companyName: string;
    logoUrl?: string;
    contactDetails: string;
    colors: {
        primary: string;
        secondary: string;
        accent: string;
    };
}

export interface Development {
    id: string;
    name: string;
    code: string;
    currency: Currency;
    developerName: string;
    developerContacts: string;
    commissionRate: number; // e.g., 0.05 for 5%
    totalStands: number;
    soldStands: number;
    availableStands: number;
    totalReceived: number;
    developerPayable: number;
    fineCountryRetain: number;
    standTypes: StandType[];
    costs: CostItem[];
    branding?: BrandProfile;
}

export interface Allocation {
    id: string;
    transactionId: string;
    type: AllocationType;
    payTo: PayTo;
    amount: number;
}

export interface Stand {
    id: string;
    standNumber: string;
    developmentId: string;
    developmentName: string;
    standTypeId: string;
    standTypeLabel: string;
    status: "Available" | "Sold" | "Unassigned" | "Disputed";
    clientId?: string;
    clientName?: string;
    agreedPrice: number;
    totalPaid: number;
    balance: number;
    allocations: Allocation[];
}

export interface Transaction {
    id: string;
    date: string;
    amount: number;
    standNumber: string;
    developmentId: string;
    reference: string;
    description?: string;
    status: "Matched" | "Unmatched" | "Mismatch";
}

export interface Client {
    id: string;
    name: string;
    email: string;
    phone: string;
}

export interface UploadHistory {
    id: string;
    fileName: string;
    developmentName?: string;
    date: string;
    standsDetected: number;
    transactionsDetected: number;
    status: "Processing" | "Completed" | "Failed";
}

export interface NavItem {
    title: string;
    href: string;
    icon: LucideIcon;
}
