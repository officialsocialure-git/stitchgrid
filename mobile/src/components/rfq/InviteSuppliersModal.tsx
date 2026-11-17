import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal as RNModal,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../constants/colors";
import { marketplaceService } from "../../services/marketplace.service";

interface InviteSuppliersModalProps {
  visible: boolean;
  onClose: () => void;
  rfqId: string;
  rfqTitle: string;
}

export const InviteSuppliersModal: React.FC<InviteSuppliersModalProps> = ({
  visible,
  onClose,
  rfqId,
  rfqTitle,
}) => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [invitedIds, setInvitedIds] = useState<{ [key: string]: boolean }>({});
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!visible) return;
    let isMounted = true;

    async function fetchSuppliers() {
      try {
        setLoading(true);
        const data = await marketplaceService.searchSuppliers();
        if (isMounted) {
          setSuppliers(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        console.warn("Failed to fetch suppliers:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchSuppliers();
    return () => {
      isMounted = false;
    };
  }, [visible]);

  const handleInvite = async (supplierOrgId: string) => {
    try {
      setInvitingId(supplierOrgId);
      await marketplaceService.inviteSupplier(rfqId, supplierOrgId);
      setInvitedIds((prev) => ({ ...prev, [supplierOrgId]: true }));
    } catch (err) {
      console.warn("Failed to invite supplier:", err);
    } finally {
      setInvitingId(null);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const name = s.organization?.name?.toLowerCase() || s.name?.toLowerCase() || "";
    const city = s.organization?.city?.toLowerCase() || s.city?.toLowerCase() || "";
    const type = s.organization?.businessType?.toLowerCase() || s.businessType?.toLowerCase() || "";
    const query = search.toLowerCase().trim();
    return !query || name.includes(query) || city.includes(query) || type.includes(query);
  });

  return (
    <RNModal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.modalTitle}>Invite Verified Suppliers</Text>
              <Text style={styles.modalSubtitle} numberOfLines={1}>
                Tender: {rfqTitle}
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search Box */}
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={Colors.textMuted} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search verified mills by name, city..."
              placeholderTextColor={Colors.textMuted}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")} style={{ padding: 4 }}>
                <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {/* Suppliers List */}
          <ScrollView
            style={styles.supplierScroll}
            contentContainerStyle={styles.supplierListContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.centeredState}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.stateText}>Loading verified manufacturers...</Text>
              </View>
            ) : filteredSuppliers.length === 0 ? (
              <View style={styles.centeredState}>
                <Ionicons name="business-outline" size={32} color={Colors.textMuted} />
                <Text style={styles.stateText}>No suppliers found matching your query.</Text>
              </View>
            ) : (
              filteredSuppliers.map((s) => {
                const org = s.organization || s;
                const orgId = s.organizationId || s.id;
                const isInvited = Boolean(invitedIds[orgId]);
                const isBusy = invitingId === orgId;

                const nameInitial = (org.name || "S").slice(0, 1).toUpperCase();

                return (
                  <View key={orgId} style={styles.supplierCard}>
                    <View style={styles.supplierAvatar}>
                      <Text style={styles.avatarText}>{nameInitial}</Text>
                    </View>

                    <View style={styles.supplierInfo}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <Text style={styles.supplierName} numberOfLines={1}>
                          {org.name || "Garment Manufacturer"}
                        </Text>
                        <Ionicons name="checkmark-circle" size={14} color={Colors.primary} />
                      </View>
                      <Text style={styles.supplierMeta} numberOfLines={1}>
                        {org.city ? `${org.city}, India` : "India"} • {org.businessType || "Textile Mill"}
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={() => handleInvite(orgId)}
                      disabled={isInvited || isBusy}
                      style={[
                        styles.inviteBtn,
                        isInvited && styles.invitedBtn,
                      ]}
                    >
                      {isBusy ? (
                        <ActivityIndicator size="small" color={Colors.primary} />
                      ) : isInvited ? (
                        <>
                          <Ionicons name="checkmark" size={14} color={Colors.successText} />
                          <Text style={styles.invitedBtnText}>Invited</Text>
                        </>
                      ) : (
                        <>
                          <Ionicons name="person-add-outline" size={14} color={Colors.primary} />
                          <Text style={styles.inviteBtnText}>Invite</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity onPress={onClose} style={styles.doneBtn}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  modalSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: Colors.surfaceSubtle,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    padding: 0,
  },
  supplierScroll: {
    maxHeight: 380,
  },
  supplierListContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  centeredState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 36,
    gap: 10,
  },
  stateText: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: "center",
  },
  supplierCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  supplierAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "800",
    color: Colors.primary,
  },
  supplierInfo: {
    flex: 1,
  },
  supplierName: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textHeading,
  },
  supplierMeta: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  inviteBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: Colors.borderPrimary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  inviteBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.primary,
  },
  invitedBtn: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.successBorder,
  },
  invitedBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.successText,
  },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingBottom: Platform.OS === "ios" ? 34 : 16,
  },
  doneBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  doneBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFF",
  },
});

