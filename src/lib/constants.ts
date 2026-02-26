import {
    LayoutDashboard,
    Upload,
    Map as MapIcon,
    Building2,
    RefreshCw,
    Users,
    FileText,
    Settings,
    BarChart3,
    Wrench
} from "lucide-react";
import { NavItem } from "@/types";

export const navItems: NavItem[] = [
    { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { title: "Uploads", href: "/dashboard/uploads", icon: Upload },
    { title: "Stands", href: "/dashboard/stands", icon: MapIcon },
    { title: "Developments", href: "/dashboard/developments", icon: Building2 },
    { title: "Reconciliation", href: "/dashboard/reconciliation", icon: RefreshCw },
    { title: "Reports", href: "/dashboard/reports", icon: BarChart3 },
    { title: "Clients", href: "/dashboard/clients", icon: Users },
    { title: "Statements", href: "/dashboard/statements", icon: FileText },
    { title: "Repair Data", href: "/dashboard/admin/repair-transactions", icon: Wrench },
    { title: "Settings", href: "/dashboard/settings", icon: Settings },
];
