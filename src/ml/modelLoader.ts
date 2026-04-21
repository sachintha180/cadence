import { loadTensorflowModel } from "react-native-fast-tflite";

export async function loadStubModel() {
  const model = await loadTensorflowModel(
    require("../../assets/models/stub_wav2vec2.tflite"),
    [],
  );

  console.log(
    "[Cadence] TFLite inputs:",
    model.inputs.map((tensor) => ({
      name: tensor.name,
      dataType: tensor.dataType,
      shape: tensor.shape,
    })),
  );
  console.log(
    "[Cadence] TFLite outputs:",
    model.outputs.map((tensor) => ({
      name: tensor.name,
      dataType: tensor.dataType,
      shape: tensor.shape,
    })),
  );

  return model;
}

export type TFLiteModel = Awaited<ReturnType<typeof loadStubModel>>;
