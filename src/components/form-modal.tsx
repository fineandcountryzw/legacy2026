"use client"

import * as React from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

interface FormModalProps {
    title: string
    description?: string
    isOpen: boolean
    onClose: () => void
    children: React.ReactNode
    maxWidth?: string
}

export function FormModal({
    title,
    description,
    isOpen,
    onClose,
    children,
    maxWidth = "max-w-xl",
}: FormModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={maxWidth}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && <DialogDescription>{description}</DialogDescription>}
                </DialogHeader>
                <div className="py-4">{children}</div>
            </DialogContent>
        </Dialog>
    )
}
