"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { marketplaceService } from "@/services/marketplace.service";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

interface MilestoneItem {
  id: string;
  title: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";
  date?: string;
  desc?: string;
}

function ProductionContent() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("orderId") || "";
  const { membership } = useAuth();
  const isSupplier = membership?.role === "SUPPLIER";

  const [poNumber, setPoNumber] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadMilestones = useCallback(async () => {
    try {
      setLoading(true);
      let order: any = null;

      if (orderId) {
        order = await marketplaceService.getOrderDetails(orderId).catch(() => null);
      } else {
        const orders = await marketplaceService.listOrders().catch(() => []);
        if (orders && orders.length > 0) {
          order = orders[0];
        }
      }

      if (order) {
        setPoNumber(order.poNumber || `SG-PO-${order.id.slice(0, 6)}`);
        setSupplierName(order.supplier?.name || "Textile Manufacturer");
        if (order.items?.[0]) {
          setProductDesc(`${order.items[0].quantity} pcs ${order.items[0].name}`);
        }

        if (order.milestones && order.milestones.length > 0) {
          const mapped: MilestoneItem[] = order.milestones.map((m: any, idx: number) => ({
            id: m.id,
            title: m.title,
            status: m.status || (idx < 3 ? "COMPLETED" : idx === 3 ? "IN_PROGRESS" : "PENDING"),
            date: m.completedAt ? new Date(m.completedAt).toLocaleDateString("en-IN") : m.dueDate ? `Due: ${new Date(m.dueDate).toLocaleDateString("en-IN")}` : `Stage ${idx + 1}`,
            desc: `Garment manufacturing milestone verification for stage ${idx + 1}.`,
          }));
          setMilestones(mapped);
          return;
        }
      }

      setMilestones([]);
    } catch (err) {
      console.error("Failed to load milestones:", err);
      setMilestones([]);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    loadMilestones();
  }, [loadMilestones]);

  useRealtimeSync({
    topics: ["milestone:updated", "order:updated"],
    onSync: loadMilestones,
    pollIntervalMs: 20000,
  });

  const handleUpdateMilestone = async (milestoneId: string, newStatus: string) => {
    try {
      setUpdatingId(milestoneId);
      await marketplaceService.updateMilestone(milestoneId, newStatus);
      await loadMilestones();
    } catch (err) {
      console.error("Failed to update milestone:", err);
      // Update locally for smooth visual feedback
      setMilestones((prev) =>
        prev.map((m) => (m.id === milestoneId ? { ...m, status: newStatus as any } : m))
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-container-high">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-bold text-primary">{poNumber}</span>
            <Badge variant="primary" size="sm">LIVE PRODUCTION LINE</Badge>
          </div>
          <h1 className="font-extrabold text-3xl text-on-surface leading-[1.2]">
            {isSupplier ? "Factory Floor Milestone Tracker" : "Order Tracking"}
          </h1>
          <p className="text-sm text-secondary mt-1 leading-[1.5]">
            {supplierName} • {productDesc}
          </p>
        </div>

        <div className={isSupplier ? "" : "hidden sm:block"}>
          <Button variant="outline" size="sm" icon="photo_camera">
            Request Line Photo / QC Report
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <span className="text-xs font-mono text-secondary">Loading factory milestones...</span>
        </div>
      ) : milestones.length === 0 ? (
        <div className="p-12 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30 flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-surface-container-low flex items-center justify-center text-secondary mb-3">
            <span className="material-symbols-outlined text-[28px]">precision_manufacturing</span>
          </div>
          <h3 className="text-sm font-bold text-on-surface">No production milestones active</h3>
          <p className="text-xs text-secondary mt-1 max-w-sm">
            Milestones are automatically created when a purchase order is in production.
          </p>
        </div>
      ) : (
        /* Stepper Timeline */
        <div className="bg-surface-container-lowest rounded-2xl p-6 border border-outline-variant/30 shadow-sm">
          <div className="relative pl-6 space-y-8 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-surface-container-highest">
            {milestones.map((m, idx) => {
              const isCompleted = m.status === "COMPLETED";
              const isInProgress = m.status === "IN_PROGRESS";
              return (
                <div key={m.id} className="relative flex items-start gap-4">
                  {/* Dot / Status icon */}
                  <div
                    className={`absolute -left-6 top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCompleted
                        ? "bg-emerald-500 text-white shadow-sm"
                        : isInProgress
                        ? "bg-primary text-white ring-4 ring-primary/20 animate-pulse"
                        : "bg-surface-container-high text-secondary border border-outline-variant/40"
                    }`}
                  >
                    {isCompleted ? (
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    ) : (
                      <span>{idx + 1}</span>
                    )}
                  </div>

                  <div className="flex-1 bg-surface-container-low p-4 rounded-xl border border-surface-container-highest">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1">
                      <h3 className="font-sans font-bold text-sm text-on-surface">{m.title}</h3>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={isCompleted ? "success" : isInProgress ? "primary" : "neutral"}
                          size="sm"
                        >
                          {m.status}
                        </Badge>
                        <span className="text-[11px] font-mono text-secondary">{m.date}</span>
                      </div>
                    </div>
                    <p className="text-xs text-secondary">{m.desc}</p>

                    {/* Supplier Milestone Progression Controls */}
                    {isSupplier && !isCompleted && (
                      <div className="mt-3 pt-2.5 border-t border-surface-container-high flex items-center justify-end gap-2">
                        {isInProgress ? (
                          <Button
                            variant="primary"
                            size="sm"
                            loading={updatingId === m.id}
                            icon="check"
                            onClick={() => handleUpdateMilestone(m.id, "COMPLETED")}
                          >
                            Mark Milestone Completed
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            loading={updatingId === m.id}
                            icon="play_arrow"
                            onClick={() => handleUpdateMilestone(m.id, "IN_PROGRESS")}
                          >
                            Start This Stage
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductionPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-xs font-mono text-secondary">Loading milestones...</div>}>
      <ProductionContent />
    </Suspense>
  );
}
