import { ImageWithFallback } from "./figma/ImageWithFallback";

interface KakaoNotificationProps {
  cattleId: string;
  cattleImage: string;
  message: string;
  location?: string;
}

export function KakaoNotification({ cattleId, cattleImage, message, location }: KakaoNotificationProps) {
  return (
    <div className="flex items-start gap-3 bg-[#FAE100] p-3 rounded-lg shadow-lg max-w-sm">
      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-white border border-gray-200">
        <ImageWithFallback
          src={cattleImage}
          alt={cattleId}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-900 mb-0.5 font-mono">{cattleId}</div>
        <div className="text-sm text-gray-800">{message}</div>
        {location && (
          <div className="text-xs text-gray-700 mt-0.5">📍 {location}</div>
        )}
      </div>
    </div>
  );
}
