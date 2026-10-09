"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { prepareZXingModule, readBarcodes } from "zxing-wasm/reader";

// High-fidelity sound feedback using Web Audio API
function playScanSound(isSuccess = true) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    if (isSuccess) {
      osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
      osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.06); // E6
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
    } else {
      osc.frequency.setValueAtTime(260, ctx.currentTime);
      osc.frequency.setValueAtTime(195, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  } catch {
    // Graceful fallback if autoplay restrictions apply
  }
}

export default function ZXingScanner() {
  const [attendanceIndex, setAttendanceIndex] = useState(1);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");
  const [isTorchAvailable, setIsTorchAvailable] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);

  // Scan states: null | 'processing' | 'success' | 'error'
  const [scanState, setScanState] = useState(null);
  const [resultData, setResultData] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const scanLoopRef = useRef(null);
  const isScanningRef = useRef(true);
  const isPausedRef = useRef(false);
  const fileInputRef = useRef(null);

  // Initialize ZXing WASM module
  useEffect(() => {
    prepareZXingModule({
      overrides: {
        locateFile: (path) => {
          if (path.endsWith(".wasm")) {
            return "/zxing_reader.wasm";
          }
          return path;
        },
      },
    });
  }, []);

  // Stop camera tracks cleanly
  const stopCameraStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setIsTorchAvailable(false);
    setIsTorchOn(false);
  }, []);

  // Robust mobile camera initialization
  const startCamera = useCallback(async () => {
    stopCameraStream();
    setCameraError(null);

    // Progressive fallback constraints for maximum mobile browser compatibility
    const constraintList = [
      {
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      },
      {
        video: {
          facingMode: facingMode,
        },
        audio: false,
      },
      {
        video: true,
        audio: false,
      },
    ];

    let stream = null;
    let lastErr = null;

    for (const constraints of constraintList) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (stream) break;
      } catch (err) {
        lastErr = err;
        // Continue to fallback constraint
      }
    }

    if (!stream) {
      console.error("Camera access failed with all constraints:", lastErr);
      setCameraError(
        lastErr?.name === "NotAllowedError" || lastErr?.name === "PermissionDeniedError"
          ? "Camera permission denied. Tap your browser address bar to allow camera access."
          : `Camera unavailable: ${lastErr?.message || "Please verify camera permissions."}`
      );
      return;
    }

    try {
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        videoRef.current.setAttribute("webkit-playsinline", "true");
        await videoRef.current.play();
      }

      // Check flashlight/torch support
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack?.getCapabilities) {
        try {
          const caps = videoTrack.getCapabilities();
          setIsTorchAvailable(Boolean(caps.torch));
        } catch {
          setIsTorchAvailable(false);
        }
      }

      setCameraActive(true);
    } catch (err) {
      console.error("Error playing video stream:", err);
      setCameraError("Failed to start video playback. Please tap Retry.");
    }
  }, [facingMode, stopCameraStream]);

  // Flashlight toggle
  const toggleTorch = async () => {
    if (!streamRef.current || !isTorchAvailable) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (!track) return;
    try {
      const nextState = !isTorchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setIsTorchOn(nextState);
    } catch (err) {
      console.error("Torch constraint error:", err);
    }
  };

  // Flip camera front/back
  const flipCamera = () => {
    setFacingMode((prev) => (prev === "environment" ? "user" : "environment"));
  };

  // Resume scanning after modal
  const resumeScanning = useCallback(() => {
    setScanState(null);
    setResultData(null);
    isPausedRef.current = false;
    isScanningRef.current = true;
  }, []);

  // Process decoded QR payload
  const handleScannedPayload = useCallback(
    async (decodedText) => {
      // 1. Immediately pause scanning
      isPausedRef.current = true;
      isScanningRef.current = false;

      // 2. Audio & Haptic feedback
      playScanSound(true);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([80]);
      }

      // 3. Parse user details from QR client-side
      const parts = decodedText.split(",").map((p) => p.trim());
      let parsedUserId = parts[0] || "";
      let parsedUserName = "";
      let parsedTeamId = "";
      if (parts.length >= 4) {
        parsedTeamId = parts[parts.length - 2];
        parsedUserName = parts.slice(1, parts.length - 2).join(",").trim();
      }

      setScanState("processing");
      setResultData({
        user_name: parsedUserName || "Participant",
        team_id: parsedTeamId,
        user_id: parsedUserId,
      });

      try {
        const res = await fetch("/api/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ qr: decodedText, attendanceIndex }),
        });

        let json = null;
        try {
          json = await res.json();
        } catch {
          json = { error: `Server error (${res.status})` };
        }

        if (res.ok && json.success) {
          const finalUserName =
            json.updated?.user_name || json.user_name || parsedUserName || "Participant";
          const finalTeamId =
            json.updated?.team_id || json.team_id || parsedTeamId || "";

          setScanState("success");
          setResultData({
            user_name: finalUserName,
            team_id: finalTeamId,
            alreadyMarked: Boolean(json.alreadyMarked),
            usedColumn: json.usedColumn,
            attendanceIndex,
          });
        } else {
          playScanSound(false);
          setScanState("error");
          setResultData({
            error: json?.error || `Server error (${res.status})`,
          });
        }
      } catch (err) {
        console.error("Submission error:", err);
        playScanSound(false);
        setScanState("error");
        setResultData({
          error:
            err.message?.includes("Failed to fetch") || err.name === "TypeError"
              ? "Cannot connect to server. Ensure Next.js dev server is running."
              : err.message || "Network error while submitting attendance.",
        });
      }
    },
    [attendanceIndex]
  );

  // File gallery handler
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setScanState("processing");
      const results = await readBarcodes(file, {
        formats: ["QRCode"],
        tryHarder: true,
      });

      if (results && results.length > 0) {
        handleScannedPayload(results[0].text);
      } else {
        playScanSound(false);
        setScanState("error");
        setResultData({ error: "No QR code found in selected photo." });
      }
    } catch (err) {
      console.error("File decode error:", err);
      setScanState("error");
      setResultData({ error: "Failed to read QR image." });
    } finally {
      e.target.value = "";
    }
  };

  // Mount camera
  useEffect(() => {
    startCamera();
    return () => {
      stopCameraStream();
    };
  }, [startCamera, stopCameraStream]);

  // ZXing frame processing loop
  useEffect(() => {
    let isMounted = true;
    let isDecoding = false;

    const interval = setInterval(async () => {
      if (!isMounted) return;
      if (isPausedRef.current || !isScanningRef.current || isDecoding) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        return;
      }

      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return;

      isDecoding = true;

      try {
        canvas.width = vw;
        canvas.height = vh;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(video, 0, 0, vw, vh);

        const imageData = ctx.getImageData(0, 0, vw, vh);
        const barcodes = await readBarcodes(imageData, {
          formats: ["QRCode"],
          tryHarder: false,
        });

        if (barcodes && barcodes.length > 0 && isMounted && !isPausedRef.current) {
          const qrText = barcodes[0].text;
          if (qrText) {
            handleScannedPayload(qrText);
          }
        }
      } catch {
        // Continue scanning silently
      } finally {
        isDecoding = false;
      }
    }, 40); // 25 FPS scan cadence (smooth on mobile CPUs)

    scanLoopRef.current = interval;

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [handleScannedPayload]);

  return (
    <div className="relative w-full h-[100dvh] flex flex-col bg-[#050505] text-[#ededed] overflow-hidden select-none font-sans">
      {/* Offscreen frame canvas for ZXing reader */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Hidden gallery file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* TOP HEADER: Clean Transfinitte Minimal Branding */}
      <header className="z-20 w-full flex items-center justify-between px-5 py-3.5 bg-[#050505]/90 backdrop-blur-md border-b border-[#1b1b1b]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-extrabold tracking-widest text-sm text-white">
              TRANSFINITTE
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[#2e2e2e] bg-[#111111] text-[#999999]">
              26
            </span>
          </div>
          <span className="text-xs text-[#444444] font-mono hidden sm:inline">|</span>
          <span className="text-xs text-[#888888] font-medium hidden sm:inline">
            Attendance Scanner
          </span>
        </div>

        {/* Status Pill matching the badge in the screenshot */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#111111] border border-[#222222]">
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              scanState === "success"
                ? "bg-white animate-ping"
                : isPausedRef.current
                ? "bg-neutral-500"
                : cameraActive
                ? "bg-white animate-pulse"
                : "bg-red-500"
            }`}
          />
          <span className="text-[11px] font-mono tracking-tight text-[#aaaaaa]">
            {scanState === "success"
              ? "MARKED"
              : isPausedRef.current
              ? "PAUSED"
              : cameraActive
              ? "ACTIVE"
              : "OFFLINE"}
          </span>
        </div>
      </header>

      {/* CHECKPOINT SELECTION BAR */}
      <div className="z-20 w-full px-5 py-2.5 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-[#171717] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-mono text-[#888888] tracking-wider uppercase">
          <span className="text-white text-xs">●</span>
          <span>CHECKPOINT</span>
        </div>

        <div className="relative flex-1 max-w-[210px]">
          <select
            value={attendanceIndex}
            onChange={(e) => {
              setAttendanceIndex(Number(e.target.value));
              resumeScanning();
            }}
            className="w-full appearance-none bg-[#111111] hover:bg-[#161616] text-white font-medium text-xs px-3.5 py-2 pr-8 rounded-lg border border-[#262626] focus:outline-none focus:border-white transition-all cursor-pointer font-mono"
          >
            {[...Array(10)].map((_, i) => (
              <option key={i + 1} value={i + 1} className="bg-[#111] text-white">
                Attendance {i + 1}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2.5 text-[#666666]">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* MAIN CAMERA VIEWPORT */}
      <main className="relative flex-1 w-full bg-[#050505] overflow-hidden flex items-center justify-center">
        {/* Camera Video Stream */}
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
          autoPlay
        />

        {/* Subtle Tech Grid overlay for Transfinitte aesthetic */}
        <div className="absolute inset-0 tf-grid opacity-25 pointer-events-none" />

        {/* Dark Vignette Overlay with cutout focus */}
        <div className="absolute inset-0 bg-black/45 pointer-events-none" />

        {/* MINIMAL TRANSFINITTE CORNER RETICLE */}
        <div className="relative w-64 h-64 sm:w-72 sm:h-72 flex items-center justify-center">
          {/* Subtle Outer Frame */}
          <div className="absolute inset-0 rounded-2xl border border-white/[0.08] pointer-events-none" />

          {/* 4 Sharp Minimal White Corner Brackets matching transfinitte.org */}
          <div className="absolute -top-1 -left-1 w-7 h-7 border-t-2 border-l-2 border-white rounded-tl-sm" />
          <div className="absolute -top-1 -right-1 w-7 h-7 border-t-2 border-r-2 border-white rounded-tr-sm" />
          <div className="absolute -bottom-1 -left-1 w-7 h-7 border-b-2 border-l-2 border-white rounded-bl-sm" />
          <div className="absolute -bottom-1 -right-1 w-7 h-7 border-b-2 border-r-2 border-white rounded-br-sm" />

          {/* Minimalist White Scanning Laser */}
          {!isPausedRef.current && cameraActive && (
            <div className="absolute inset-x-2 h-[1.5px] bg-gradient-to-r from-transparent via-white to-transparent shadow-[0_0_12px_rgba(255,255,255,0.8)] animate-scanline pointer-events-none" />
          )}

          {/* Central Subtle Crosshair */}
          <div className="pointer-events-none flex flex-col items-center justify-center opacity-25">
            <div className="w-3.5 h-3.5 border border-white rounded-full flex items-center justify-center">
              <div className="w-1 h-1 bg-white rounded-full" />
            </div>
          </div>

          {/* Instruction label */}
          <div className="absolute -bottom-9 inset-x-0 text-center pointer-events-none">
            <p className="text-[11px] font-mono uppercase tracking-wider text-[#aaaaaa]">
              {isPausedRef.current
                ? "Processing Badge..."
                : "Align QR inside corners"}
            </p>
          </div>
        </div>

        {/* CAMERA ERROR STATE */}
        {cameraError && (
          <div className="absolute inset-0 z-30 bg-[#050505]/95 flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-xl bg-[#1a1111] border border-[#3d1e1e] flex items-center justify-center text-red-400 mb-4 font-mono">
              !
            </div>
            <h3 className="text-base font-bold text-white mb-1.5">Camera Error</h3>
            <p className="text-xs text-[#888888] max-w-xs mb-6 font-mono leading-relaxed">
              {cameraError}
            </p>
            <div className="flex gap-3">
              <button
                onClick={startCamera}
                className="px-5 py-2.5 bg-white text-black text-xs font-semibold rounded-lg hover:bg-[#e0e0e0] active:scale-95 transition-all"
              >
                Retry Camera
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2.5 bg-[#141414] hover:bg-[#1a1a1a] text-[#cccccc] text-xs font-semibold rounded-lg border border-[#2a2a2a] transition-all"
              >
                Upload Photo
              </button>
            </div>
          </div>
        )}

        {/* POPUP MODAL (Stays visible until user clicks "Rescan") */}
        {scanState && (
          <div className="absolute inset-0 z-40 bg-[#050505]/90 backdrop-blur-md flex flex-col items-center justify-center p-6 animate-in fade-in duration-200">
            {/* 1. PROCESSING STATE */}
            {scanState === "processing" && (
              <div className="bg-[#0e0e0e] border border-[#222222] rounded-2xl p-7 w-full max-w-sm flex flex-col items-center text-center shadow-2xl">
                <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white animate-spin mb-4" />
                <h3 className="text-sm font-semibold tracking-wide text-white uppercase font-mono">
                  Verifying Badge
                </h3>
                <p className="text-xs text-[#777777] mt-1 font-mono">
                  Syncing with Google Sheets...
                </p>
              </div>
            )}

            {/* 2. SUCCESS STATE (Clean Minimalist Monochromatic Theme) */}
            {scanState === "success" && (
              <div className="bg-[#0d0d0d] border border-[#262626] rounded-2xl p-7 w-full max-w-sm flex flex-col items-center text-center shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
                {/* Status Tag */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#181818] border border-[#2f2f2f] text-white text-[11px] font-mono tracking-wider uppercase mb-5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>{resultData?.alreadyMarked ? "Already Recorded" : "Verified"}</span>
                </div>

                {/* Primary Message */}
                <h2 className="text-xl font-bold text-white tracking-tight">
                  Attendance {attendanceIndex} Marked
                </h2>

                <p className="text-xs uppercase font-mono tracking-widest text-[#777777] mt-3">
                  for
                </p>

                {/* Participant Name */}
                <p className="text-xl font-extrabold text-white mt-0.5 tracking-tight">
                  {resultData?.user_name || "Participant"}
                </p>

                {/* Team Name */}
                {resultData?.team_id && (
                  <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[#161616] border border-[#262626] text-xs font-mono text-[#bbbbbb]">
                    <span className="text-[#666666]">Team:</span>
                    <span className="text-white font-semibold">{resultData.team_id}</span>
                  </div>
                )}

                {/* Rescan Button (Popup closes only when clicked) */}
                <div className="w-full mt-6 pt-2">
                  <button
                    onClick={resumeScanning}
                    className="w-full py-3.5 bg-white hover:bg-[#e8e8e8] active:scale-98 text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Rescan
                  </button>
                </div>
              </div>
            )}

            {/* 3. ERROR STATE */}
            {scanState === "error" && (
              <div className="bg-[#0d0d0d] border border-[#331c1c] rounded-2xl p-7 w-full max-w-sm flex flex-col items-center text-center shadow-2xl">
                <div className="w-12 h-12 rounded-full bg-[#1e1010] border border-[#441a1a] flex items-center justify-center text-rose-400 mb-4">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>

                <h3 className="text-base font-bold text-white mb-1">Scan Rejected</h3>
                <p className="text-xs text-rose-300 font-mono mb-6 leading-relaxed">
                  {resultData?.error || "Invalid badge payload"}
                </p>

                <button
                  onClick={resumeScanning}
                  className="w-full py-3 bg-[#181818] hover:bg-[#222222] active:scale-98 text-white font-medium text-xs uppercase tracking-wider rounded-xl border border-[#2e2e2e] transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Rescan
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* BOTTOM MOBILE ACTION CONTROLS */}
      <footer className="z-20 w-full px-8 py-3.5 bg-[#050505]/90 backdrop-blur-md border-t border-[#1a1a1a] flex items-center justify-around gap-6">
        {/* Flashlight / Torch Toggle */}
        <button
          onClick={toggleTorch}
          disabled={!isTorchAvailable}
          className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all ${
            !isTorchAvailable
              ? "opacity-25 cursor-not-allowed text-[#666666]"
              : isTorchOn
              ? "text-white bg-[#1c1c1c] border border-white/30 scale-105"
              : "text-[#888888] hover:text-white hover:bg-[#111111] active:scale-95"
          }`}
          title="Toggle Flashlight"
        >
          <svg className="w-5 h-5" fill={isTorchOn ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-[10px] font-mono tracking-wider uppercase">Torch</span>
        </button>

        {/* Flip Camera (Front/Back) */}
        <button
          onClick={flipCamera}
          className="flex flex-col items-center gap-1.5 p-2 rounded-xl text-[#888888] hover:text-white hover:bg-[#111111] active:scale-95 transition-all"
          title="Switch Camera"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-[10px] font-mono tracking-wider uppercase">Flip</span>
        </button>

        {/* Upload Media / Gallery */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center gap-1.5 p-2 rounded-xl text-[#888888] hover:text-white hover:bg-[#111111] active:scale-95 transition-all"
          title="Scan Image from Gallery"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-[10px] font-mono tracking-wider uppercase">Gallery</span>
        </button>
      </footer>
    </div>
  );
}
