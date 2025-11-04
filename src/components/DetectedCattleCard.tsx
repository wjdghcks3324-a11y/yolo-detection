import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Activity, Search, MapPin, Clock } from "lucide-react";
import { useEffect, useState } from "react";

interface DetectedCattleCardProps {
  id: string;
  registeredImage: string;
  detectedImage: string;
  age: number;
  breed: string;
  isMounting: boolean;
  isAvailableForSale: boolean;
  detectedAt: Date;
  cameraLocation: string;
  confidence: number;
  onCheckSale: () => void;
}

export function DetectedCattleCard({
  id,
  registeredImage,
  detectedImage,
  age,
  breed,
  isMounting,
  detectedAt,
  cameraLocation,
  confidence,
  onCheckSale,
}: DetectedCattleCardProps) {
  const [mountingDuration, setMountingDuration] = useState(0);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isMounting) {
      timer = setInterval(() => {
        setMountingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setMountingDuration(0);
    }

    return () => clearInterval(timer);
  }, [isMounting]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-2 gap-0">
        <div className="relative h-32 border-r border-gray-200">
          <div className="absolute top-1 left-1 bg-blue-600 text-white px-1.5 py-0.5 rounded text-xs z-10">
            등록사진
          </div>
          <ImageWithFallback
            src={registeredImage}
            alt="등록 이미지"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="relative h-32">
          <div className="absolute top-1 left-1 bg-green-600 text-white px-1.5 py-0.5 rounded text-xs z-10">
            감지사진
          </div>
          <ImageWithFallback
            src={detectedImage}
            alt="감지 이미지"
            className="w-full h-full object-cover"
          />
          {isMounting && (
            <div className="absolute bottom-1 right-1 bg-red-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1 text-xs animate-pulse">
              <Activity className="w-3 h-3" />
              <span>{formatTime(mountingDuration)}</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="p-3 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs font-mono">
                {id}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {Math.round(confidence)}% 매칭
              </Badge>
            </div>

          </div>
          {isMounting && (
            <Badge variant="destructive" className="shrink-0 text-xs">
              마운팅
            </Badge>
          )}
        </div>

        <div className="space-y-1.5 text-xs text-gray-600">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3" />
            <span>{cameraLocation}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3" />
            <span>감지: {detectedAt.toLocaleString('ko-KR')}</span>
          </div>
        </div>

        <Button 
          onClick={onCheckSale}
          className="w-full gap-2"
          variant="outline"
          size="sm"
        >
          <Search className="w-3.5 h-3.5" />
          판매가능 여부 확인
        </Button>
      </div>
    </Card>
  );
}
