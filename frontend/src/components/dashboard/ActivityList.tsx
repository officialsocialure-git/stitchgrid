import React from "react";

export interface ActivityItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "rfq" | "quote" | "order" | "milestone" | "qc";
}

export function ActivityList({ items }: { items: ActivityItem[] }) {
  const typeIcons: Record<string, { icon: string; bg: string; color: string }> = {
    rfq: { icon: "request_quote", bg: "bg-purple-100", color: "text-purple-700" },
    quote: { icon: "receipt_long", bg: "bg-blue-100", color: "text-blue-700" },
    order: { icon: "shopping_cart", bg: "bg-emerald-100", color: "text-emerald-700" },
    milestone: { icon: "flag", bg: "bg-amber-100", color: "text-amber-700" },
    qc: { icon: "fact_check", bg: "bg-rose-100", color: "text-rose-700" },
  };

  return (
    <div className="divide-y divide-surface-container-high">
      {items.map((item) => {
        const conf = typeIcons[item.type] || typeIcons.order;
        return (
          <div key={item.id} className="py-3.5 flex items-start gap-3 hover:bg-surface-container-low/50 px-2 rounded-xl transition-colors">
            <div className={`w-9 h-9 rounded-xl ${conf.bg} ${conf.color} flex items-center justify-center shrink-0`}>
              <span className="material-symbols-outlined text-[18px]">{conf.icon}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-on-surface truncate">{item.title}</p>
                <span className="text-[10px] text-secondary font-mono">{item.time}</span>
              </div>
              <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-1">{item.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

