import { pipeline } from "@huggingface/transformers";

let transcriber = null;

async function getTranscriber() {
    if (!transcriber) {
        console.log("⏳ Loading Whisper model...");

        transcriber = await pipeline(
            "automatic-speech-recognition",
            "onnx-community/whisper-tiny.en",
            {
                device: "webgpu",
                dtype: "fp32",
            }
        );

        console.log("✅ Whisper model loaded");
    }

    return transcriber;
}

export async function transcribe(audioBlob) {
    const model = await getTranscriber();

    // Convert Blob → Object URL
    const audioUrl = URL.createObjectURL(audioBlob);

    try {
        const result = await model(audioUrl);

        return result.text;
    } finally {
        URL.revokeObjectURL(audioUrl);
    }
}