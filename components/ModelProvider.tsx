import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { loadStubModel, type TFLiteModel } from "@/src/ml/modelLoader";

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
      return model;
    }

    if (!modelPromiseRef.current) {
      setState("loading");
      setError(null);
      modelPromiseRef.current = loadStubModel();
    }

    try {
      const nextModel = await modelPromiseRef.current;
      setModel(nextModel);
      setState("loaded");
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
      throw errorValue;
    }
  }, [model]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const nextModel = await getModel();

        if (cancelled) {
          return;
        }

        setModel(nextModel);
        setState("loaded");
      } catch {
        // getModel owns the error state.
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
