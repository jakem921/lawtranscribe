"use client"

import React from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LucideProps } from "lucide-react"

interface CategoryItem {
  [key: string]: string
}

interface CategoryProps {
  title: string
  items: CategoryItem[]
  gridSpan?: string
  icon?: React.ForwardRefExoticComponent<Omit<LucideProps, "ref"> & React.RefAttributes<SVGSVGElement>>
}

const CategoryCard: React.FC<CategoryProps> = ({ title, items, gridSpan, icon: Icon }) => {
  return (
    <Card className={`h-full ${gridSpan}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5" />}
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[200px] pr-4">
          {items.length === 0 ? (
            <p className="text-muted-foreground">No items available.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item, index) => (
                <li key={index} className="bg-muted p-2 rounded-md">
                  {Object.entries(item).map(([key, value]) => {
                    const formattedKey = key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                    let formattedValue = value;
                    if (key === 'due_date' && value.includes('T')) {
                      formattedValue = value.split('T')[0];
                    }
                    return (
                      <div key={key}>
                        <strong className="text-primary">{formattedKey}:</strong> {formattedValue}
                      </div>
                    );
                  })}
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  )
}

export default CategoryCard
