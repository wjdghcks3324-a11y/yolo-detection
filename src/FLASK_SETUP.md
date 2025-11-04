# Flask 서버 설정 가이드

## 📋 필수 조건

배포된 웹 앱에서 카메라를 사용하려면 Flask 서버에 **비디오 스트리밍 엔드포인트**가 필요합니다.

## 🎥 Flask 서버에 비디오 스트리밍 추가

Flask 서버 파일(`app.py` 또는 `server.py`)에 다음 코드를 추가하세요:

```python
from flask import Flask, Response, jsonify
from flask_cors import CORS
import cv2

app = Flask(__name__)
CORS(app)

# 카메라 객체 (전역 변수)
camera = None

def get_camera():
    """카메라 객체 가져오기 (싱글톤)"""
    global camera
    if camera is None or not camera.isOpened():
        camera = cv2.VideoCapture(0)  # 0 = 기본 카메라, CCTV는 URL 사용 가능
    return camera

def generate_frames():
    """비디오 프레임 생성 (MJPEG 스트리밍)"""
    camera = get_camera()
    
    while True:
        success, frame = camera.read()
        if not success:
            break
        
        # YOLO 탐지를 여기에 추가할 수 있습니다
        # frame = yolo_model(frame)  # 예시
        
        # JPEG로 인코딩
        ret, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        
        # MJPEG 형식으로 yield
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/video_feed')
def video_feed():
    """비디오 스트리밍 엔드포인트"""
    return Response(
        generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

@app.route('/health')
def health():
    """서버 상태 확인"""
    return jsonify({"status": "ok"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
```

## 🔌 CCTV 카메라 사용하기

RTSP 또는 HTTP 스트림을 사용하는 CCTV 카메라의 경우:

```python
def get_camera():
    global camera
    if camera is None or not camera.isOpened():
        # RTSP 스트림 예시
        camera = cv2.VideoCapture('rtsp://username:password@192.168.1.100:554/stream')
        
        # 또는 HTTP 스트림
        # camera = cv2.VideoCapture('http://192.168.1.100:8080/video')
    return camera
```

## 🚀 배포 시 주의사항

### Railway/Render 배포 시

1. **`Procfile` 수정**:
```
web: python app.py
```

2. **포트 환경 변수 사용**:
```python
import os

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
```

3. **CORS 설정**:
```python
from flask_cors import CORS

# 프론트엔드 도메인만 허용
CORS(app, origins=[
    "http://localhost:5173",  # 로컬 개발
    "https://your-vercel-app.vercel.app"  # 배포된 프론트엔드
])
```

### 카메라 제한사항

⚠️ **중요**: Railway, Render, PythonAnywhere 등 대부분의 클라우드 플랫폼은 **물리적 카메라에 접근할 수 없습니다**.

해결 방법:
1. **로컬 서버 사용**: 축사에 있는 컴퓨터에서 Flask 서버 실행
2. **ngrok 사용**: 로컬 서버를 인터넷에 노출
3. **클라우드 CCTV**: 클라우드 기반 CCTV 서비스 사용

## 🔧 ngrok를 사용한 로컬 서버 노출

로컬 Flask 서버를 인터넷에 노출하는 방법:

1. **ngrok 설치**: https://ngrok.com/download

2. **Flask 서버 실행**:
```bash
python app.py
```

3. **ngrok 실행**:
```bash
ngrok http 5000
```

4. **생성된 URL 사용**:
```
https://abc123.ngrok.io
```

5. **Vercel 환경 변수 업데이트**:
```
VITE_API_URL=https://abc123.ngrok.io
```

## 📊 완전한 Flask 서버 예제 (YOLO + 스트리밍)

