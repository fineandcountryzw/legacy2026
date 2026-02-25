import { cn } from "@/lib/utils";
import { Currency } from "@/types";

interface MoneyProps {
    amount: number;
    currency?: Currency;
    className?: string;
    showSymbol?: boolean;
}

const currencySymbols: Record<Currency, string> = {
    USD: "$",
    ZIG: "ZiG",
    ZAR: "R",
};

export function Money({ amount, currency = "USD", className, showSymbol = true }: MoneyProps) {
    const formattedAmount = new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(amount);

    return (
        <span className={cn("font-medium", className)}>
            {showSymbol && <span className="mr-0.5 text-slate-500">{currencySymbols[currency]}</span>}
            {formattedAmount}
        </span>
    );
}
