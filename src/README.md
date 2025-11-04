# 소 관리 시스템 (Cattle Management System)

실시간 YOLO 객체 감지를 활용한 소 마운팅 모니터링 및 판매 관리 시스템

## 📋 프로젝트 개요

이 프로젝트는 축사에서 소의 마운팅 행동을 실시간으로 감지하고, 판매 가능 여부를 확인할 수 있는 웹 기반 관리 시스템입니다.

### 주요 기능

- 🎥 **실시간 카메라 모니터링**: 웹캠을 통한 실시간 영상 감시
- 🔴 **마운팅 자동 감지**: YOLO 모델을 활용한 실시간 마운팅 행동 감지
- 💬 **카카오톡 스타일 알림**: 마운팅 감지 시 모바일 친화적 알림 표시
- 🏷️ **해시 기반 소 식별**: 이미지에서 자동으로 특징을 추출하여 ID 생성
- 📊 **판매 가능 여부 확인**: YOLO 모델을 통한 온디맨드 판매 상태 확인
- 📱 **모바일 최적화**: 반응형 디자인으로 모바일 환경 지원

## 🛠️ 기술 스택

### Frontend (Figma Make)
- React + TypeScript
- Tailwind CSS
- shadcn/ui 컴포넌트
- Lucide React 아이콘
- Sonner (Toast 알림)

### Backend (Python + Flask)
- Flask (웹 서버)
- Flask-CORS (브라우저 연동)
- YOLOv8 (Ultralytics)
- OpenCV (영상 처리)
- PyTorch (딥러닝)

## 📦 설치 방법

### 1. Frontend 설정

이 프로젝트는 Figma Make로 제작되었으므로 별도 설치가 필요 없습니다.

### 2. Backend 설정 (Flask 서버)

**필수 패키지 설치:**

```bash
pip install flask flask-cors
pip install ultralytics opencv-python torch
```

**Flask 서버 실행:**

1. PyCharm에서 Flask 서버 코드 열기
2. 다음 코드를 서버 파일 상단에 추가:

```python
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # 브라우저 접근 허용
```

3. 서버 실행:

```bash
python your_server_file.py
```

서버가 `http://127.0.0.1:5000`에서 실행됩니다.

## 🚀 사용 방법

### 1. Flask 서버 시작
- PyCharm에서 Flask 서버를 실행합니다
- 앱 상단에 Wi-Fi 아이콘이 녹색으로 변경되면 연결 성공

### 2. 실시간 모니터링
- **실시간 카메라** 탭에서 카메라 피드 확인
- Flask 서버가 마운팅을 감지하면 자동으로 알림 표시
- 마운팅 중인 소는 빨간색 배지와 함께 실시간 카운터 표시

### 3. 판매 가능 여부 확인
- **감지목록** 탭에서 감지된 소 확인
- "판매가능 여부 확인" 버튼 클릭
- Flask 서버가 YOLO로 `sale` 또는 `impossibility` 클래스 탐지
- 결과에 따라 판매 가능/불가능 상태 업데이트

## 🔧 Flask API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/health` | 서버 상태 확인 |
| GET | `/status` | 카메라 상태 확인 |
| GET | `/get_messages` | 모든 메시지 조회 |
| GET | `/get_latest_message` | 최신 메시지 1개 조회 |
| POST | `/detect_sale` | 판매 가능 여부 탐지 |
| POST | `/detect_impossibility` | 판매 불가능 탐지 |
| POST | `/clear_messages` | 메시지 초기화 |

## 📊 YOLO 클래스

### 실시간 탐지 (자동)
- `mounting`: 마운팅 행동 감지

### 온디맨드 탐지 (버튼 클릭)
- `sale`: 판매 가능 상태
- `impossibility`: 판매 불가능 상태

## 🎨 UI 특징

- 📱 모바일 퍼스트 디자인
- 🟢 실시간 서버 연결 상태 표시
- 🔔 토글 가능한 알림 시스템
- 📈 대시보드 형태의 정보 표시
- ⏱️ 마운팅 시간 실시간 카운터

## ⚠️ 주의사항

- **CORS 설정**: Flask 서버에 반드시 `flask-cors` 설치 및 `CORS(app)` 추가 필요
- **카메라 권한**: 브라우저에서 카메라 접근 권한 허용 필요
- **YOLO 모델**: 사전 학습된 YOLO 모델 파일(`best.pt`) 필요
- **서버 포트**: Flask 서버는 반드시 5000 포트 사용

## 🔒 보안

이 시스템은 개발/테스트 목적으로 제작되었습니다:
- PII(개인 식별 정보) 수집에 사용하지 마세요
- 민감한 데이터 저장하지 마세요
- 프로덕션 환경에서는 적절한 보안 조치 추가 필요

## 📝 라이선스

이 프로젝트는 교육 및 연구 목적으로 제작되었습니다.

## 🤝 기여

프로젝트 개선을 위한 이슈 및 풀 리퀘스트를 환영합니다!

## 📞 문의

프로젝트 관련 문의사항은 Issues 탭에 남겨주세요.
