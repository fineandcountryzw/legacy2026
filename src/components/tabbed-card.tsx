"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface TabItem {
    value: string
    label: string
    content: React.ReactNode
}

interface TabbedCardProps {
    title?: string
    tabs: TabItem[]
    defaultValue?: string
}

export function TabbedCard({ title, tabs, defaultValue }: TabbedCardProps) {
    return (
        <Card className="w-full">
            <Tabs defaultValue={defaultValue || tabs[0]?.value} className="w-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    {title && <CardTitle className="text-xl font-bold">{title}</CardTitle>}
                    <TabsList>
                        {tabs.map((tab) => (
                            <TabsTrigger key={tab.value} value={tab.value}>
                                {tab.label}
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </CardHeader>
                <CardContent className="pt-6">
                    {tabs.map((tab) => (
                        <TabsContent key={tab.value} value={tab.value}>
                            {tab.content}
                        </TabsContent>
                    ))}
                </CardContent>
            </Tabs>
        </Card>
    )
}
