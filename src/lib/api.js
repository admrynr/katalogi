const DEFAULT_TIMEOUT = 30000; // 30 detik

export async function apiFetch(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    options.timeout || DEFAULT_TIMEOUT
  );

  try {
    const res = await fetch(path, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });

    const text = await res.text();

    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      console.error("❌ API returned non-JSON:", text);
      throw new Error("Invalid JSON response from API");
    }

    if (!res.ok) {
      throw new Error(data?.error || `API Error (${res.status})`);
    }

    return data;
  } catch (err) {
    if (err.name === "AbortError") {
      throw new Error("Request timeout");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}
