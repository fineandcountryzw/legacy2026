import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4 text-center">
      <div className="max-w-3xl space-y-6">
        <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl">
          Stand Inventory & <span className="text-blue-600">Reconciliation</span>
        </h1>
        <p className="text-xl text-slate-600">
          Professional finance-style management system for stand inventories,
          developments, and automated payment reconciliation.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link href="/dashboard">
            <Button size="lg" className="h-12 px-8">
              Go to Dashboard
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
