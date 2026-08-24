const APPS_SCRIPT_URL = process.env.NEW_ALLOCATIONS_APPS_SCRIPT_URL || "https://script.google.com/macros/s/AKfycbxYeEy_ClJ2EhtAJ_oI4i0tOYOsbSZcMfJRk-oHKiT5ysOlSxWguosPhAH5EynIaIw/exec";

export async function POST(request) {
  try {
    const body = await request.json();
    const response = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store"
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { return Response.json({ ok: false, error: "Apps Script returned an invalid response" }, { status: 502 }); }
    return Response.json(data, { status: response.ok ? 200 : 502 });
  } catch (error) {
    return Response.json({ ok: false, error: error?.message || "Could not connect to Apps Script" }, { status: 502 });
  }
}
