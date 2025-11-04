import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { Activity, Search } from "lucide-react";
import { useEffect, useState } from "react";

interface CattleMobileCardProps {
  id: string;
  name: string;
  image: string;
  age: number;
  breed: string;
  isMounting: boolean;
  isAvailableForSale: boolean;
  onCheckSale: () => void;
}

export function CattleMobileCard({
  name,
  image,
  age,
  breed,
  isMounting,
  onCheckSale,
}: CattleMobileCardProps) {
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
      <div className="relative h-48">
        <ImageWithFallback
          src={image}
          alt={name}
          className="w-full h-full object-cover"
        />
        {isMounting && (
          <div className="absolute top-2 right-2 bg-red-500 text-white px-2.5 py-1 rounded-full flex items-center gap-1.5 animate-pulse shadow-lg">
            <Activity className="w-3.5 h-3.5" />
            <span className="text-sm">{formatTime(mountingDuration)}</span>
          </div>
        )}
      </div>
      
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="mb-0.5">{name}</h3>
            <p className="text-sm text-gray-600">{breed} · {age}세</p>
          </div>
          {isMounting && (
            <Badge variant="destructive" className="shrink-0">
              마운팅
            </Badge>
          )}
        </div>

        <Button 
          onClick={onCheckSale}
          className="w-full gap-2"
          variant="outline"
        >
          <Search className="w-4 h-4" />
          판매가능 여부 확인
        </Button>
      </div>
    </Card>
  );
}
