"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/common/Badge";
import { Button } from "@/components/common/Button";
import { Modal } from "@/components/common/Modal";
import { marketplaceService } from "@/services/marketplace.service";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

interface TransactionItem {
  id: string;
  po: string;
  supplier: string;
  amount: string;
  rawAmount: number;
  type: string;
  status: "HELD_IN_ESCROW" | "RELEASED" | "COMPLETED" | "REFUNDED" | "PENDING";
  date: string;
}

export default function PaymentsPage() {
  const { membership } = useAuth();
  const isSupplier = membership?.role === "SUPPLIER";

  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [totalEscrow, setTotalEscrow] = useState(0);
  const [pendingReleases, setPendingReleases] = useState(0);
  const [settledTotal, setSettledTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isDepositModalOpen, setIsDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositing, setDepositing] = useState(false);

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
      const data = await marketplaceService.listPayments();
      if (data && data.length > 0) {
        let total = 0;
        let pending = 0;
        let settled = 0;

        const mapped: TransactionItem[] = data.map((t: any) => {
          const amt = Number(t.amount) || 0;
          total += amt;
          if (t.status === "RELEASED" || t.status === "COMPLETED") {
            settled += amt;
          } else {
            pending += amt;
          }

          return {
            id: t.providerRef || t.id.slice(0, 10),
            po: t.purchaseOrder?.poNumber || "PO Order",
            supplier: t.purchaseOrder?.supplier?.name || "Manufacturing Supplier",
            amount: `₹${amt.toLocaleString("en-IN")}`,
            rawAmount: amt,
            type: "Milestone Secure Payment Deposit",
            status: t.status || "HELD_IN_ESCROW",
            date: new Date(t.createdAt).toLocaleDateString("en-IN"),
          };
        });

        setTransactions(mapped);
        setTotalEscrow(total);
        setPendingReleases(pending);
        setSettledTotal(settled);
      } else {
        setTransactions([]);
        setTotalEscrow(0);
        setPendingReleases(0);
        setSettledTotal(0);
      }
    } catch (err) {
      console.error("Failed to load payments:", err);
      setTransactions([]);
      setTotalEscrow(0);
      setPendingReleases(0);
      setSettledTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  useRealtimeSync({
    topics: ["payment:created", "payment:updated", "order:updated"],
    onSync: loadPayments,
    pollIntervalMs: 25000,
  });

  const handleDepositEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setDepositing(true);
      const amt = parseFloat(depositAmount) || 0;
      if (amt <= 0) return;
      const orders = await marketplaceService.listOrders().catch(() => []);
      if (!orders || orders.length === 0) {
        alert("Please create or select an active purchase order first.");
        return;
      }
      const orderId = orders[0].id;
      await marketplaceService.createPayment(orderId, amt);
      setDepositAmount("");
      setIsDepositModalOpen(false);
      await loadPayments();
    } catch (err) {
      console.error("Deposit error:", err);
    } finally {
      setDepositing(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-surface-container-high">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-3xl text-on-surface leading-[1.2]">
              {isSupplier ? "Secure Payments & Milestone Releases" : "Payments"}
            </h1>
            <Badge variant="primary" size="sm">B2B Vault Protected</Badge>
          </div>
          <p className="text-sm text-secondary mt-1 leading-[1.5]">
            Secure garment payments backed by milestone-based releases. Payments are released after required quality checks.
          </p>
        </div>

        {!isSupplier ? (
          <Button variant="primary" icon="security" onClick={() => setIsDepositModalOpen(true)}>
            Add Secure Payment
          </Button>
        ) : (
          <Button variant="outline" icon="account_balance">
            Bank Settlement Accounts
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <span className="text-xs font-semibold text-secondary uppercase font-sans">Total Secure Balance</span>
          <p className="text-2xl font-bold font-mono text-primary mt-2">
            ₹{(totalEscrow / 100000).toFixed(2)}L
          </p>
          <p className="text-[11px] text-secondary mt-1">Secured in nodal bank account</p>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <span className="text-xs font-semibold text-secondary uppercase font-sans">Pending Releases</span>
          <p className="text-2xl font-bold font-mono text-amber-700 mt-2">
            ₹{(pendingReleases / 100000).toFixed(2)}L
          </p>
          <p className="text-[11px] text-secondary mt-1">Awaiting inspection and milestone pass</p>
        </div>

        <div className="p-5 rounded-2xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm">
          <span className="text-xs font-semibold text-secondary uppercase font-sans">Settled Total</span>
          <p className="text-2xl font-bold font-mono text-emerald-700 mt-2">
            ₹{(settledTotal / 100000).toFixed(2)}L
          </p>
          <p className="text-[11px] text-secondary mt-1">Disbursed to manufacturers</p>
        </div>
      </div>

      <div className="bg-surface-container-lowest rounded-2xl p-5 border border-outline-variant/30 shadow-sm">
        <h2 className="font-sans font-bold text-base text-on-surface mb-4">Payment Ledger</h2>
        {loading ? (
          <div className="p-8 text-center text-xs font-mono text-secondary">Loading ledger transactions...</div>
        ) : transactions.length === 0 ? (
          <div className="p-8 text-center flex flex-col items-center justify-center">
            <span className="material-symbols-outlined text-[32px] text-secondary mb-2">account_balance_wallet</span>
            <p className="text-sm font-bold text-on-surface">No payment transactions found</p>
            <p className="text-xs text-secondary mt-0.5">Transactions will appear here when purchase order milestones are funded.</p>
          </div>
        ) : (
          <div className="divide-y divide-surface-container-high text-xs">
            {transactions.map((t) => (
              <div key={t.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-bold text-primary">{t.id}</span>
                    <Badge variant={t.status === "RELEASED" || t.status === "COMPLETED" ? "success" : "warning"} size="sm">
                      {t.status}
                    </Badge>
                    <span className="text-secondary">{t.po}</span>
                  </div>
                  <p className="font-semibold text-on-surface">{t.supplier} • {t.type}</p>
                </div>

                <div className="sm:text-right">
                  <span className="font-mono font-bold text-sm text-on-surface">{t.amount}</span>
                  <p className="text-[11px] text-secondary font-mono">{t.date}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Secure Payment Modal */}
      <Modal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        title="Add Secure Payment"
        description="Transfer funds into the STITCHGRID nodal vault for your active purchase order. Funds remain safe until you approve milestones."
      >
        <form onSubmit={handleDepositEscrow} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-secondary uppercase mb-1">
              Deposit Amount (INR)
            </label>
            <input
              type="number"
              required
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="e.g. 50000"
              className="w-full h-10 px-3 rounded-xl border border-outline-variant/40 text-sm font-mono focus:outline-none focus:border-primary"
            />
          </div>

          <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-highest text-xs text-secondary">
            <p className="font-semibold text-on-surface mb-1">Secure Payment Protection:</p>
            <p>Funds cannot be withdrawn by the manufacturer until cutting, stitching, and AQL 2.5 quality certificates are uploaded and signed off by the buyer.</p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-surface-container-high">
            <Button variant="ghost" size="sm" type="button" onClick={() => setIsDepositModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={depositing} icon="lock">
              Confirm Secure Payment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
