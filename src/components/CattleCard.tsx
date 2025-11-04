import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Clock, Calendar, Activity } from "lucide-react";
import { useEffect, useState } from "react";

interface CattleCardProps {
  id: string;
  name: string;
  image: string;
  age: number;
  breed: string;
  isMounting: boolean;
  saleStartDate: Date;
  saleEndDate: Date;
}

export function CattleCard({
  id,
  name,
  image,
  age,
  breed,
  isMounting,
  saleStartDate,
  saleEndDate,
}: CattleCardProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [mountingDuration, setMountingDuration] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      if (isMounting) {
        setMountingDuration((prev) => prev + 1);
      } else {
        setMountingDuration(0);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isMounting]);

  const getSaleStatus = () => {
    const now = currentTime;
    if (now < saleStartDate) {
      return {
        status: "예정",
        variant: "secondary" as const,
        timeLeft: Math.floor((saleStartDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        unit: "일 후 판매 가능"
      };
    } else if (now >= saleStartDate && now <= saleEndDate) {
      return {
        status: "판매가능",
        variant: "default" as const,
        timeLeft: Math.floor((saleEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        unit: "일 남음"
      };
    } else {
      return {
        status: "판매종료",
        variant: "outline" as const,
        timeLeft: 0,
        unit: "종료"
      };
    }
  };

  const saleStatus = getSaleStatus();

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative h-64">
        <ImageWithFallback
          src={image}
          alt={name}
          className="w-full h-full object-cover"
        />
        {isMounting && (
          <div className="absolute top-3 right-3 bg-red-500 text-white px-3 py-1.5 rounded-full flex items-center gap-2 animate-pulse">
            <Activity className="w-4 h-4" />
            <span>마운팅 중</span>
          </div>
        )}
      </div>
      
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="mb-1">{name}</h3>
            <p className="text-gray-600">품종: {breed}</p>
            <p className="text-gray-600">나이: {age}세</p>
          </div>
          <Badge variant={saleStatus.variant}>{saleStatus.status}</Badge>
        </div>

        {isMounting && (
          <div className="bg-red-50 p-3 rounded-lg border border-red-200">
            <div className="flex items-center gap-2 text-red-700">
              <Clock className="w-4 h-4" />
              <span>마운팅 지속 시간</span>
            </div>
            <div className="text-red-900 mt-1">{formatTime(mountingDuration)}</div>
          </div>
        )}

        <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 text-blue-700 mb-2">
            <Calendar className="w-4 h-4" />
            <span>판매 기간</span>
          </div>
          <div className="space-y-1 text-sm">
            <div className="text-gray-700">
              시작: {saleStartDate.toLocaleDateString('ko-KR')}
            </div>
            <div className="text-gray-700">
              종료: {saleEndDate.toLocaleDateString('ko-KR')}
            </div>
            {saleStatus.timeLeft > 0 && (
              <div className="text-blue-900 mt-2">
                {saleStatus.timeLeft}{saleStatus.unit}
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
