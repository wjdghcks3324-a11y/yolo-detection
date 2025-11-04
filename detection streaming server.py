import cv2
import torch
from ultralytics import YOLO
from datetime import datetime
import json
import os
from flask import Flask, jsonify, request, Response
import threading
from collections import deque
import io
from flask_cors import CORS

# ===== Flask 설정 =====
app = Flask(__name__)
CORS(app)

# 실시간 탐지 클래스
REALTIME_CLASSES = ['mounting']
# 온디맨드 탐지 클래스 (앱 버튼으로만 탐지)
ONDEMAND_CLASSES = ['impossibility', 'sale']

# 메시지 저장소 (최근 100개)
messages = deque(maxlen=100)

# 전역 변수
current_frame_for_stream = None
frame_lock = threading.Lock()


class YOLODetectorWithStreaming:
    def __init__(self, model_path):
        self.model = YOLO(model_path)

        # 현재 카메라 프레임 저장
        self.current_frame = None
        self.camera_running = True

    def add_message(self, class_name, confidence, detection_type):
        """메시지 추가 (Figma 앱으로 전송할)"""
        message = {
            "id": len(messages),
            "class": class_name,
            "confidence": round(confidence * 100, 2),
            "type": detection_type,  # "realtime" 또는 "ondemand"
            "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "status": "success"
        }
        messages.append(message)
        print(f"📱 메시지 추가: {class_name} ({confidence:.2%})")
        return message

    def detect_realtime(self, frame, confidence_threshold=0.3):
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
                    self.add_message(class_name, conf, "realtime")

                    # 박스 그리기
                    x1, y1, x2, y2 = box.xyxy[0]
                    cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 255, 0), 3)
                    cv2.putText(frame, f"{class_name} {conf:.2%}", (int(x1), int(y1) - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)

        return frame

    def detect_ondemand(self, class_name, confidence_threshold=0.6):
        """온디맨드 탐지 (앱 버튼으로 호출)"""
        if self.current_frame is None:
            return {
                "success": False,
                "message": "카메라 프레임이 없습니다",
                "class": class_name
            }

        frame = self.current_frame.copy()
        results = self.model(frame)

        detected = False
        confidence = 0

        for r in results:
            boxes = r.boxes
            for box in boxes:
                conf = box.conf[0].item()
                cls = int(box.cls[0].item())
                detected_class = self.model.names[cls]

                # 앱에서 요청한 클래스만 탐지
                if detected_class == class_name and conf > confidence_threshold:
                    print(f"📱 앱 버튼 감지: {detected_class} ({conf:.2%})")
                    confidence = conf
                    detected = True

                    # 박스 그리기
                    x1, y1, x2, y2 = box.xyxy[0]
                    cv2.rectangle(frame, (int(x1), int(y1)), (int(x2), int(y2)), (0, 0, 255), 3)
                    cv2.putText(frame, f"{detected_class} {conf:.2%}", (int(x1), int(y1) - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)

        if detected:
            # 메시지 추가
            msg = self.add_message(class_name, confidence, "ondemand")
            return {
                "success": True,
                "message": f"{class_name} 감지됨!",
                "class": class_name,
                "confidence": round(confidence * 100, 2),
                "type": "ondemand"
            }
        else:
            return {
                "success": False,
                "message": f"{class_name}을(를) 감지하지 못했습니다",
                "class": class_name
            }

    def run_camera(self):
        """카메라 스트림 실행 (백그라운드)"""
        global current_frame_for_stream

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
                frame = self.detect_realtime(frame)

                # 현재 프레임 저장 (앱에서 온디맨드 탐지용)
                self.current_frame = frame

                # 스트리밍용 프레임 저장
                with frame_lock:
                    current_frame_for_stream = frame.copy()

                # 우측 상단에 상태 표시
                cv2.putText(frame, f"Frame: {frame_count}", (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
                cv2.putText(frame, "Server Running...", (10, 70),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                cv2.putText(frame, f"Messages: {len(messages)}", (10, 110),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)

                # 프레임 표시
                cv2.imshow('YOLO Detection - Streaming Mode', frame)

                # 'q' 키로 종료
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    self.camera_running = False
                    break

        finally:
            cap.release()
            cv2.destroyAllWindows()
            print("\n🛑 카메라 종료")


# ===== MJPEG 스트리밍 함수 =====

def generate_frames():
    """MJPEG 프레임 생성"""
    global current_frame_for_stream

    while True:
        with frame_lock:
            if current_frame_for_stream is None:
                continue

            frame = current_frame_for_stream.copy()

        # JPEG로 인코딩
        ret, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        frame_bytes = buffer.tobytes()

        # MJPEG 형식으로 전송
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n'
               b'Content-Length: ' + str(len(frame_bytes)).encode() + b'\r\n\r\n'
               + frame_bytes + b'\r\n')

        # 프레임 레이트 제어
        import time
        time.sleep(0.033)  # 약 30fps


# ===== Flask API 엔드포인트 =====

@app.route('/health', methods=['GET'])
def health():
    """서버 상태 확인"""
    return jsonify({
        "status": "running",
        "message": "YOLO 감지 서버 정상 작동",
        "realtime_classes": REALTIME_CLASSES,
        "ondemand_classes": ONDEMAND_CLASSES,
        "total_messages": len(messages)
    }), 200


@app.route('/video_feed', methods=['GET'])
def video_feed():
    """실시간 비디오 스트림 (MJPEG)"""
    return Response(generate_frames(),
                    mimetype='multipart/x-mixed-replace; boundary=frame')


@app.route('/detect_sale', methods=['POST'])
def detect_sale():
    """앱에서 '판매' 버튼을 눌렀을 때"""
    result = detector.detect_ondemand('sale', confidence_threshold=0.6)
    return jsonify(result), 200 if result['success'] else 400


@app.route('/detect_impossibility', methods=['POST'])
def detect_impossibility():
    """앱에서 '불가능' 버튼을 눌렀을 때"""
    result = detector.detect_ondemand('impossibility', confidence_threshold=0.6)
    return jsonify(result), 200 if result['success'] else 400


@app.route('/get_messages', methods=['GET'])
def get_messages():
    """모든 메시지 조회"""
    limit = request.args.get('limit', default=50, type=int)
    recent_messages = list(messages)[-limit:]

    return jsonify({
        "success": True,
        "total": len(messages),
        "messages": recent_messages
    }), 200


@app.route('/get_latest_message', methods=['GET'])
def get_latest_message():
    """최신 메시지만 조회 (Figma 앱이 자주 호출)"""
    if len(messages) == 0:
        return jsonify({
            "success": False,
            "message": "메시지 없음"
        }), 204

    latest = messages[-1]
    return jsonify({
        "success": True,
        "message": latest
    }), 200


@app.route('/clear_messages', methods=['POST'])
def clear_messages():
    """메시지 초기화"""
    messages.clear()
    return jsonify({
        "success": True,
        "message": "모든 메시지 삭제됨"
    }), 200


@app.route('/status', methods=['GET'])
def status():
    """현재 카메라 상태"""
    return jsonify({
        "camera_running": detector.camera_running,
        "frame_available": current_frame_for_stream is not None,
        "messages_count": len(messages),
        "timestamp": datetime.now().isoformat()
    }), 200


# ===== 전역 detector 객체 =====
detector = None


def start_server(model_path, port=5000):
    """서버 시작"""
    global detector

    print("=" * 60)
    print("🚀 YOLO 감지 스트리밍 서버 시작")
    print("=" * 60)
    print(f"📍 Flask 서버: http://127.0.0.1:{port}")
    print(f"\n📍 API 엔드포인트:")
    print(f"   - GET  /health")
    print(f"   - GET  /status")
    print(f"   - GET  /video_feed              ⭐ 실시간 영상 스트림")
    print(f"   - GET  /get_messages            (메시지)")
    print(f"   - GET  /get_latest_message     (최신 메시지)")
    print(f"   - POST /detect_sale             (판매 탐지)")
    print(f"   - POST /detect_impossibility    (불가능 탐지)")
    print(f"   - POST /clear_messages          (초기화)")
    print("=" * 60)

    # 모델이 없으면 안내
    if not os.path.exists(model_path):
        print(f"❌ 모델을 찾을 수 없습니다: {model_path}")
        print("✅ 먼저 train_yolov8_roboflow.py를 실행해서 모델을 학습시키세요!")
        return

    # Detector 초기화
    detector = YOLODetectorWithStreaming(model_path)

    # 카메라를 백그라운드 스레드에서 실행
    camera_thread = threading.Thread(target=detector.run_camera, daemon=True)
    camera_thread.start()

    print("\n✅ 카메라 백그라운드 실행 중...")
    print("✅ 비디오 스트리밍 준비 완료!")
    print("✅ Figma 앱 연동 대기 중...")
    print("\n📺 Figma 앱에서 이미지 요소의 src를 다음으로 설정하세요:")
    print(f"    http://127.0.0.1:{port}/video_feed")
    print("\n🛑 종료: 카메라 창에서 'q' 키 또는 Ctrl+C\n")

    # Flask 서버 실행
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)


# ===== 실행 =====
if __name__ == "__main__":
    # 모델 경로 설정
    model_path = r'C:\Users\dnjsr\Desktop\YOLO_Project\runs\detect\mounting_detection3\weights\best.pt'
    #서버 시작
    port = int(os.environ.get('PORT', 5000))
        start_server(
        model_path=model_path,
        port=port
        )