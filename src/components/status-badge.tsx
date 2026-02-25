import { Badge } from "@/components/ui/badge";
import { Status } from "@/types";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
    status: Status;
    className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
    const getVariant = (s: Status) => {
        switch (s) {
            case "Available":
            case "Completed":
                return "success";
            case "Sold":
            case "Processing":
                return "info";
            case "Unassigned":
            case "Failed":
                return "destructive";
            case "Disputed":
                return "warning";
            default:
                return "secondary";
        }
    };

    return (
        <Badge variant={getVariant(status)} className={cn("capitalize", className)}>
            {status}
        </Badge>
    );
}
