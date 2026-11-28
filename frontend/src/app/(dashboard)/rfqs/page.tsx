"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { marketplaceService } from "@/services/marketplace.service";
import { PostRfqModal } from "@/components/rfq/PostRfqModal";
import { RfqDetailsModal } from "@/components/rfq/RfqDetailsModal";
import { InviteSuppliersModal } from "@/components/rfq/InviteSuppliersModal";
import { SupplierBuyerRequestsView } from "@/components/rfq/SupplierBuyerRequestsView";
import { BuyerMyRequestsView } from "@/components/rfq/BuyerMyRequestsView";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";
import { Rfq } from "@/types";

export default function RfqsPage() {
  const { membership } = useAuth();
  const isSupplier = membership?.role === "SUPPLIER";
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedRfqForDetails, setSelectedRfqForDetails] = useState<Rfq | null>(null);
  const [selectedRfqForInvite, setSelectedRfqForInvite] = useState<{ id: string; title: string } | null>(null);

  const loadRfqs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await marketplaceService.listMyRfqs(membership?.organizationId);
      setRfqs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to load RFQs:", error);
      setRfqs([]);
    } finally {
      setLoading(false);
    }
  }, [membership?.organizationId]);

  useEffect(() => {
    loadRfqs();
  }, [loadRfqs]);

  useRealtimeSync({
    topics: ["rfq:created", "rfq:updated", "quotation:created"],
    onSync: loadRfqs,
    pollIntervalMs: 25000,
  });

  const handleDeleteRfq = async (rfqId: string, title?: string) => {
    if (!window.confirm(`Are you sure you want to delete "${title || "this request"}"? This cannot be undone.`)) return;
    try {
      await marketplaceService.deleteRfq(rfqId);
      setRfqs((previous) => previous.filter((rfq) => rfq.id !== rfqId));
      if (selectedRfqForDetails?.id === rfqId) setSelectedRfqForDetails(null);
    } catch (error: any) {
      window.alert(error?.message || "Failed to delete RFQ");
    }
  };

  if (isSupplier) {
    return (
      <SupplierBuyerRequestsView
        rfqs={rfqs}
        loading={loading}
        onRefresh={loadRfqs}
        membership={membership}
      />
    );
  }

  return (
    <>
      <BuyerMyRequestsView
        rfqs={rfqs}
        loading={loading}
        organizationId={membership?.organizationId}
        onPostRequest={() => setIsPostModalOpen(true)}
        onOpenDetails={setSelectedRfqForDetails}
        onInviteSuppliers={(rfq) => setSelectedRfqForInvite({ id: rfq.id, title: rfq.title })}
        onDelete={(rfq) => handleDeleteRfq(rfq.id, rfq.title)}
      />

      <PostRfqModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        onSuccess={loadRfqs}
      />

      <RfqDetailsModal
        isOpen={!!selectedRfqForDetails}
        onClose={() => setSelectedRfqForDetails(null)}
        rfq={selectedRfqForDetails}
        onDelete={(id) => handleDeleteRfq(id, selectedRfqForDetails?.title)}
        onOpenInvite={() => {
          if (selectedRfqForDetails) {
            setSelectedRfqForInvite({
              id: selectedRfqForDetails.id,
              title: selectedRfqForDetails.title,
            });
          }
        }}
      />

      {selectedRfqForInvite && (
        <InviteSuppliersModal
          isOpen={!!selectedRfqForInvite}
          onClose={() => setSelectedRfqForInvite(null)}
          rfqId={selectedRfqForInvite.id}
          rfqTitle={selectedRfqForInvite.title}
        />
      )}
    </>
  );
}
