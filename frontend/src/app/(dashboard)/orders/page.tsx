"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { marketplaceService } from "@/services/marketplace.service";

interface LiveOrder {
  id: string;
  poNumber: string;
  supplier: string;
  buyer: string;
  city: string;
  items: string;
  amount: string;
  rawAmount: number;
  status: string;
  progress: number;
  currentMilestone: string;
  deliveryDate: string;
}

export default function OrdersPage() {
  const { membership } = useAuth();
  const [orders, setOrders] = useState<LiveOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const isSupplier = membership?.role === "SUPPLIER";

  const loadOrders = useCallback(async () => {
    try {
      setLoading(true);
      const data = await marketplaceService.listOrders();
      if (data && data.length > 0) {
        const mapped: LiveOrder[] = data.map((po: any) => {
          const amt = Number(po.totalAmount) || 710000;
          const status = po.status || "IN_PRODUCTION";
          let progress = 30;
          if (status === "PO_CREATED" || status === "PENDING_ACCEPTANCE") progress = 10;
          else if (status === "ACCEPTED") progress = 20;
          else if (status === "SAMPLE_PENDING") progress = 30;
          else if (status === "SAMPLE_APPROVED") progress = 45;
          else if (status === "PRODUCTION_STARTED" || status === "IN_PRODUCTION") progress = 65;
          else if (status === "QC_PENDING" || status === "QC") progress = 80;
          else if (status === "READY_TO_DISPATCH") progress = 90;
          else if (status === "DISPATCHED") progress = 95;
          else if (status === "DELIVERED" || status === "COMPLETED") progress = 100;

          const activeMilestone = po.milestones?.find((m: any) => m.status === "IN_PROGRESS")?.title ||
            (status === "COMPLETED" ? "Order Fulfilled & Payment Released" :
             status === "DELIVERED" ? "Delivered at Buyer Warehouse" :
             status === "DISPATCHED" ? "In Transit (Tracking Active)" :
             status === "READY_TO_DISPATCH" ? "Packed & Ready for Carrier" :
             status === "QC_PENDING" || status === "QC" ? "Quality Inspection (AQL 2.5)" :
             status === "PRODUCTION_STARTED" || status === "IN_PRODUCTION" ? "Bulk Production Lines Active" :
             status === "SAMPLE_APPROVED" ? "Pre-Production Sample Approved" :
             status === "SAMPLE_PENDING" ? "PP Sample in Review" :
             status === "ACCEPTED" ? "Order Accepted by Factory" : "Purchase Order Generated");

          const itemName = po.items?.[0]?.name ? `${po.items[0].quantity?.toLocaleString()} pcs ${po.items[0].name}` : "Apparel Production Lot";

          return {
            id: po.id,
            poNumber: po.poNumber || `SG-PO-${po.id.slice(0, 6)}`,
            supplier: po.supplier?.name || "Sri Balaji Garments",
            buyer: po.buyer?.name || "Asha Apparel Mills",
            city: po.supplier?.city || "Tirupur",
            items: itemName,
            amount: `₹${(amt / 100000).toFixed(2)}L`,
            rawAmount: amt,
            status,
            progress,
            currentMilestone: activeMilestone,
            deliveryDate: po.expectedDate ? new Date(po.expectedDate).toLocaleDateString("en-IN") : "18 Nov 2026",
          };
        });
        setOrders(mapped);
      } else {
        setOrders([]);
      }
    } catch (err) {
      console.error("Failed to load orders:", err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = orders.filter((po) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || [po.poNumber, po.items, po.buyer, po.supplier].some((value) => value.toLowerCase().includes(query));
    const matchesStatus = statusFilter === "ALL" || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleStatusChange = async (orderId: string, nextStatus: string) => {
    try {
      setUpdatingId(orderId);
      await marketplaceService.updateOrderStatus(orderId, nextStatus, { note: `Updated status to ${nextStatus}` });
      await loadOrders();
    } catch (err) {
      console.error("Failed to update status:", err);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto pb-24 sm:pb-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 sm:pb-4 border-b border-surface-container-high">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-sans font-bold text-2xl text-on-surface">
              {isSupplier ? "Purchase Orders (POs)" : "My Orders"}
            </h1>
            <Badge variant="primary" size="sm" className="hidden sm:inline-flex">MySQL Live Sync</Badge>
          </div>
          <p className="hidden sm:block text-xs text-secondary mt-1">
            Active and fulfilled B2B garment manufacturing contracts secured by escrow milestones.
          </p>
        </div>

        {!isSupplier ? (
          <Link href="/rfqs">
            <Button variant="primary" icon="add">
              Issue New Purchase Order
            </Button>
          </Link>
        ) : (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-semibold">
            <span className="material-symbols-outlined text-[16px]">precision_manufacturing</span>
            <span>Supplier Fulfillment Mode</span>
          </div>
        )}
      </div>

      {isSupplier && (
        <div className="sm:hidden grid grid-cols-[minmax(0,1fr)_auto] gap-2.5">
          <label className="relative block min-w-0">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-[21px] text-secondary">search</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by PO ID, product or buyer..."
              aria-label="Search purchase orders"
              className="h-12 w-full rounded-2xl border border-outline-variant/50 bg-surface-container-lowest pl-11 pr-3 text-sm text-on-surface shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 placeholder:text-secondary/80"
            />
          </label>
          <label className="relative flex h-12 items-center gap-2 rounded-2xl border border-outline-variant/50 bg-surface-container-lowest px-3 shadow-sm">
            <span className="material-symbols-outlined text-[20px] text-secondary">filter_list</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter purchase orders by status"
              className="max-w-[88px] appearance-none bg-transparent pr-4 text-sm font-semibold text-on-surface outline-none"
            >
              <option value="ALL">Filter</option>
              <option value="PO_CREATED">PO Created</option>
              <option value="PENDING_ACCEPTANCE">Pending</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="SAMPLE_PENDING">Sample Pending</option>
              <option value="SAMPLE_APPROVED">Sample Approved</option>
              <option value="PRODUCTION_STARTED">Production</option>
              <option value="IN_PRODUCTION">In Production</option>
              <option value="QC_PENDING">QC Pending</option>
              <option value="READY_TO_DISPATCH">Ready to Dispatch</option>
              <option value="DISPATCHED">Dispatched</option>
              <option value="DELIVERED">Delivered</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <span className="material-symbols-outlined pointer-events-none absolute right-2 text-[18px] text-secondary">expand_more</span>
          </label>
        </div>
      )}

      {loading ? (
        <div className="p-12 text-center flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <span className="text-xs font-mono text-secondary">Loading purchase orders from database...</span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-12 text-center bg-surface-container-lowest rounded-2xl border border-outline-variant/30">
          <p className="text-sm font-bold text-on-surface">{orders.length === 0 ? "No purchase orders found" : "No matching orders"}</p>
          <p className="text-xs text-secondary mt-1">{orders.length === 0 ? "Accept an incoming quotation from the RFQ page to issue a purchase order." : "Try another search term or status filter."}</p>
          {orders.length > 0 ? <Button variant="outline" size="sm" className="mt-4" onClick={() => { setSearchQuery(""); setStatusFilter("ALL"); }}>Clear Search & Filter</Button> : <Link href="/quotations">
            <Button variant="outline" size="sm" className="mt-4" icon="compare_arrows">
              View RFQs & Quotations
            </Button>
          </Link>}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((po) => {
            const isDelivered = po.status === "DELIVERED";
            const isQc = po.status === "QC";
            return (
              <div
                key={po.id}
                className="p-4 sm:p-5 rounded-[24px] bg-surface-container-lowest border border-outline-variant/40 shadow-sm flex flex-col gap-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-mono text-xs font-bold text-primary">{po.poNumber}</span>
                      <Badge variant={isDelivered ? "success" : isQc ? "warning" : "primary"} size="sm">
                        {po.status}
                      </Badge>
                      <span className="hidden sm:inline text-xs text-secondary">
                        • {po.supplier} ({po.city})
                      </span>
                    </div>
                    <h3 className="font-sans font-bold text-[17px] leading-snug text-on-surface">{po.items}</h3>
                    <p className="text-xs text-secondary mt-0.5">
                      Buyer: <strong className="text-on-surface">{po.buyer}</strong>
                    </p>
                  </div>

                  <div className="text-left sm:text-right flex sm:block items-end justify-between gap-2 pt-1">
                    <span className="text-2xl font-bold font-mono text-primary">{po.amount}</span>
                    <p className="text-xs text-secondary font-medium">Target: {po.deliveryDate}</p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="bg-[#f7f2ff] p-3.5 sm:p-4 rounded-2xl border border-purple-100">
                  <div className="flex items-center justify-between text-xs mb-1.5 font-mono">
                    <span className="text-primary font-bold">{po.currentMilestone}</span>
                    <span className="text-secondary">{po.progress}% Completed</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-surface-container-high overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${po.progress}%` }}
                    ></div>
                  </div>
                </div>

                {/* Actions Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-surface-container-high">
                  {/* Supplier Stage Stepper Buttons */}
                  {isSupplier && po.status !== "COMPLETED" && (
                    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                      <span className="text-xs text-secondary font-medium">Supplier Action:</span>
                      {(po.status === "PO_CREATED" || po.status === "PENDING_ACCEPTANCE") && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon="verified"
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-md ring-2 ring-emerald-500/20"
                          loading={updatingId === po.id}
                          onClick={() => handleStatusChange(po.id, "ACCEPTED")}
                        >
                          Accept Order
                        </Button>
                      )}
                      {po.status === "ACCEPTED" && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon="send"
                          loading={updatingId === po.id}
                          onClick={() => handleStatusChange(po.id, "SAMPLE_PENDING")}
                        >
                          Dispatch PP Sample
                        </Button>
                      )}
                      {po.status === "SAMPLE_APPROVED" && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon="precision_manufacturing"
                          loading={updatingId === po.id}
                          onClick={() => handleStatusChange(po.id, "PRODUCTION_STARTED")}
                        >
                          Start Bulk Production
                        </Button>
                      )}
                      {(po.status === "PRODUCTION_STARTED" || po.status === "IN_PRODUCTION") && (
                        <Button
                          variant="outline"
                          size="sm"
                          icon="fact_check"
                          loading={updatingId === po.id}
                          onClick={() => handleStatusChange(po.id, "QC_PENDING")}
                        >
                          Submit for Quality Inspection
                        </Button>
                      )}
                      {(po.status === "QC_PENDING" || po.status === "QC") && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon="verified"
                          loading={updatingId === po.id}
                          onClick={() => handleStatusChange(po.id, "READY_TO_DISPATCH")}
                        >
                          Log QC Passed
                        </Button>
                      )}
                      {po.status === "READY_TO_DISPATCH" && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon="local_shipping"
                          loading={updatingId === po.id}
                          onClick={() => handleStatusChange(po.id, "DISPATCHED")}
                        >
                          Dispatch Shipment
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Buyer Stage Stepper Buttons */}
                  {!isSupplier && (
                    <div className="flex flex-wrap items-center gap-2">
                      {(po.status === "PO_CREATED" || po.status === "PENDING_ACCEPTANCE") && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-800 text-xs font-semibold border border-amber-200">
                          <span className="material-symbols-outlined text-[16px] text-amber-600 animate-spin">sync</span>
                          <span>PO Issued • Awaiting Factory Order Acceptance</span>
                        </div>
                      )}
                      {po.status === "ACCEPTED" && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-semibold border border-emerald-200">
                          <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                          <span>Order Accepted by Supplier • PP Sample in Progress</span>
                        </div>
                      )}
                      {po.status === "SAMPLE_PENDING" && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon="check_circle"
                          loading={updatingId === po.id}
                          onClick={() => handleStatusChange(po.id, "SAMPLE_APPROVED")}
                        >
                          Approve PP Sample
                        </Button>
                      )}
                      {po.status === "DISPATCHED" && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon="inventory"
                          loading={updatingId === po.id}
                          onClick={() => handleStatusChange(po.id, "DELIVERED")}
                        >
                          Confirm Delivery Received
                        </Button>
                      )}
                      {po.status === "DELIVERED" && (
                        <Button
                          variant="primary"
                          size="sm"
                          icon="payments"
                          loading={updatingId === po.id}
                          onClick={() => handleStatusChange(po.id, "COMPLETED")}
                        >
                          Release Escrow & Complete
                        </Button>
                      )}
                      {po.status === "COMPLETED" && (
                        <Link href={`/reviews?orderId=${po.id}`}>
                          <Button variant="outline" size="sm" icon="star">
                            Submit Supplier Review
                          </Button>
                        </Link>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-3 sm:flex sm:items-center gap-2 ml-auto w-full sm:w-auto">
                    <Link href={`/production?orderId=${po.id}`}>
                      <Button variant="outline" size="sm" icon="factory" className="w-full h-[68px] sm:h-9 flex-col sm:flex-row justify-center gap-1 sm:gap-1.5 px-1 text-[10px] sm:text-xs leading-tight whitespace-normal">
                        Track Milestones
                      </Button>
                    </Link>
                    <Link href="/samples">
                      <Button variant="ghost" size="sm" icon="checkroom" className="w-full h-[68px] sm:h-9 flex-col sm:flex-row justify-center gap-1 sm:gap-1.5 px-1 text-[10px] sm:text-xs leading-tight whitespace-normal">
                        View Samples
                      </Button>
                    </Link>
                    <Link href="/payments">
                      <Button variant="ghost" size="sm" icon="account_balance_wallet" className="w-full h-[68px] sm:h-9 flex-col sm:flex-row justify-center gap-1 sm:gap-1.5 px-1 text-[10px] sm:text-xs leading-tight whitespace-normal">
                        Escrow
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
