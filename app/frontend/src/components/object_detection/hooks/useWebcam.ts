// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: © 2025 Tenstorrent AI ULC
import { useState, useRef, useCallback, useEffect } from "react";
import { startCapture, stopCapture, sendSnapshot } from "../utils/webcamUtils";
import { Detection, DetectionMetadata } from "../types/objectDetection";

export const useWebcam = (
  setDetections: (data: {
    boxes: Detection[];
    metadata: DetectionMetadata;
  }) => void,
  setLiveMode: (mode: boolean) => void,
  setIsLoading: (isLoading: boolean) => void,
  setIsStreaming: (isStreaming: boolean) => void,
  setIsCameraOn: (isCameraOn: boolean) => void,
  modelID: string
) => {
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isLiveRef = useRef(false);
  const processingRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>("");

  useEffect(() => {
    // Note: Labels might be empty if permissions aren't granted yet.
    import("../utils/webcamUtils").then(({ enumerateCameras }) => {
      enumerateCameras().then(setCameras);
    });
  }, []);

  const processFrame = useCallback(async () => {
    if (!isLiveRef.current || processingRef.current || !videoRef.current)
      return;

    processingRef.current = true;
    try {
      await sendSnapshot(videoRef, setDetections, modelID);
    } catch (error) {
      console.error("Error sending snapshot:", error);
    } finally {
      processingRef.current = false;
      if (isLiveRef.current) {
        requestAnimationFrame(processFrame);
      }
    }
  }, [setDetections, modelID]);

  const handleStartCapture = useCallback(async () => {
    setIsCapturing(true);
    setLiveMode(true);
    setIsLoading(true);
    setIsStreaming(true);
    setIsCameraOn(true);
    isLiveRef.current = true;

    try {
      await startCapture(videoRef, setDetections, setIsLoading, selectedDeviceId);
      setIsLoading(false);
      processFrame();

      // Refresh camera list after permission is granted to ensure we have labels
      const { enumerateCameras } = await import("../utils/webcamUtils");
      const devices = await enumerateCameras();
      setCameras(devices);

    } catch (error) {
      console.error("Error accessing webcam:", error);
      setIsLoading(false);
      isLiveRef.current = false;
    }
  }, [
    setDetections,
    setLiveMode,
    setIsLoading,
    setIsStreaming,
    setIsCameraOn,
    processFrame,
    selectedDeviceId
  ]);

  const handleStopCapture = useCallback(() => {
    setIsCapturing(false);
    setLiveMode(false);
    setIsStreaming(false);
    setIsCameraOn(false);
    stopCapture(videoRef);
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    isLiveRef.current = false;
    // Reset detections
    setDetections({
      boxes: [],
      metadata: { width: 0, height: 0, inferenceTime: 0 },
    });
  }, [setLiveMode, setIsStreaming, setIsCameraOn, setDetections]);

  useEffect(() => {
    return () => {
      handleStopCapture();
    };
  }, [handleStopCapture]);

  return {
    isCapturing,
    handleStartCapture,
    handleStopCapture,
    videoRef,
    cameras,
    selectedDeviceId,
    setSelectedDeviceId
  };
};
