import Replicate from "replicate";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

/* ==============================
   🔐 HARD ENV VALIDATION
================================ */
function requireEnv(name) {
  if (!process.env[name]) {
    throw new Error(`ENV MISSING: ${name}`);
  }
  return process.env[name];
}

const SUPABASE_URL = requireEnv("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const REPLICATE_API_KEY = requireEnv("REPLICATE_API_KEY");

/* ==============================
   CLIENTS
================================ */
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const replicate = new Replicate({
  auth: REPLICATE_API_KEY,
});

/* ==============================
   CORS
================================ */
function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

/* ==============================
   HANDLER
================================ */
export default async function handler(req, res) {
  setCors(res);

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const startedAt = Date.now();

  try {
    /* ==============================
       VALIDATE PAYLOAD
    ================================ */
    const { combo_id, prompt, items, images, generated_url, user_id,   aspect_ratio = "9:16" } = req.body || {};

    if (!combo_id || !prompt || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "Invalid payload" });
    }

    const ALLOWED_RATIOS = ["1:1", "4:5", "9:16"];

    const safeAspectRatio = ALLOWED_RATIOS.includes(aspect_ratio)
      ? aspect_ratio
      : "9:16";

    console.log("▶️ GENERATE COMBO:", combo_id);

    /* ==============================
       1️⃣ INSERT COMBO (PROCESSING)
    ================================ */
    const { error: insertError } = await supabase
      .from("combos")
      .insert({
        id: combo_id,
        items: items,
        prompt: prompt,
        generated_url,
        created_by: user_id ?? null,
        status: "processing",
        model: "nano-banana",
      });

    if (insertError) {
      console.error("❌ INSERT ERROR:", insertError);
      throw new Error("Failed to insert combo");
    }

    /* ==============================
       2️⃣ CREATE REPLICATE PREDICTION
    ================================ */
    let prediction = await replicate.predictions.create({
      version: "google/nano-banana",
      input: {
        image_input: images,
        prompt,
        aspect_ratio: safeAspectRatio,
        output_format: "jpg",
      },
    });

    /* ==============================
       3️⃣ POLLING (MAX 2 MINUTES)
    ================================ */
    const timeout = 120000;

    while (
      prediction.status !== "succeeded" &&
      prediction.status !== "failed"
    ) {
      if (Date.now() - startedAt > timeout) {
        throw new Error("Prediction timeout");
      }

      await new Promise((r) => setTimeout(r, 2000));
      prediction = await replicate.predictions.get(prediction.id);
    }

    if (prediction.status === "failed") {
      console.error("❌ REPLICATE FAILED:", prediction.error);
      throw new Error("Replicate generation failed");
    }

    /* ==============================
       4️⃣ NORMALIZE OUTPUT
    ================================ */
    const outputUrl =
      typeof prediction.output === "string"
        ? prediction.output
        : prediction.output?.[0];

    if (!outputUrl) {
      throw new Error("Replicate returned no output");
    }

    /* ==============================
       5️⃣ DOWNLOAD IMAGE
    ================================ */
    const imageRes = await fetch(outputUrl);
    if (!imageRes.ok) throw new Error("Failed to download image");

    const buffer = Buffer.from(await imageRes.arrayBuffer());

    /* ==============================
       6️⃣ UPLOAD TO SUPABASE STORAGE
    ================================ */
    const fileName = `combos/${crypto.randomUUID()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("combo-images")
      .upload(fileName, buffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("❌ UPLOAD ERROR:", uploadError);
      throw new Error("Failed to upload image");
    }

    const { data: publicUrlData } = supabase.storage
      .from("combo-images")
      .getPublicUrl(fileName);

    if (!publicUrlData?.publicUrl) {
      throw new Error("Failed to get public URL");
    }

    /* ==============================
       7️⃣ UPDATE COMBO (DONE)
    ================================ */
    const { error: updateError } = await supabase
      .from("combos")
      .update({
        status: "done",
        image_url: publicUrlData.publicUrl,
      })
      .eq("id", combo_id);

    if (updateError) {
      console.error("❌ UPDATE ERROR:", updateError);
      throw new Error("Failed to update combo");
    }

    /* ==============================
       ✅ SUCCESS
    ================================ */
    return res.status(200).json({
      success: true,
      image_url: publicUrlData.publicUrl,
    });
  } catch (err) {
    console.error("🔥 GENERATE COMBO ERROR:", err);

    if (req.body?.combo_id) {
      await supabase
        .from("combos")
        .update({ status: "failed" })
        .eq("id", req.body.combo_id);
    }

    return res.status(500).json({
      error: err.message || "Internal Server Error",
    });
  }
}
