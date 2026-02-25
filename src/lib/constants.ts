import {
    LayoutDashboard,
    Upload,
    Map as MapIcon,
    Building2,
    RefreshCw,
    Users,
    FileText,
    Settings
} from "lucide-react";
import { NavItem, Stand, Development, Transaction } from "@/types";

export const navItems: NavItem[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { title: "Uploads", href: "/dashboard/uploads", icon: Upload },
    { title: "Stand Inventory", href: "/dashboard/stands", icon: MapIcon },
    { title: "Developments", href: "/dashboard/developments", icon: Building2 },
    { title: "Reconciliation", href: "/dashboard/reconciliation", icon: RefreshCw },
    { title: "Clients", href: "/dashboard/clients", icon: Users },
    { title: "Statements", href: "/dashboard/statements", icon: FileText },
    { title: "Settings", href: "/dashboard/settings", icon: Settings },
];

export const MOCK_DEVELOPMENTS: Development[] = [
    {
        id: "dev-1",
        name: "Green Valley Estate",
        code: "GVE",
        currency: "USD",
        developerName: "Valley Devs Ltd",
        developerContacts: "contact@valleydevs.com",
        commissionRate: 0.05,
        totalStands: 150,
        soldStands: 120,
        availableStands: 30,
        totalReceived: 1200000,
        developerPayable: 1100000,
        fineCountryRetain: 100000,
        standTypes: [
            { id: "st-1", label: "300sqm Corner", sizeSqm: 300, basePrice: 15000, isActive: true },
            { id: "st-2", label: "400sqm Standard", sizeSqm: 400, basePrice: 20000, isActive: true },
        ],
        costs: [
            { id: "c-1", name: "Admin Fee", type: "fixed", value: 500, appliesTo: "all", payTo: "fine_country", isVariable: true, isActive: true },
        ],
        branding: {
            id: "b-1",
            companyName: "Fine & Country",
            colors: { primary: "#0f172a", secondary: "#2563eb", accent: "#3b82f6" }
        }
    }
];

export const MOCK_STANDS: Stand[] = [
    {
        id: "s-1",
        standNumber: "101",
        developmentId: "dev-1",
        developmentName: "Green Valley Estate",
        standTypeId: "st-1",
        standTypeLabel: "300sqm Corner",
        status: "Sold",
        clientName: "John Doe",
        agreedPrice: 15500,
        totalPaid: 10000,
        balance: 5500,
        allocations: []
    }
];

export const MOCK_TRANSACTIONS: Transaction[] = [
    { id: "t-1", date: "2024-03-10", amount: 1500, standNumber: "101", developmentId: "dev-1", reference: "DEP-GVE-101", status: "Unmatched" }
];
