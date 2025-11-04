import { useState, useEffect, useRef } from "react";
import { CameraFeed } from "./components/CameraFeed";
import { DetectedCattleCard } from "./components/DetectedCattleCard";
import { KakaoNotification } from "./components/KakaoNotification";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./components/ui/dialog";
import { Badge } from "./components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { Bell, BellOff, Database, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner@2.0.3";
import { Toaster } from "./components/ui/sonner";
import cctvImage from "figma:asset/1e3a856ea8baadbe5550fab2734672ecc8b415e3.png";
import saleDetectionImage from "figma:asset/39a972b313c281b249a8ed65e07b366fda2f1b6e.png";
import { ImageWithFallback } from "./components/figma/ImageWithFallback";

// Flask 서버 설정 - 환경 변수 사용 (배포용)
const FLASK_SERVER_URL = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || "http://127.0.0.1:5000";

// 통합 데이터베이스의 소 정보
interface CattleDatabase {
  id: string;
  registeredImage: string;
  age: number;
  breed: string;
  isAvailableForSale: boolean;
}

// 감지된 소 정보
interface DetectedCattle extends CattleDatabase {
  detectedImage: string;
  isMounting: boolean;
  detectedAt: Date;
  cameraLocation: string;
  confidence: number;
  cameraId: string;
}

