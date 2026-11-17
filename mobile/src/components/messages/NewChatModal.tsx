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
import { SupplierProfile } from "../../types";

interface NewChatModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectSupplier: (supplier: { id: string; name: string; city?: string }) => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  visible,
  onClose,
  onSelectSupplier,
}) => {
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (visible) {
      loadSuppliers();
    }
  }, [visible]);

  const loadSuppliers = async () => {
    try {
      setLoading(true);
      const data = await marketplaceService.searchSuppliers();
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Failed to load suppliers:", err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = suppliers.filter((s) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    const name = (s.name || s.organization?.name || "").toLowerCase();
    const city = (s.city || s.organization?.city || "").toLowerCase();
    const type = (s.businessType || "").toLowerCase();
    return name.includes(q) || city.includes(q) || type.includes(q);
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
              <Text style={styles.sheetSubtitle}>Choose a verified garment mill to chat</Text>
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
              placeholder="Search manufacturers by name or city..."
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

          {/* Supplier List */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {loading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="small" color="#5B13EC" />
                <Text style={styles.loadingText}>Fetching verified mills...</Text>
              </View>
            ) : filtered.length === 0 ? (
              <View style={styles.centerContainer}>
                <Ionicons name="business-outline" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No Manufacturers Found</Text>
                <Text style={styles.emptySub}>Try searching for a different city or company name.</Text>
              </View>
            ) : (
              filtered.map((s) => {
                const name = s.name || s.organization?.name || "Verified Factory";
                const city = s.city || s.organization?.city || "India";
                const orgId = s.organizationId || s.id;
                const initial = name[0]?.toUpperCase() || "M";

                return (
                  <TouchableOpacity
                    key={s.id}
                    onPress={() => {
                      onSelectSupplier({ id: orgId, name, city });
                      onClose();
                    }}
                    style={styles.supplierRow}
                    activeOpacity={0.8}
                  >
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarInitial}>{initial}</Text>
                      <View style={styles.onlineBadge} />
                    </View>

                    <View style={styles.supplierInfo}>
                      <View style={styles.supplierTitleRow}>
                        <Text style={styles.supplierName} numberOfLines={1}>
                          {name}
                        </Text>
                        <View style={styles.verifiedTag}>
                          <Ionicons name="checkmark-circle" size={12} color="#15803D" />
                          <Text style={styles.verifiedText}>Verified</Text>
                        </View>
                      </View>

                      <View style={styles.supplierSubRow}>
                        <Ionicons name="location-outline" size={12} color={Colors.textSecondary} />
                        <Text style={styles.supplierCity}>{city}, India</Text>
                        <Text style={styles.supplierType}>
                          • {s.businessType || "Garment Manufacturer"}
                        </Text>
                      </View>
                    </View>

                    <Ionicons name="chatbubble-ellipses-outline" size={20} color="#5B13EC" />
                  </TouchableOpacity>
                );
              })
            )}
          </ScrollView>
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
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 24,
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  sheetSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surfaceSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 10,
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: Colors.textHeading,
    padding: 0,
  },
  scrollArea: {
    maxHeight: 460,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  centerContainer: {
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.textHeading,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
    textAlign: "center",
  },
  supplierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: "900",
    color: "#5B13EC",
  },
  onlineBadge: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  supplierInfo: {
    flex: 1,
  },
  supplierTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  supplierName: {
    fontSize: 14,
    fontWeight: "800",
    color: Colors.textHeading,
    flexShrink: 1,
  },
  verifiedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  verifiedText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#15803D",
  },
  supplierSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
  },
  supplierCity: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: "500",
  },
  supplierType: {
    fontSize: 11,
    color: Colors.textMuted,
  },
});