```python
from flask import Flask, Response, jsonify, request
from flask_cors import CORS
from ultralytics import YOLO
import cv2
import numpy as np
from datetime import datetime

app = Flask(__name__)
CORS(app)

# YOLO 모델 로드
model = YOLO('best.pt')  # 학습된 모델 경로

# 메시지 저장소
messages = []
message_id_counter = 0

# 카메라
camera = None

def get_camera():
    global camera
    if camera is None or not camera.isOpened():
        camera = cv2.VideoCapture(0)
    return camera

def generate_frames():
    """YOLO 탐지가 포함된 비디오 스트리밍"""
    global messages, message_id_counter
    camera = get_camera()
    
    while True:
        success, frame = camera.read()
        if not success:
            break
        
        # YOLO 탐지
        results = model(frame, conf=0.5)
        
        # 탐지된 객체 처리
        for result in results:
            boxes = result.boxes
            for box in boxes:
                class_id = int(box.cls[0])
                class_name = model.names[class_id]
                confidence = float(box.conf[0])
                
                # mounting 클래스 감지 시 메시지 추가
                if class_name == 'mounting' and confidence > 0.7:
                    messages.append({
                        'id': message_id_counter,
                        'class': 'mounting',
                        'confidence': round(confidence * 100, 2),
                        'type': 'realtime',
                        'timestamp': datetime.now().isoformat()
                    })
                    message_id_counter += 1
                
                # 바운딩 박스 그리기
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                color = (0, 0, 255) if class_name == 'mounting' else (0, 255, 0)
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
                cv2.putText(frame, f'{class_name} {confidence:.2f}', 
                           (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 
                           0.5, color, 2)
        
        # JPEG 인코딩
        ret, buffer = cv2.imencode('.jpg', frame)
        frame_bytes = buffer.tobytes()
        
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

@app.route('/video_feed')
def video_feed():
    return Response(
        generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

@app.route('/health')
def health():
    return jsonify({"status": "ok"})

@app.route('/status')
def status():
    camera = get_camera()
    return jsonify({
        "camera_active": camera.isOpened(),
        "model_loaded": model is not None
    })

@app.route('/get_latest_message')
def get_latest_message():
    if len(messages) > 0:
        return jsonify({"message": messages[-1]})
    return '', 204

@app.route('/detect_sale', methods=['POST'])
def detect_sale():
    camera = get_camera()
    success, frame = camera.read()
    
    if not success:
        return jsonify({"success": False, "error": "카메라 읽기 실패"})
    
    results = model(frame, conf=0.5)
    
    for result in results:
        boxes = result.boxes
        for box in boxes:
            class_name = model.names[int(box.cls[0])]
            if class_name == 'sale':
                return jsonify({
                    "success": True,
                    "confidence": round(float(box.conf[0]) * 100, 2)
                })
    
    return jsonify({"success": False})

@app.route('/detect_impossibility', methods=['POST'])
def detect_impossibility():
    camera = get_camera()
    success, frame = camera.read()
    
    if not success:
        return jsonify({"success": False, "error": "카메라 읽기 실패"})
    
    results = model(frame, conf=0.5)
    
    for result in results:
        boxes = result.boxes
        for box in boxes:
            class_name = model.names[int(box.cls[0])]
            if class_name == 'impossibility':
                return jsonify({
                    "success": True,
                    "confidence": round(float(box.conf[0]) * 100, 2)
                })
    
    return jsonify({"success": False})

if __name__ == '__main__':
    import os
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
```

## ✅ 테스트

1. Flask 서버 실행
2. 브라우저에서 `http://127.0.0.1:5000/video_feed` 접속
3. 카메라 영상이 보이면 성공!

## 🔍 문제 해결

### 카메라 스트림이 보이지 않는 경우

1. **카메라 연결 확인**:
```python
import cv2
cap = cv2.VideoCapture(0)
print(cap.isOpened())  # True가 나와야 함
```

2. **다른 앱에서 카메라 사용 중**: 다른 프로그램 종료

3. **CORS 에러**: Flask-CORS 설정 확인

4. **포트 충돌**: Flask 서버가 5000 포트에서 실행 중인지 확인

더 도움이 필요하시면 언제든 문의하세요! 🚀