function App() {
  // 서버 연결 상태
  const [isServerConnected, setIsServerConnected] = useState(false);
  const [lastMessageId, setLastMessageId] = useState<number>(-1);

  // 이미지에서 해시 기반 ID 생성 함수
  const generateImageBasedId = (imageUrl: string) => {
    // 이미지 URL에서 해시값 추출하여 ID 생성
    const hash = imageUrl.split('/').pop()?.split('?')[0].substring(0, 8).toUpperCase() || '';
    return `#${hash}`;
  };

  // 통합 소 데이터베이스 - 이미지 기반 자동 생성된 ID
  const cattleDatabaseImages = [
    cctvImage,
    cctvImage,
    cctvImage,
    cctvImage,
  ];

  const [cattleDatabase] = useState<CattleDatabase[]>(
    cattleDatabaseImages.map((image, index) => ({
      id: generateImageBasedId(image),
      registeredImage: image,
      age: [3, 4, 2, 5][index],
      breed: "한우",
      isAvailableForSale: [true, false, true, true][index],
    }))
  );

  // 카메라 설정 - 단일 축사
  const cameraLocation = "축사 A동";

  const [detectedCattleList, setDetectedCattleList] = useState<DetectedCattle[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedCattle, setSelectedCattle] = useState<DetectedCattle | null>(null);
  const [showSaleDialog, setShowSaleDialog] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const previousMountingState = useRef<{ [key: string]: boolean }>({});

  // Flask 서버 헬스 체크
  const checkServerHealth = async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3초 타임아웃

      const response = await fetch(`${FLASK_SERVER_URL}/health`, {
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        if (!isServerConnected) {
          toast.success("Flask 서버에 연결되었습니다!");
        }
        setIsServerConnected(true);
        return true;
      }
    } catch (error: any) {
      // 에러를 조용히 처리 (콘솔 로그만)
      if (error.name !== 'AbortError') {
        console.log("서버 연결 대기 중...");
      }
      setIsServerConnected(false);
    }
    return false;
  };

  // 이미지 스캔 - 서버와 연동하지 않고 로컬 시뮬레이션
  const handleScanCamera = (capturedImage: string) => {
    setIsScanning(true);

    // 스캔 시뮬레이션 (2초)
    setTimeout(() => {
      // 랜덤하게 데이터베이스에서 소 선택
      const randomCattle = cattleDatabase[Math.floor(Math.random() * cattleDatabase.length)];
      const confidence = 85 + Math.random() * 13; // 85-98% 일치도

      const detectedCattle: DetectedCattle = {
        ...randomCattle,
        detectedImage: capturedImage,
        isMounting: false, // 서버에서 실시간으로 업데이트됨
        detectedAt: new Date(),
        cameraLocation: cameraLocation,
        confidence,
        cameraId: "CAM-01",
      };

      // 기존에 감지된 소 업데이트 또는 새로 추가
      setDetectedCattleList(prev => {
        const existingIndex = prev.findIndex(c => c.id === detectedCattle.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = detectedCattle;
          return updated;
        } else {
          return [detectedCattle, ...prev];
        }
      });

      setIsScanning(false);
    }, 2000);
  };

  // Flask 서버에서 실시간 mounting 메시지 폴링
  useEffect(() => {
    const pollMessages = async () => {
      if (!isServerConnected) return;

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);

        const response = await fetch(`${FLASK_SERVER_URL}/get_latest_message`, {
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        if (response.status === 204) {
          // 메시지 없음
          return;
        }

        if (response.ok) {
          const data = await response.json();
          const message = data.message;

          // 이미 처리한 메시지는 무시
          if (message.id <= lastMessageId) return;
          
          setLastMessageId(message.id);

          // mounting 메시지 처리
          if (message.class === 'mounting' && message.type === 'realtime') {
            // 랜덤 소 선택 (실제로는 이미지 인식으로 매칭해야 함)
            const randomCattle = cattleDatabase[Math.floor(Math.random() * cattleDatabase.length)];
            
            // 감지된 소 목록 업데이트
            setDetectedCattleList(prev => {
              const existingIndex = prev.findIndex(c => c.id === randomCattle.id);
              
              if (existingIndex >= 0) {
                // 기존 소의 마운팅 상태 업데이트
                const updated = [...prev];
                const wasMounting = updated[existingIndex].isMounting;
                updated[existingIndex] = {
                  ...updated[existingIndex],
                  isMounting: true,
                  detectedAt: new Date(),
                  confidence: message.confidence,
                };
                
                // 마운팅 시작 알림
                if (!wasMounting && notificationsEnabled) {
                  toast.custom((t) => (
                    <KakaoNotification
                      cattleId={randomCattle.id}
                      cattleImage={randomCattle.registeredImage}
                      message="🔴 마운팅을 시작했습니다"
                      location={cameraLocation}
                    />
                  ), {
                    duration: 5000,
                    position: "top-center",
                  });
                }
                
                return updated;
              } else {
                // 새로운 소 추가
                const newCattle: DetectedCattle = {
                  ...randomCattle,
                  detectedImage: randomCattle.registeredImage,
                  isMounting: true,
                  detectedAt: new Date(),
                  cameraLocation: cameraLocation,
                  confidence: message.confidence,
                  cameraId: "CAM-01",
                };
                
                // 마운팅 알림
                if (notificationsEnabled) {
                  toast.custom((t) => (
                    <KakaoNotification
                      cattleId={randomCattle.id}
                      cattleImage={randomCattle.registeredImage}
                      message="🔴 마운팅을 시작했습니다"
                      location={cameraLocation}
                    />
                  ), {
                    duration: 5000,
                    position: "top-center",
                  });
                }
                
                return [newCattle, ...prev];
              }
            });
          }
        }
      } catch (error: any) {
        // 타임아웃이나 네트워크 에러는 조용히 처리
        if (error.name !== 'AbortError') {
          console.log("메시지 폴링 대기 중...");
        }
      }
    };

    // 3초마다 폴링
    const interval = setInterval(pollMessages, 3000);
    return () => clearInterval(interval);
  }, [isServerConnected, lastMessageId, notificationsEnabled, cattleDatabase]);

  // 서버 연결 확인 (초기 실행)
  useEffect(() => {
    // 초기 연결 시도 (조용히)
    checkServerHealth();
    
    // 10초마다 서버 상태 확인
    const healthCheckInterval = setInterval(checkServerHealth, 10000);
    return () => clearInterval(healthCheckInterval);
  }, []);

  const handleCheckSale = async (cattle: DetectedCattle) => {
    if (!isServerConnected) {
      toast.error("서버에 연결되지 않았습니다", {
        description: "PyCharm에서 Flask 서버를 실행하고 CORS를 설정해주세요."
      });
      return;
    }

    setSelectedCattle(cattle);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      // Flask 서버에 판매 가능 여부 확인 요청
      const response = await fetch(`${FLASK_SERVER_URL}/detect_sale`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (data.success) {
        // sale 감지됨 - 판매 가능
        setDetectedCattleList(prev =>
          prev.map(c =>
            c.id === cattle.id
              ? { ...c, isAvailableForSale: true }
              : c
          )
        );
        
        // 선택된 소 정보 업데이트
        setSelectedCattle(prev => prev ? { ...prev, isAvailableForSale: true } : null);
        
        toast.success(`판매 가능 (${data.confidence}% 확신)`);
      } else {
        // sale 감지 안됨 - 판매 불가능 확인
        const impController = new AbortController();
        const impTimeoutId = setTimeout(() => impController.abort(), 5000);

        const impossibilityResponse = await fetch(`${FLASK_SERVER_URL}/detect_impossibility`, {
          method: 'POST',
          signal: impController.signal,
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        clearTimeout(impTimeoutId);
        
        const impossibilityData = await impossibilityResponse.json();
        
        if (impossibilityData.success) {
          // impossibility 감지됨 - 판매 불가능
          setDetectedCattleList(prev =>
            prev.map(c =>
              c.id === cattle.id
                ? { ...c, isAvailableForSale: false }
                : c
            )
          );
          
          setSelectedCattle(prev => prev ? { ...prev, isAvailableForSale: false } : null);
          
          toast.error(`판매 불가능 (${impossibilityData.confidence}% 확신)`);
        } else {
          toast.error("판매 가능 여부를 확인할 수 없습니다");
        }
      }
      
      setShowSaleDialog(true);
    } catch (error: any) {
      console.error("판매 확인 실패:", error);
      if (error.name === 'AbortError') {
        toast.error("서버 응답 시간 초과");
      } else {
        toast.error("서버 요청 실패", {
          description: "Flask 서버가 실행 중인지 확인해주세요."
        });
      }
    }
  };

  const mountingCount = detectedCattleList.filter((c) => c.isMounting).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster />
      
      {/* Mobile Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h1 className="text-xl">소 관리 시스템</h1>
              {isServerConnected ? (
                <Wifi className="w-4 h-4 text-green-500" title="서버 연결됨" />
              ) : (
                <WifiOff className="w-4 h-4 text-red-500" title="서버 연결 안됨" />
              )}
            </div>
            <button
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              className="p-2 rounded-full hover:bg-gray-100"
            >
              {notificationsEnabled ? (
                <Bell className="w-5 h-5 text-gray-700" />
              ) : (
                <BellOff className="w-5 h-5 text-gray-400" />
              )}
            </button>
          </div>
          <div className="flex gap-3 text-sm">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-gray-600">DB: {cattleDatabase.length}마리</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <span className="text-gray-600">감지: {detectedCattleList.length}건</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500"></div>
              <span className="text-gray-600">마운팅: {mountingCount}건</span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto">
        <Tabs defaultValue="camera" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="camera">실시간 카메라</TabsTrigger>
            <TabsTrigger value="detected">감지목록 ({detectedCattleList.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="camera" className="px-4 space-y-4 mt-4">
            {!isServerConnected && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <p className="text-sm mb-2">⚠️ Flask 서버에 연결되지 않았습니다</p>
                <p className="text-xs text-gray-600 mb-3">
                  PyCharm에서 다음 명령어로 Flask-CORS를 설치하고 서버를 실행해주세요:
                </p>
                <div className="bg-gray-900 text-white text-xs p-2 rounded mb-2 font-mono">
                  pip install flask-cors
                </div>
                <p className="text-xs text-gray-600 mb-2">
                  그리고 Flask 서버 코드에 다음을 추가하세요:
                </p>
                <div className="bg-gray-900 text-white text-xs p-2 rounded font-mono">
                  from flask_cors import CORS<br/>
                  CORS(app)
                </div>
              </div>
            )}
            <CameraFeed
              location={cameraLocation}
              isScanning={isScanning}
              onScan={handleScanCamera}
              serverConnected={isServerConnected}
              serverUrl={FLASK_SERVER_URL}
            />
          </TabsContent>

          <TabsContent value="detected" className="px-4 space-y-4 mt-4">
            {detectedCattleList.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Database className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>카메라에서 스캔하여</p>
                <p>소를 감지해주세요</p>
              </div>
            ) : (
              detectedCattleList.map((cattle) => (
                <DetectedCattleCard
                  key={`${cattle.id}-${cattle.detectedAt.getTime()}`}
                  {...cattle}
                  onCheckSale={() => handleCheckSale(cattle)}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Sale Status Dialog */}
      <Dialog open={showSaleDialog} onOpenChange={setShowSaleDialog}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle>판매 가능 여부</DialogTitle>
            <DialogDescription>
              감지된 소의 판매 가능 여부를 확인합니다
            </DialogDescription>
          </DialogHeader>
          {selectedCattle && (
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">등록 이미지</div>
                    <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={selectedCattle.registeredImage}
                        alt="등록 이미지"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1">감지 이미지</div>
                    <div className="w-full aspect-square rounded-lg overflow-hidden bg-gray-100 relative">
                      <img
                        src={selectedCattle.detectedImage}
                        alt="감지 이미지"
                        className="w-full h-full object-cover"
                      />
                      {/* YOLO Detection Style Overlay */}
                      <div className="absolute top-0 left-0 right-0 bg-black/70 text-white px-2 py-1 text-[10px] font-mono">
                        Frame: {Math.floor(Math.random() * 1000)} | Detected: 1
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2 items-center">
                  <Badge variant="outline" className="font-mono text-xs">
                    {selectedCattle.id}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {Math.round(selectedCattle.confidence)}% 매칭
                  </Badge>
                  <span className="text-xs text-gray-600">
                    홀스타인 · {selectedCattle.age}세
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg text-center">
                {selectedCattle.isAvailableForSale ? (
                  <div>
                    <Badge variant="default" className="mb-2">
                      판매 가능
                    </Badge>
                    <p className="text-sm text-gray-600">
                      현재 판매가 가능한 상태입니다
                    </p>
                  </div>
                ) : (
                  <div>
                    <Badge variant="secondary" className="mb-2">
                      판매 불가
                    </Badge>
                    <p className="text-sm text-gray-600">
                      현재 판매가 불가능한 상태입니다
                    </p>
                  </div>
                )}
              </div>

              {selectedCattle.isMounting && (
                <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                  <div className="text-sm text-red-900 text-center">
                    ⚠️ 현재 마운팅 중입니다
                  </div>
                </div>
              )}

              <div className="text-xs text-gray-500 space-y-1">
                <div>📍 감지 위치: {selectedCattle.cameraLocation}</div>
                <div>🕐 감지 시각: {selectedCattle.detectedAt.toLocaleString('ko-KR')}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Info Banner */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#FAE100] p-2.5 text-center text-xs shadow-lg">
        {isServerConnected ? (
          <span>✅ Flask 서버 연결됨 | 실시간 마운팅 감지 활성화</span>
        ) : (
          <span>⚠️ Flask 서버 미연결 | PyCharm에서 서버를 실행해주세요 (http://127.0.0.1:5000)</span>
        )}
      </div>
    </div>
  );
}

export default App;