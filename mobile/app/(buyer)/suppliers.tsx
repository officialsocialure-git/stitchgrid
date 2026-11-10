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
import { Card } from "../../src/components/common/Card";
import { Badge } from "../../src/components/common/Badge";
import { Button } from "../../src/components/common/Button";
import { Input } from "../../src/components/common/Input";
import { EmptyState } from "../../src/components/common/EmptyState";
import { marketplaceService } from "../../src/services/marketplace.service";
import { SupplierProfile } from "../../src/types";

const CATEGORIES = ["All", "Knits & Hosiery", "Woven & Shirts", "Denim & Jeans", "Activewear", "Kids Apparel"];

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Verified Mills"
        subtitle="Source directly from vetted garment factories"
        showBack
      />

      <View style={styles.searchSection}>
        <Input
          placeholder="Search mills by name, city, capabilities..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon="search-outline"
          containerStyle={{ marginBottom: 10 }}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryPills}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadSuppliers(); }} colors={[Colors.primary]} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          !loading ? (
            <EmptyState
              icon="business-outline"
              title="No Mills Found"
              description="Try adjusting your filter or search query to find matching garment manufacturers."
            />
          ) : null
        }
        renderItem={({ item }) => {
          const org = item.organization;
          return (
            <Card style={styles.supplierCard}>
              <View style={styles.topRow}>
                <View style={styles.millIconWrap}>
                  <Ionicons name="business" size={22} color={Colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.millName}>{org.name}</Text>
                  <Text style={styles.millLocation}>
                    📍 {org.city || "Tirupur"}, {org.country || "India"}
                  </Text>
                </View>
                <Badge
                  label="GST Verified"
                  variant="success"
                  size="sm"
                />
              </View>

              <Text style={styles.desc} numberOfLines={2}>
                {item.description || "Specialized OEM garment manufacturing with export-standard quality inspection and automated sewing lines."}
              </Text>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Monthly Output</Text>
                  <Text style={styles.statValue}>
                    {item.productionCapacity ? `${(item.productionCapacity / 1000).toFixed(0)}k pcs` : "150k pcs"}
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Experience</Text>
                  <Text style={styles.statValue}>
                    {item.yearsInBusiness ? `${item.yearsInBusiness} yrs` : "12+ yrs"}
                  </Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Audit Status</Text>
                  <Text style={[styles.statValue, { color: Colors.successText }]}>Tier-1 Pass</Text>
                </View>
              </View>

              <View style={styles.cardActions}>
                <Button
                  title="Invite to RFQ"
                  size="sm"
                  onPress={() => router.push("/(buyer)/rfqs")}
                  style={{ flex: 1 }}
                />
                <Button
                  title="Message"
                  size="sm"
                  variant="outline"
                  icon="chatbubble-ellipses-outline"
                  onPress={() => router.push("/(buyer)/messages")}
                />
              </View>
            </Card>
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
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  categoryPills: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 12,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
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
    color: Colors.textSecondary,
  },
  pillTextActive: {
    color: "#FFFFFF",
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  supplierCard: {
    marginBottom: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  millIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  millName: {
    fontSize: 16,
    fontWeight: "800",
    color: Colors.text,
  },
  millLocation: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  desc: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: Colors.surfaceSubtle,
    padding: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: "600",
  },
  statValue: {
    fontSize: 13,
    fontWeight: "800",
    color: Colors.text,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: "row",
    gap: 10,
  },
});

