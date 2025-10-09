"use client";
import { useState } from "react";
import dynamic from "next/dynamic";

// ✅ Correct dynamic import
const QrScanner = dynamic(
  async () => {
    const mod = await import("react-qr-barcode-scanner");
    return mod.default;
  },
  { ssr: false }
);

export default function AttendanceScanner() {
  const [result, setResult] = useState(null);
  const [status, setStatus] = useState("Scan a QR to begin...");
  const [loading, setLoading] = useState(false);

  const handleScan = async (data) => {
    if (!data || loading) return;
    const qr = data.text || data;

    try {
      setLoading(true);
      setStatus("Processing...");
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qr }),
      });

      const json = await res.json();
      setResult(json);

      if (json.success && json.alreadyMarked)
        setStatus("✅ Already marked attendance");
      else if (json.success)
        setStatus(`✅ Marked attendance for ${json.updated?.user_name}`);
      else setStatus(`❌ ${json.error || "Unknown error"}`);
    } catch (err) {
      console.error(err);
      setStatus("❌ Failed to process QR");
    } finally {
      setLoading(false);
    }
  };

  const handleError = (err) => {
    console.error(err);
    setStatus("⚠️ Camera error or permission denied");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <h1 className="text-2xl font-bold mb-4">📷 Attendance QR Scanner</h1>

      <div className="w-full max-w-sm aspect-square bg-white border border-gray-300 rounded-xl shadow-md overflow-hidden flex items-center justify-center">
        <QrScanner
          onUpdate={(err, result) => {
            if (err) handleError(err);
            if (result) handleScan(result);
          }}
          style={{ width: "100%", height: "100%" }}
        />
      </div>

      <p className="mt-4 text-gray-700 text-center">{status}</p>

      {result && (
        <div className="mt-4 p-3 bg-white rounded-xl shadow w-full max-w-sm text-sm text-gray-800">
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
