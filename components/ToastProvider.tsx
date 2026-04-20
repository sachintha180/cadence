import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import colors from "@/constants/colors";

type ToastKind = "info" | "success" | "error";

type ToastInput = {
  message: string;
  kind?: ToastKind;
  actionLabel?: string;
  onAction?: () => void;
};

type ToastItem = ToastInput & {
  id: number;
  kind: ToastKind;
};

type ToastContextValue = {
  showToast: (toast: ToastInput) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const [activeToast, setActiveToast] = useState<ToastItem | null>(null);

  const showToast = useCallback((toast: ToastInput) => {
    setQueue((current) => [
      ...current,
      {
        id: Date.now() + Math.random(),
        kind: toast.kind ?? "info",
        ...toast,
      },
    ]);
  }, []);

  useEffect(() => {
    if (!activeToast && queue.length > 0) {
      setActiveToast(queue[0]);
      setQueue((current) => current.slice(1));
    }
  }, [activeToast, queue]);

  useEffect(() => {
    if (!activeToast) {
      return;
    }

    const timeout = setTimeout(() => setActiveToast(null), 3000);
    return () => clearTimeout(timeout);
  }, [activeToast]);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {activeToast && (
        <View style={[styles.toast, { top: insets.top + 10 }]}>
          <Text style={[styles.message, styles[activeToast.kind]]}>
            {activeToast.message}
          </Text>
          {activeToast.actionLabel && activeToast.onAction && (
            <Pressable
              onPress={() => {
                activeToast.onAction?.();
                setActiveToast(null);
              }}
            >
              <Text style={styles.action}>{activeToast.actionLabel}</Text>
            </Pressable>
          )}
        </View>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used inside ToastProvider.");
  }

  return context;
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 99,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    backgroundColor: colors.bgSurface,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  message: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.white,
  },
  info: {
    color: colors.white,
  },
  success: {
    color: colors.statusGood,
  },
  error: {
    color: colors.danger,
  },
  action: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.accent,
    marginTop: 8,
  },
});
