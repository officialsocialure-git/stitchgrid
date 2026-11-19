import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal as RNModal,
  TextInput,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { marketplaceService } from "../../services/marketplace.service";
import { useAuth } from "../../hooks/useAuth";

interface BuyerContact {
  id: string;
  name: string;
  city?: string;
  poNumber?: string;
  category?: string;
}

interface SupplierNewChatModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectBuyer: (buyer: { id: string; name: string; city?: string }) => void;
}

export const SupplierNewChatModal: React.FC<SupplierNewChatModalProps> = ({
  visible,
  onClose,
  onSelectBuyer,
}) => {
  const { activeMembership } = useAuth();
  const [buyers, setBuyers] = useState<BuyerContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (visible) {
      loadBuyers();
    }
  }, [visible, activeMembership?.organizationId]);

  const loadBuyers = async () => {
    try {
      setLoading(true);
      // Fetch only buyers connected to the active supplier organization.
      const supplierOrganizationId = activeMembership?.organizationId;
      if (!supplierOrganizationId) {
        setBuyers([]);
        return;
      }
      const [allOrders, rfqs] = await Promise.all([
        marketplaceService.listOrders(),
        marketplaceService.listMyRfqs(supplierOrganizationId),
      ]);
      const orders = (Array.isArray(allOrders) ? allOrders : []).filter(
        (order) => order.supplierOrgId === supplierOrganizationId
      );

      const list: BuyerContact[] = [];
      const seenIds = new Set<string>();

      // Extract from purchase orders
      if (Array.isArray(orders)) {
        for (const order of orders) {
          const buyer = order.buyer || order.buyerOrg;
          if (buyer && buyer.id && !seenIds.has(buyer.id)) {
            seenIds.add(buyer.id);
            list.push({
              id: buyer.id,
              name: buyer.name || "Buyer not available",
              city: buyer.city || "Location not provided",
              poNumber: order.poNumber,
              category: order.items?.[0]?.description || (order as any).styleName || "Garment Order",
            });
          }
        }
      }

      // Extract from RFQs
      if (Array.isArray(rfqs)) {
        for (const rfq of rfqs) {
          const buyer = (rfq as any).buyer;
          if (buyer && buyer.id && !seenIds.has(buyer.id)) {
            seenIds.add(buyer.id);
            list.push({
              id: buyer.id,
              name: buyer.name || "Buyer not available",
              city: buyer.city || "Location not provided",
              poNumber: rfq.id,
              category: rfq.title || rfq.garmentType || "Garment Requirement",
            });
          }
        }
      }

      setBuyers(list);
    } catch (err) {
      console.warn("Failed to load buyers:", err);
      setBuyers([]);
    } finally {
      setLoading(false);
    }
  };

  const filtered = buyers.filter((b) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const name = (b.name || "").toLowerCase();
    const city = (b.city || "").toLowerCase();
    const po = (b.poNumber || "").toLowerCase();
    const cat = (b.category || "").toLowerCase();
    return name.includes(q) || city.includes(q) || po.includes(q) || cat.includes(q);
  });

  return (
    <RNModal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View style={styles.sheetContainer}>
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.sheetTitle}>New Message</Text>
              <Text style={styles.sheetSubtitle}>Choose a buyer connected to your RFQs or purchase orders</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={Colors.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search buyers by name, city, or PO..."
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
              clearButtonMode="while-editing"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Buyer Contacts List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#5B13EC" />
              <Text style={styles.loadingText}>Loading buyers...</Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {filtered.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Ionicons name="search" size={32} color={Colors.textMuted} />
                  <Text style={styles.emptyTitle}>No buyers found</Text>
                  <Text style={styles.emptySubtitle}>Try a different name or search term</Text>
                </View>
              ) : (
                filtered.map((buyer) => {
                  const initial = (buyer.name || "B")[0].toUpperCase();
                  return (
                    <TouchableOpacity
                      key={buyer.id}
                      style={styles.buyerRow}
                      activeOpacity={0.7}
                      onPress={() => {
                        onSelectBuyer({
                          id: buyer.id,
                          name: buyer.name,
                          city: buyer.city,
                        });
                        onClose();
                      }}
                    >
                      <View style={styles.avatarCircle}>
                        <Text style={styles.avatarText}>{initial}</Text>
                      </View>

                      <View style={styles.buyerInfo}>
                        <View style={styles.nameRow}>
                          <Text style={styles.buyerName} numberOfLines={1}>
                            {buyer.name}
                          </Text>
                          <View style={styles.verifiedTag}>
                            <Ionicons name="shield-checkmark" size={11} color="#15803D" />
                            <Text style={styles.verifiedText}>Buyer</Text>
                          </View>
                        </View>

                        <Text style={styles.buyerMeta} numberOfLines={1}>
                          📍 {buyer.city || "Location not provided"}
                          {buyer.category ? ` • ${buyer.category}` : ""}
                        </Text>

                        {buyer.poNumber && (
                          <View style={styles.poPill}>
                            <Ionicons name="cube-outline" size={10} color="#5B13EC" />
                            <Text style={styles.poPillText}>{buyer.poNumber}</Text>
                          </View>
                        )}
                      </View>

                      <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
  },
  backdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    minHeight: 460,
    paddingTop: 12,
    paddingBottom: Platform.OS === "ios" ? 36 : 24,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginHorizontal: 20,
    marginBottom: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    padding: 0,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748B",
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 10,
  },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 50,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
  },
  emptySubtitle: {
    fontSize: 12,
    color: "#94A3B8",
  },
  buyerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#5B13EC",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  buyerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  buyerName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A",
    flexShrink: 1,
  },
  verifiedTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 2,
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#15803D",
  },
  buyerMeta: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
  },
  poPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EDE9FE",
    alignSelf: "flex-start",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    gap: 3,
  },
  poPillText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#5B13EC",
  },
});
