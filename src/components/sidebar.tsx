"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { navItems } from "@/lib/constants";
import { ChevronLeft, ChevronRight, LayoutDashboard } from "lucide-react";
import { useState } from "react";

export function Sidebar() {
    const pathname = usePathname();
    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <aside
            className={cn(
                "flex flex-col border-r bg-white transition-all duration-300 ease-in-out",
                isCollapsed ? "w-20" : "w-64"
            )}
        >
            <div className="flex h-16 items-center border-b px-6">
                <Link href="/dashboard" className="flex items-center gap-2 font-bold text-slate-900">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
                        <LayoutDashboard size={20} />
                    </div>
                    {!isCollapsed && <span className="truncate">StandInv</span>}
                </Link>
            </div>

            <nav className="flex-1 space-y-1 p-4">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-slate-900 text-white"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                                isCollapsed && "justify-center"
                            )}
                        >
                            <item.icon size={20} className={cn(isActive ? "text-white" : "text-slate-400")} />
                            {!isCollapsed && <span className="truncate">{item.title}</span>}
                        </Link>
                    );
                })}
            </nav>

            <div className="border-t p-4">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start gap-2"
                    onClick={() => setIsCollapsed(!isCollapsed)}
                >
                    {isCollapsed ? <ChevronRight size={20} /> : (
                        <>
                            <ChevronLeft size={20} />
                            <span>Collapse Sidebar</span>
                        </>
                    )}
                </Button>
            </div>
        </aside>
    );
}
