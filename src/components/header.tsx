"use client";

import { usePathname } from "next/navigation";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { UserButton } from "@clerk/nextjs";

export function Header() {
    const pathname = usePathname();
    const paths = pathname.split("/").filter(Boolean);

    return (
        <header className="flex h-16 items-center justify-between border-b bg-white px-8">
            <Breadcrumb>
                <BreadcrumbList>
                    {paths.map((path, index) => {
                        const href = `/${paths.slice(0, index + 1).join("/")}`;
                        const isLast = index === paths.length - 1;
                        const label = path.charAt(0).toUpperCase() + path.slice(1);

                        return (
                            <div key={href} className="flex items-center gap-2">
                                <BreadcrumbItem>
                                    {isLast ? (
                                        <BreadcrumbPage>{label}</BreadcrumbPage>
                                    ) : (
                                        <BreadcrumbLink href={href}>{label}</BreadcrumbLink>
                                    )}
                                </BreadcrumbItem>
                                {!isLast && <BreadcrumbSeparator />}
                            </div>
                        );
                    })}
                </BreadcrumbList>
            </Breadcrumb>

            <div className="flex items-center gap-4">
                <UserButton afterSignOutUrl="/" />
            </div>
        </header>
    );
}
