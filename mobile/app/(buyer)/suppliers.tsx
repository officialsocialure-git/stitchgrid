import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants/colors";
import { Header } from "../../src/components/common/Header";
import { Button } from "../../src/components/common/Button";
import { Input } from "../../src/components/common/Input";
import { EmptyState } from "../../src/components/common/EmptyState";
import { marketplaceService } from "../../src/services/marketplace.service";
import { SupplierProfile } from "../../src/types";

const CATEGORIES = [
  "All",
  "T-Shirts",
  "Shirts",
  "Hoodies",
  "Activewear",
  "Denim & Jeans",
  "Kids Wear",
  "Knitwear",
  "Woven Fabric",
];

export default function SuppliersDiscoveryScreen() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const loadSuppliers = useCallback(async () => {
    try {
      const data = await marketplaceService.searchSuppliers({
        category: selectedCategory === "All" ? undefined : selectedCategory,
        q: searchQuery.trim() || undefined,
      });
      setSuppliers(data || []);
    } catch (e) {
      console.warn("Failed to load suppliers:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCategory, searchQuery]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const getSupplierIcon = (businessType?: string) => {
    if (businessType?.toLowerCase().includes("fabric")) return "layers-outline";
    if (businessType?.toLowerCase().includes("trim")) return "pricetag-outline";
    return "business-outline";
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Verified Mills"
        subtitle="Source directly from vetted garment factories"
        showBack
      />

      <View style={styles.searchSection}>
        <View style={styles.searchInputWrap}>
          <Ionicons name="search" size={17} color={Colors.textMuted} style={{ marginRight: 8 }} />
          <Input
            placeholder="Search mills by name, city, capabilities..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            containerStyle={{ flex: 1, marginBottom: 0 }}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryPills}
        >
          {CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat}
              onPress={() => setSelectedCategory(cat)}
              style={[styles.pill, selectedCategory === cat && styles.pillActive]}
            >
              <Text style={[styles.pillText, selectedCategory === cat && styles.pillTextActive]}>
                {cat}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={suppliers}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadSuppliers();
            }}
            colors={[Colors.primary]}
          />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="search-outline"
              title="No Factories Found"
              description="No suppliers matching your selected filter. Tap All to view all verified manufacturing partners."
              actionTitle="Reset Filters"
              onAction={() => {
                setSelectedCategory("All");
                setSearchQuery("");
              }}
            />
          ) : undefined
        }
        renderItem={({ item }) => {
          const isApproved = item.organization?.verificationStatus === "APPROVED";
          const icon = getSupplierIcon(item.organization?.businessType);
          const capacityText = item.productionCapacity
            ? `${item.productionCapacity.toLocaleString()} pcs / mo`
            : "50,000 pcs / mo";

          return (
            <View style={styles.supplierCard}>
              <View style={styles.cardTopRow}>
                {isApproved ? (
                  <View style={styles.verifiedPill}>
                    <Ionicons name="checkmark" size={12} color={Colors.successText} />
                    <Text style={styles.verifiedText}>Verified</Text>
                  </View>
                ) : (
                  <View style={styles.pendingPill}>
                    <Ionicons name="information-circle-outline" size={12} color={Colors.warningText} />
                    <Text style={styles.pendingText}>Under review</Text>
                  </View>
                )}

                <View style={styles.businessTypePill}>
                  <Text style={styles.businessTypeText}>
                    {item.organization?.businessType || "Garments & Textiles"}
                  </Text>
                </View>
              </View>

              <View style={styles.infoRow}>
                <View style={styles.iconBox}>
                  <Ionicons name={icon as any} size={22} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.supplierName} numberOfLines={1}>
                    {item.organization?.name || "Apparel Mill"}
                  </Text>
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={14} color={Colors.textSecondary} />
                    <Text style={styles.locationText} numberOfLines={1}>
                      {item.organization?.city || "Tirupur, India"}
                    </Text>
                  </View>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>Monthly Capacity</Text>
                  <Text style={styles.statVal}>{capacityText}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statCol}>
                  <Text style={styles.statLabel}>Experience</Text>
                  <Text style={styles.statVal}>{item.yearsInBusiness || 10} Years</Text>
                </View>
              </View>

              <View style={styles.actionsRow}>
                <Button
                  title="Message Mill"
                  size="sm"
                  onPress={() =>
                    router.push(`/(buyer)/messages?targetSupplierOrgId=${item.organizationId}`)
                  }
                  style={{ flex: 1 }}
                />
              </View>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  categoryPills: {
    gap: 8,
    paddingBottom: 4,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: Colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: "600",
    color: Colors.slate600,
  },
  pillTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  supplierCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  verifiedPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.successLight,
    borderWidth: 1,
    borderColor: Colors.successBorder,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.successText,
  },
  pendingPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.warningLight,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  pendingText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.warningText,
  },
  businessTypePill: {
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 10,
  },
  businessTypeText: {
    fontSize: 11,
    fontWeight: "700",
    color: Colors.primary,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.primaryLight,
    borderWidth: 1,
    borderColor: "rgba(91, 19, 236, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  supplierName: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 2,
  },
  locationText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.surfaceSubtle,
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  statCol: {
    flex: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: Colors.borderLight,
    marginHorizontal: 8,
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    marginBottom: 2,
  },
  statVal: {
    fontSize: 12,
    fontWeight: "800",
    color: Colors.textHeading,
  },
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});
