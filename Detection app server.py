import cv2
import torch
from ultralytics import YOLO
from datetime import datetime
import requests
import json
import os
from flask import Flask, jsonify
import threading

# ===== Flask 설정 =====
app = Flask(__name__)

# Discord 설정
DISCORD_WEBHOOK_URL = "YOUR_DISCORD_WEBHOOK_URL"

# 실시간 탐지 클래스
REALTIME_CLASSES = ['mounting']
# 온디맨드 탐지 클래스 (앱 버튼으로만 탐지)
ONDEMAND_CLASSES = ['impossibility', 'sale']


class YOLODetectorWithApp:
    def __init__(self, model_path, webhook_url):
        self.model = YOLO(model_path)
        self.webhook_url = webhook_url

        # 현재 카메라 프레임 저장
        self.current_frame = None
        self.camera_running = True

    def send_discord_alert(self, class_name, confidence):
        """디스코드로 알림 전송"""
        message = {
            "content": f"🚨 **감지됨!**",
            "embeds": [{
                "title": f"물체 감지: {class_name.upper()}",
                "description": f"신뢰도: {confidence:.2%}\n감지 시간: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
                "color": 0xFF0000 if class_name in ONDEMAND_CLASSES else 0x00FF00,
                "timestamp": datetime.now().isoformat(),
                "fields": [
                    {
                        "name": "감지 유형",
                        "value": "📱 앱 버튼" if class_name in ONDEMAND_CLASSES else "⚡ 실시간",
                        "inline": True
                    }
                ]
            }]
        }

        try:
            requests.post(self.webhook_url, json=message)
            print(f"✅ 디스코드 알림 전송: {class_name}")
        except Exception as e:
            print(f"❌ 디스코드 전송 실패: {e}")

    def detect_realtime(self, frame, confidence_threshold=0.5):
        """실시간 탐지 (mounting만)"""
        results = self.model(frame)

        for r in results:
            boxes = r.boxes
            for box in boxes:
                conf = box.conf[0].item()
                cls = int(box.cls[0].item())
                class_name = self.model.names[cls]

                # mounting만 실시간 탐지
                if class_name in REALTIME_CLASSES and conf > confidence_threshold:
                    print(f"⚡ 실시간 감지: {class_name} ({conf:.2%})")
                    self.send_discord_alert(class_name, conf)

                    # 박스 그리기
                    x1, y1, x2, y2 = box.xyxy[0]
                    cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 2)
                    cv2.putText(frame, f"{class_name} {conf:.2%}", (int(x1), int(y1) - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

        return frame

    def detect_ondemand(self, class_name, confidence_threshold=0.6):
        """온디맨드 탐지 (앱 버튼으로 호출)"""
        if self.current_frame is None:
            return {"success": False, "message": "카메라 프레임이 없습니다"}

        frame = self.current_frame.copy()
        results = self.model(frame)

        detected = False

        for r in results:
            boxes = r.boxes
            for box in boxes:
                conf = box.conf[0].item()
                cls = int(box.cls[0].item())
                detected_class = self.model.names[cls]

                # 앱에서 요청한 클래스만 탐지
                if detected_class == class_name and conf > confidence_threshold:
                    print(f"📱 앱 버튼 감지: {detected_class} ({conf:.2%})")
                    self.send_discord_alert(detected_class, conf)
                    detected = True

                    # 박스 그리기
                    x1, y1, x2, y2 = box.xyxy[0]
                    cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 255), 2)
                    cv2.putText(frame, f"{detected_class} {conf:.2%}", (int(x1), int(y1) - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

        if detected:
            return {
                "success": True,
                "message": f"{class_name} 감지됨!",
                "class": class_name,
                "confidence": conf
            }
        else:
            return {
                "success": False,
                "message": f"{class_name}을(를) 감지하지 못했습니다",
                "class": class_name
            }

    def run_camera(self):
        """카메라 스트림 실행 (백그라운드)"""
        cap = cv2.VideoCapture(0)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        cap.set(cv2.CAP_PROP_FPS, 30)

        print("=" * 60)
        print("🎥 카메라 백그라운드 실행")
        print("=" * 60)

        frame_count = 0

        try:
            while self.camera_running:
                ret, frame = cap.read()
                if not ret:
                    print("❌ 카메라 읽기 실패")
                    break

                frame_count += 1

                # 매 3프레임마다 실시간 탐지
                if frame_count % 3 == 0:
                    frame = self.detect_realtime(frame)

                # 현재 프레임 저장 (앱에서 온디맨드 탐지용)
                self.current_frame = frame

                # 우측 상단에 상태 표시
                cv2.putText(frame, f"Frame: {frame_count}", (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                cv2.putText(frame, "Server Running...", (10, 70),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

                # 프레임 표시
                cv2.imshow('YOLO Detection - Server Mode', frame)

                # 'q' 키로 종료
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    self.camera_running = False
                    break

        finally:
            cap.release()
            cv2.destroyAllWindows()
            print("\n🛑 카메라 종료")


# ===== Flask API 엔드포인트 =====

@app.route('/health', methods=['GET'])
def health():
    """서버 상태 확인"""
    return jsonify({
        "status": "running",
        "message": "YOLO 감지 서버 정상 작동",
        "realtime_classes": REALTIME_CLASSES,
        "ondemand_classes": ONDEMAND_CLASSES
    })


@app.route('/detect_sale', methods=['POST'])
def detect_sale():
    """앱에서 '판매' 버튼을 눌렀을 때"""
    return jsonify(detector.detect_ondemand('sale', confidence_threshold=0.6))


@app.route('/detect_impossibility', methods=['POST'])
def detect_impossibility():
    """앱에서 '불가능' 버튼을 눌렀을 때"""
    return jsonify(detector.detect_ondemand('impossibility', confidence_threshold=0.6))


@app.route('/status', methods=['GET'])
def status():
    """현재 카메라 상태"""
    return jsonify({
        "camera_running": detector.camera_running,
        "frame_available": detector.current_frame is not None,
        "timestamp": datetime.now().isoformat()
    })


# ===== 전역 detector 객체 =====
detector = None


def start_server(model_path, webhook_url, port=5000):
    """서버 시작"""
    global detector

    print("🚀 YOLO 감지 서버 시작")
    print(f"📍 Flask 서버: http://127.0.0.1:{port}")
    print(f"📍 API 엔드포인트:")
    print(f"   - GET  http://127.0.0.1:{port}/health")
    print(f"   - GET  http://127.0.0.1:{port}/status")
    print(f"   - POST http://127.0.0.1:{port}/detect_sale")
    print(f"   - POST http://127.0.0.1:{port}/detect_impossibility")

    # 모델이 없으면 안내
    if not os.path.exists(model_path):
        print(f"❌ 모델을 찾을 수 없습니다: {model_path}")
        print("✅ 먼저 train_yolov8_roboflow.py를 실행해서 모델을 학습시키세요!")
        return

    # Detector 초기화
    detector = YOLODetectorWithApp(model_path, webhook_url)

    # 카메라를 백그라운드 스레드에서 실행
    camera_thread = threading.Thread(target=detector.run_camera, daemon=True)
    camera_thread.start()

    # Flask 서버 실행
    app.run(host='127.0.0.1', port=port, debug=False)


# ===== 실행 =====
if __name__ == "__main__":
    # 모델 경로 설정
    model_path = r'C:\Users\dnjsr\Desktop\YOLO_Project\runs\detect\mounting_detection3\weights\best.pt'

    # Discord 웹훅 URL 확인
    if DISCORD_WEBHOOK_URL == "YOUR_DISCORD_WEBHOOK_URL":
        print("⚠️  Discord 웹훅 URL을 설정하세요!")
        print("    코드에서 DISCORD_WEBHOOK_URL = \"...\" 부분 수정")

    # 서버 시작
    start_server(
        model_path=model_path,
        webhook_url=DISCORD_WEBHOOK_URL,
        port=5000
    )