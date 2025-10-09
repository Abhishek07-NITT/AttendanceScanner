"use client";
import { useEffect, useState, useRef } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function QrScannerPage() {
  const [scannedData, setScannedData] = useState(null);
  const [attendanceIndex, setAttendanceIndex] = useState(1); // dropdown value: 1 = attendance1
  const submittingRef = useRef(false);
  const lastScannedRef = useRef(null);
  const lastScanTimeRef = useRef(0);
  const clearTimerRef = useRef(null);
  const fileInputRef = useRef(null);

  // helper to show result and auto-clear after 5s
  function showResult(msg) {
    // clear any existing timer
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }

    setScannedData(msg);

    // auto-clear after 5s
    clearTimerRef.current = setTimeout(() => {
      setScannedData(null);
      clearTimerRef.current = null;
    }, 5000);
  }

  // clear confirmation immediately (used when user clicks choose media)
  function clearResultImmediately() {
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }
    setScannedData(null);
  }

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 5, qrbox: { width: 250, height: 250 } },
      false
    );

    async function onScanSuccess(decodedText, decodedResult) {
      // ignore if already submitting
      if (submittingRef.current) return;

      // ignore quick duplicates (3s cooldown)
      const now = Date.now();
      if (
        lastScannedRef.current === decodedText &&
        now - lastScanTimeRef.current < 3000
      ) {
        return;
      }

      submittingRef.current = true;
      try {
        // send raw CSV string + attendanceIndex to server; server validates SECRET_STRING
        const res = await fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qr: decodedText, attendanceIndex }),
        });

        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            const msg = json.alreadyMarked
              ? `✅ Already marked (col ${json.usedColumn}) for ${json.updated?.user_name || ""}`
              : `✅ Attendance marked (col ${json.usedColumn}) for ${json.updated?.user_name || ""}`;

            showResult(msg);
          } else {
            showResult(`❌ Failed: ${json.error || "server error"}`);
          }
        } else {
          const txt = await res.text();
          showResult(`Server error: ${res.status} ${txt}`);
        }
      } catch (err) {
        console.error(err);
        showResult("❌ Network error while submitting attendance.");
      } finally {
        // record last scan and set short cooldown, but keep scanner active
        lastScannedRef.current = decodedText;
        lastScanTimeRef.current = Date.now();
        // small delay before allowing next submit (prevents double-posts)
        setTimeout(() => {
          submittingRef.current = false;
        }, 2000);
      }
    }

    function onScanError(errorMessage) {
      // non-fatal: QR not detected on some frames
    }

    scanner.render(onScanSuccess, onScanError);

    return () => {
      scanner.clear().catch((err) =>
        console.error("Failed to clear scanner on unmount:", err)
      );
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
    };
  }, [attendanceIndex]); // keep attendanceIndex in dependency so latest value is used

  // When user clicks "Choose media", clear confirmation immediately then open file picker
  const onChooseMediaClick = () => {
    clearResultImmediately();
    fileInputRef.current?.click();
  };

  // simple file handler placeholder (you can decode image here if desired)
  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Optionally decode the selected image here (using Html5Qrcode.scanFileV2 or another decoder)
    // For now we just clear the input after selection so reuse works
    e.target.value = "";
  };

  return (
    <>
      <nav className="w-full flex items-center justify-between px-6 py-3 bg-black shadow" style={{ borderBottom: "1px solid #e5e7eb" }}>
        <div className="flex-1"></div>
        <h2 className="text-xl text-white font-bold text-gray-800 flex-1 text-center">Attendance Marker</h2>
        <div className="flex-1 flex justify-end">
          <img
            src="/transfinitte-logo.svg"
            alt="Transfinitte Logo"
            className="h-10 w-auto"
            style={{ objectFit: "contain" }}
          />
        </div>
      </nav>

      <div className="min-h-screen flex items-center justify-center bg-black p-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold mb-4 text-gray-800">QR Scanner</h1>

          <div className="mb-4 flex items-center justify-center gap-3">
            <label className="text-sm font-medium text-gray-700">Attendance:</label>
            <select
              value={attendanceIndex}
              onChange={(e) => setAttendanceIndex(Number(e.target.value))}
              className="px-3 py-1 border rounded"
            >
              {[...Array(8)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  Attendance {i + 1}
                </option>
              ))}
            </select>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={onFileChange}
            />
          </div>

          <div id="reader" className="w-full flex justify-center"></div>

          {scannedData ? (
            <div className="mt-6 p-4 border rounded bg-gray-50">
              <h2 className="text-lg font-semibold">Result</h2>
              <p className="mt-2 break-words text-gray-700">{scannedData}</p>
            </div>
          ) : (
            <p className="mt-4 text-gray-500">Scan a QR code to see result</p>
          )}
        </div>
      </div>
    </>
  );
}