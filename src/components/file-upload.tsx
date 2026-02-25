"use client";

import { useState } from "react";
import { Upload, File, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FileUploadProps {
    onUpload: (file: File) => void;
    accept?: string;
    maxSize?: number; // in MB
}

export function FileUpload({ onUpload, accept, maxSize = 10 }: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) handleFileSelection(droppedFile);
    };

    const handleFileSelection = (selectedFile: File) => {
        if (maxSize && selectedFile.size > maxSize * 1024 * 1024) {
            alert(`File size exceeds ${maxSize}MB`);
            return;
        }
        setFile(selectedFile);
    };

    const clearFile = () => setFile(null);

    const handleSubmit = () => {
        if (file) onUpload(file);
    };

    return (
        <div className="space-y-4">
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={cn(
                    "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-12 transition-colors",
                    isDragging ? "border-blue-600 bg-blue-50/50" : "border-slate-200 bg-white hover:border-slate-300",
                    file && "border-emerald-200 bg-emerald-50/30"
                )}
            >
                <input
                    type="file"
                    accept={accept}
                    className="absolute inset-0 cursor-pointer opacity-0"
                    onChange={(e) => e.target.files?.[0] && handleFileSelection(e.target.files[0])}
                />

                {file ? (
                    <div className="flex flex-col items-center text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-4">
                            <CheckCircle2 size={24} />
                        </div>
                        <p className="text-lg font-semibold text-slate-900">{file.name}</p>
                        <p className="text-sm text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); clearFile(); }}
                            className="mt-4 text-slate-500 hover:text-rose-600"
                        >
                            <X size={16} className="mr-2" />
                            Remove file
                        </Button>
                    </div>
                ) : (
                    <div className="flex flex-col items-center text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-600 mb-4">
                            <Upload size={24} />
                        </div>
                        <p className="text-lg font-semibold text-slate-900">Click or drag to upload</p>
                        <p className="text-sm text-slate-500">Excel files (.xlsx, .xls) up to {maxSize}MB</p>
                    </div>
                )}
            </div>

            {file && (
                <div className="flex justify-end">
                    <Button onClick={handleSubmit} className="px-8">
                        Upload and Process
                    </Button>
                </div>
            )}
        </div>
    );
}
