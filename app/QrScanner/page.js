"use client";
import { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";

export default function QrScannerPage() {
  const [scannedData, setScannedData] = useState(null);

  useEffect(() => {
    const scanner = new Html5QrcodeScanner(
      "reader",
      { fps: 5, qrbox: { width: 250, height: 250 } },
      false
    );

    async function onScanSuccess(decodedText, decodedResult) {
      console.log(`Scan result: ${decodedText}`, decodedResult);
      const res=await fetch('/api/submit', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          attendance1: "Present",
          rollNo: JSON.parse(decodedText).rollNo,
        }),
      });
      console.log(res);
      if (res.ok) {
        setScannedData("Attendance marked successfully!");
        
      } else {
        setScannedData("Failed to mark attendance.");
      }
      scanner.clear(); // stop scanning after success
    }

    function onScanError(errorMessage) {
      console.warn("QR Code not detected:", errorMessage);
    }

    scanner.render(onScanSuccess, onScanError);


    return () => {
      scanner.clear().catch((err) => console.error("Failed to clear scanner:", err));
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-pink-500 to-red-600 p-4">
      <div className="bg-white rounded-2xl shadow-lg p-6 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold mb-4 text-gray-800">QR Scanner</h1>
        
        
        <div id="reader" className="w-full flex justify-center"></div>

        {scannedData ? (
          <div className="mt-6 p-4 border rounded bg-gray-50">
            <h2 className="text-lg font-semibold">Scanned Data:</h2>
            <p className="mt-2 break-words text-gray-700">{scannedData}</p>
          </div>
        ) : (
          <p className="mt-4 text-gray-500">Scan a QR code to see result</p>
        )}
      </div>
    </div>
  );
}