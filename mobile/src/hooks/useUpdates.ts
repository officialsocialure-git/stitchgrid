import { useEffect, useState, useCallback } from "react";
import * as Updates from "expo-updates";
import { Alert, Platform } from "react-native";

export interface UpdateState {
  isChecking: boolean;
  isDownloading: boolean;
  isUpdateAvailable: boolean;
  isUpdatePending: boolean;
  checkError: string | null;
  applyUpdate: () => Promise<void>;
  checkForUpdate: () => Promise<void>;
}

/**
 * Hook to manage instant Over-The-Air (OTA) updates using expo-updates.
 * In development mode (__DEV__), it no-ops cleanly.
 * In preview/production builds, it listens for background updates and allows manual/prompted reload.
 */
export function useUpdates(): UpdateState {
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  const [isUpdatePending, setIsUpdatePending] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  const applyUpdate = useCallback(async () => {
    try {
      await Updates.reloadAsync();
    } catch (error) {
      console.warn("Failed to reload app for update:", error);
    }
  }, []);

  const checkForUpdate = useCallback(async () => {
    if (__DEV__ || Platform.OS === "web") {
      return;
    }

    try {
      setIsChecking(true);
      setCheckError(null);

      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        setIsUpdateAvailable(true);
        setIsDownloading(true);

        const fetchResult = await Updates.fetchUpdateAsync();
        setIsDownloading(false);

        if (fetchResult.isNew) {
          setIsUpdatePending(true);
          Alert.alert(
            "Update Available",
            "A new version of STITCHGRID has been downloaded. Restart now to apply?",
            [
              { text: "Later", style: "cancel" },
              { text: "Restart Now", onPress: applyUpdate },
            ]
          );
        }
      } else {
        setIsUpdateAvailable(false);
      }
    } catch (error: any) {
      setCheckError(error?.message || "Failed to check for updates");
    } finally {
      setIsChecking(false);
      setIsDownloading(false);
    }
  }, [applyUpdate]);

  useEffect(() => {
    // Check for updates automatically when the hook mounts in preview/production
    checkForUpdate();
  }, [checkForUpdate]);

  return {
    isChecking,
    isDownloading,
    isUpdateAvailable,
    isUpdatePending,
    checkError,
    applyUpdate,
    checkForUpdate,
  };
}

