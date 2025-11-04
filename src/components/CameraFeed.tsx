import { Card } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Camera, Scan, RefreshCw, Video, VideoOff } from "lucide-react";
import { useState, useRef, useEffect } from "react";

interface CameraFeedProps {
  location: string;
  isScanning: boolean;
  onScan: (capturedImage: string) => void;
  serverConnected?: boolean;
  serverUrl?: string;
}

export function CameraFeed({
  location,
  isScanning,
  onScan,
  serverConnected = false,
  serverUrl = "",
}: CameraFeedProps) {
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useServerStream, setUseServerStream] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // 카메라 시작
  const startCamera = async () => {
    try {
      setError(null);
      
      // Flask 서버가 연결되어 있으면 서버 스트림 사용
      if (serverConnected && serverUrl) {
        setUseServerStream(true);
        setIsCameraOn(true);
        return;
      }

      // 서버가 없으면 브라우저 웹캠 사용
      setUseServerStream(false);
      
      // 먼저 사용 가능한 카메라가 있는지 확인
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      if (videoDevices.length === 0) {
        setError("연결된 카메라를 찾을 수 없습니다. 카메라가 연결되어 있는지 확인해주세요.");
        return;
      }

      // 간단한 제약 조건으로 시도
      let stream: MediaStream | null = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false,
        });
      } catch (err) {
        // 실패 시 더 구체적인 제약 조건으로 재시도
        console.log("기본 설정 실패, 다른 설정으로 시도 중...");
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: "user"
          },
          audio: false,
        });
      }
      
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        setIsCameraOn(true);
      }
    } catch (err: any) {
      console.error("카메라 접근 오류:", err);
      
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError("카메라 접근 권한이 거부되었습니다. 브라우저 설정에서 카메라 권한을 허용해주세요.");
      } else if (err.name === "NotFoundError") {
        setError("카메라를 찾을 수 없습니다. 다른 프로그램에서 카메라를 사용 중이거나 연결이 해제되었을 수 있습니다.");
      } else if (err.name === "NotReadableError") {
        setError("카메라가 다른 앱에서 사용 중입니다. 다른 앱을 종료하고 다시 시도해주세요.");
      } else if (err.name === "OverconstrainedError") {
        setError("카메라가 요청된 설정을 지원하지 않습니다. 다시 시도해주세요.");
      } else {
        setError(`카메라를 사용할 수 없습니다: ${err.message || "알 수 없는 오류"}`);
      }
    }
  };

  // 카메라 중지
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraOn(false);
  };

  // 현재 프레임 캡처
  const captureFrame = () => {
    if (!canvasRef.current) return null;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // 서버 스트림 사용 중
    if (useServerStream && imgRef.current) {
      canvas.width = imgRef.current.naturalWidth || 640;
      canvas.height = imgRef.current.naturalHeight || 480;
      ctx.drawImage(imgRef.current, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.9);
    }

    // 브라우저 웹캠 사용 중
    if (videoRef.current) {
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      return canvas.toDataURL("image/jpeg", 0.9);
    }

    return null;
  };

  // 스캔 버튼 클릭
  const handleScan = () => {
    const capturedImage = captureFrame();
    if (capturedImage) {
      onScan(capturedImage);
    }
  };

  // 서버 연결 시 자동으로 카메라 켜기
  useEffect(() => {
    if (serverConnected && serverUrl && !isCameraOn) {
      startCamera();
    }
  }, [serverConnected, serverUrl]);

  // 컴포넌트 언마운트 시 카메라 정리
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <Card className="overflow-hidden">
      <div className="bg-gray-900 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera className="w-4 h-4 text-white" />
          <div>
            <div className="text-white text-sm">실시간 카메라</div>
            <div className="text-gray-400 text-xs">{location}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isCameraOn && (
            <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500">
              <div className="w-1.5 h-1.5 bg-green-400 rounded-full mr-1.5 animate-pulse"></div>
              실시간
            </Badge>
          )}
        </div>
      </div>

      <div className="relative bg-black aspect-video">
        {!isCameraOn ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center text-gray-400">
              <VideoOff className="w-12 h-12 mx-auto mb-2" />
              <p className="text-sm">카메라가 꺼져있습니다</p>
            </div>
          </div>
        ) : (
          <>
            {useServerStream ? (
              <img
                ref={imgRef}
                src={`${serverUrl}/video_feed`}
                alt="Flask 서버 카메라"
                className="w-full h-full object-cover"
                onError={() => {
                  setError("Flask 서버의 카메라 스트림을 불러올 수 없습니다. /video_feed 엔드포인트를 확인해주세요.");
                  setIsCameraOn(false);
                }}
              />
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            )}
            <canvas ref={canvasRef} className="hidden" />
          </>
        )}
        
        {isScanning && (
          <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
            <div className="text-white bg-blue-600 px-4 py-2 rounded-lg flex items-center gap-2 animate-pulse">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>이미지 분석 중...</span>
            </div>
          </div>
        )}

        {/* Scan overlay grid */}
        {isCameraOn && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="w-full h-full grid grid-cols-3 grid-rows-3 gap-0">
              {Array.from({ length: 9 }).map((_, i) => (
                <div key={i} className="border border-blue-400/20"></div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-red-900/90 flex items-center justify-center p-4">
            <div className="text-center">
              <VideoOff className="w-10 h-10 text-red-200 mx-auto mb-3" />
              <p className="text-white text-sm mb-2">{error}</p>
              <p className="text-red-200 text-xs mb-3">
                브라우저 주소창의 자물쇠 아이콘을 클릭하여 카메라 권한을 허용해주세요
              </p>
              <Button 
                onClick={() => {
                  setError(null);
                  startCamera();
                }}
                size="sm"
                variant="secondary"
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                다시 시도
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="p-3 space-y-2">
        {!isCameraOn ? (
          <Button 
            onClick={startCamera}
            className="w-full gap-2"
          >
            <Video className="w-4 h-4" />
            카메라 켜기
          </Button>
        ) : (
          <>
            <Button 
              onClick={handleScan}
              disabled={isScanning}
              className="w-full gap-2"
            >
              <Scan className="w-4 h-4" />
              {isScanning ? "스캔 중..." : "현재 화면 스캔"}
            </Button>
            <Button 
              onClick={stopCamera}
              variant="outline"
              className="w-full gap-2"
            >
              <VideoOff className="w-4 h-4" />
              카메라 끄기
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
