import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { loadModel, type TFLiteModel } from "@/src/ml/modelLoader";

function logModelEvent(event: string, details?: Record<string, unknown>) {
  console.log(
    "[model]",
    JSON.stringify({
      timestamp: new Date().toISOString(),
      event,
      details,
    }),
  );
}

type ModelState = "loading" | "loaded" | "error";

type ModelContextValue = {
  model: TFLiteModel | null;
  state: ModelState;
  error: Error | null;
  getModel: () => Promise<TFLiteModel>;
};

const ModelContext = createContext<ModelContextValue | null>(null);

export function ModelProvider({ children }: { children: React.ReactNode }) {
  const [model, setModel] = useState<TFLiteModel | null>(null);
  const [state, setState] = useState<ModelState>("loading");
  const [error, setError] = useState<Error | null>(null);
  const modelPromiseRef = useRef<Promise<TFLiteModel> | null>(null);

  const getModel = useCallback(async () => {
    if (model) {
      logModelEvent("cached_model_reused");
      return model;
    }

    if (!modelPromiseRef.current) {
      setState("loading");
      setError(null);
      logModelEvent("model_load_started");
      modelPromiseRef.current = loadModel();
    }

    try {
      const nextModel = await modelPromiseRef.current;
      setModel(nextModel);
      setState("loaded");
      logModelEvent("model_load_completed");
      return nextModel;
    } catch (nextError) {
      const errorValue =
        nextError instanceof Error
          ? nextError
          : new Error("Could not load TFLite model.");
      setError(errorValue);
      setModel(null);
      setState("error");
      modelPromiseRef.current = null;
      logModelEvent("model_load_failed", { message: errorValue.message });
      throw errorValue;
    }
  }, [model]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        logModelEvent("model_preload_started");
        const nextModel = await getModel();

        if (cancelled) {
          return;
        }

        setModel(nextModel);
        setState("loaded");
        logModelEvent("model_preload_completed");
      } catch {
        // getModel owns the error state.
        logModelEvent("model_preload_failed");
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [getModel]);

  const value = useMemo(
    () => ({
      model,
      state,
      error,
      getModel,
    }),
    [error, getModel, model, state],
  );

  return (
    <ModelContext.Provider value={value}>{children}</ModelContext.Provider>
  );
}

export function useModel() {
  const context = useContext(ModelContext);

  if (!context) {
    throw new Error("useModel must be used inside ModelProvider.");
  }

  return context;
}
