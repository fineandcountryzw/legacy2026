"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

interface ColorPickerProps {
    label: string
    value: string
    onChange: (value: string) => void
    suggestedColors?: string[]
}

export function ColorPicker({
    label,
    value,
    onChange,
    suggestedColors = ["#0f172a", "#2563eb", "#10b981", "#f59e0b", "#ef4444"],
}: ColorPickerProps) {
    return (
        <div className="space-y-2">
            <Label className="text-sm font-medium">{label}</Label>
            <div className="flex items-center gap-3">
                <div
                    className="h-10 w-10 shrink-0 rounded-md border-2 shadow-sm"
                    style={{ backgroundColor: value }}
                />
                <Input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="font-mono"
                />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
                {suggestedColors.map((color) => (
                    <button
                        key={color}
                        type="button"
                        className={cn(
                            "h-6 w-6 rounded-full border border-slate-200 transition-transform hover:scale-110",
                            value === color && "ring-2 ring-slate-900 ring-offset-2"
                        )}
                        style={{ backgroundColor: color }}
                        onClick={() => onChange(color)}
                    />
                ))}
            </div>
        </div>
    )
}
