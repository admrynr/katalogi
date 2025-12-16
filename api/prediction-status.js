import Replicate from "replicate";

export default async function handler(req, res) {
  // ---------------- CORS ----------------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // ---------------- LOGIC ----------------
  try {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: "Missing prediction id" });
    }

    if (!process.env.REPLICATE_API_KEY) {
      return res.status(500).json({ error: "REPLICATE_API_KEY missing" });
    }

    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_KEY,
    });

    const prediction = await replicate.predictions.get(id);

    /**
     * ⚠️ PENTING:
     * - output TIDAK dijamin ada walaupun succeeded
     * - nano-banana output = STRING (URL), bukan array
     * - kita TIDAK pakai output ini sebagai final result
     */

    return res.status(200).json({
      id: prediction.id,
      status: prediction.status, // starting | processing | succeeded | failed
      has_output: !!prediction.output,
      error: prediction.error ?? null,
    });
  } catch (err) {
    console.error("🔥 prediction-status error:", err);

    return res.status(500).json({
      error: err.message || "Internal server error",
    });
  }
}
