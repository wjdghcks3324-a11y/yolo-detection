import cv2
import torch
from ultralytics import YOLO
from datetime import datetime, timedelta
import requests
import time
import json
import os

# Discord 설정
DISCORD_WEBHOOK_URL = "YOUR_DISCORD_WEBHOOK_URL"

# 월 1회 탐지 클래스
MONTHLY_CLASSES = ['impossibility', 'sale']
# 실시간 탐지 클래스
REALTIME_CLASSES = ['mounting']


class YOLODetectorNotebook:
    def __init__(self, model_path, webhook_url):
        self.model = YOLO(model_path)
        self.webhook_url = webhook_url

        # 마지막 알림 시간 저장 파일
        self.alert_log_file = 'alert_log.json'
        self.last_alert_time = self.load_alert_log()

    def load_alert_log(self):
        """저장된 마지막 알림 시간 로드"""
        if os.path.exists(self.alert_log_file):
            try:
                with open(self.alert_log_file, 'r') as f:
                    return json.load(f)
            except:
                return {}
        return {}

    def save_alert_log(self):
        """마지막 알림 시간 저장"""
        with open(self.alert_log_file, 'w') as f:
            json.dump(self.last_alert_time, f, indent=4)

    def can_alert_monthly_class(self, class_name):
        """월 1회 클래스 알림 가능 여부 확인"""
        if class_name not in self.last_alert_time:
            return True

        last_time_str = self.last_alert_time[class_name]
        last_time = datetime.fromisoformat(last_time_str)
        current_time = datetime.now()

        # 마지막 알림으로부터 30일이 지났는지 확인
        if (current_time - last_time).days >= 30:
            return True

        return False

    def send_discord_alert(self, class_name, confidence, days_until_next=None):
        """디스코드로 알림 전송"""

        # 월 1회 클래스인 경우 다음 측정 가능 날짜 표시
        description = f"신뢰도: {confidence:.2%}"

        if class_name in MONTHLY_CLASSES and days_until_next is not None:
            description += f"\n\n⏰ 다음 측정 가능: {days_until_next}일 후"

        message = {
            "content": f"🚨 **감지됨!**",
            "embeds": [{
                "title": f"물체 감지: {class_name.upper()}",
                "description": description,
                "color": 0xFF0000 if class_name in MONTHLY_CLASSES else 0x00FF00,
                "timestamp": datetime.now().isoformat(),
                "fields": [
                    {
                        "name": "감지 유형",
                        "value": "📊 월 1회" if class_name in MONTHLY_CLASSES else "⚡ 실시간",
                        "inline": True
                    },
                    {
                        "name": "감지 시간",
                        "value": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
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

    def handle_detection(self, class_name, confidence, confidence_threshold):
        """감지된 클래스 처리"""

        if confidence < confidence_threshold:
            return False

        # ====== REALTIME 클래스 ======
        if class_name in REALTIME_CLASSES:
            print(f"⚡ 실시간 감지: {class_name} ({confidence:.2%})")
            self.send_discord_alert(class_name, confidence)
            return True

        # ====== MONTHLY 클래스 ======
        elif class_name in MONTHLY_CLASSES:
            if self.can_alert_monthly_class(class_name):
                # 다음 측정 가능 날짜 계산
                last_time_str = self.last_alert_time.get(class_name)
                if last_time_str:
                    last_time = datetime.fromisoformat(last_time_str)
                    next_alert_time = last_time + timedelta(days=30)
                    days_until_next = (next_alert_time - datetime.now()).days
                else:
                    days_until_next = 30

                print(f"📊 월 1회 감지: {class_name} ({confidence:.2%})")
                self.send_discord_alert(class_name, confidence, days_until_next=30)

                # 현재 시간으로 업데이트
                self.last_alert_time[class_name] = datetime.now().isoformat()
                self.save_alert_log()
                return True
            else:
                # 다음 측정까지 남은 시간 계산
                last_time = datetime.fromisoformat(self.last_alert_time[class_name])
                next_alert_time = last_time + timedelta(days=30)
                days_until_next = (next_alert_time - datetime.now()).days

                print(f"⏳ {class_name}: 아직 측정 불가 (다음 측정까지 {days_until_next}일 남음)")
                return False

    def run_notebook_camera(self, confidence_threshold_realtime=0.5, confidence_threshold_monthly=0.6):
        """노트북 내장 카메라로 실시간 감지"""

        # 노트북 카메라 연결
        cap = cv2.VideoCapture(0)

        # 카메라 설정
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
        cap.set(cv2.CAP_PROP_FPS, 30)

        print("=" * 60)
        print("🎥 노트북 카메라 시작")
        print("=" * 60)
        print(f"⚡ 실시간 감지 임계값: {confidence_threshold_realtime:.0%}")
        print(f"📊 월 1회 감지 임계값: {confidence_threshold_monthly:.0%}")
        print(f"\n🛑 종료: 'q' 키 누르기\n")

        if not cap.isOpened():
            print("❌ 카메라를 찾을 수 없습니다!")
            return

        try:
            frame_count = 0
            while True:
                ret, frame = cap.read()
                if not ret:
                    print("❌ 카메라 읽기 실패")
                    break

                frame_count += 1

                # 매 3프레임마다만 추론 (성능 최적화)
                if frame_count % 3 != 0:
                    continue

                # YOLO 추론
                results = self.model(frame)

                detected_classes = set()

                # 감지된 객체 처리
                for r in results:
                    boxes = r.boxes
                    for box in boxes:
                        # 신뢰도 및 클래스명 추출
                        conf = box.conf[0].item()
                        cls = int(box.cls[0].item())
                        class_name = self.model.names[cls]

                        # 감지된 클래스 추적
                        detected_classes.add(class_name)

                        # 신뢰도 조건에 따라 처리
                        if class_name in REALTIME_CLASSES:
                            threshold = confidence_threshold_realtime
                        else:  # MONTHLY_CLASSES
                            threshold = confidence_threshold_monthly

                        # 알림 처리
                        self.handle_detection(class_name, conf, threshold)

                        # 박스 그리기
                        x1, y1, x2, y2 = box.xyxy[0]

                        # 클래스에 따라 색상 변경
                        if class_name in REALTIME_CLASSES:
                            color = (0, 255, 0)  # 초록 - 실시간
                        else:
                            color = (0, 0, 255)  # 빨강 - 월 1회

                        cv2.rectangle(frame,
                                      (int(x1), int(y1)),
                                      (int(x2), int(y2)),
                                      color, 2)

                        label_text = f"{class_name} {conf:.2%}"
                        cv2.putText(frame,
                                    label_text,
                                    (int(x1), int(y1) - 10),
                                    cv2.FONT_HERSHEY_SIMPLEX,
                                    0.6, color, 2)

                # 우측 상단에 감지 정보 표시
                info_text = f"Frame: {frame_count} | Detected: {len(detected_classes)}"
                cv2.putText(frame, info_text, (10, 30),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

                # 프레임 표시
                cv2.imshow('YOLO Detection - 노트북 카메라', frame)

                # 'q' 키로 종료
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

        finally:
            cap.release()
            cv2.destroyAllWindows()
            print("\n🛑 카메라 종료")
            print("=" * 60)


# ===== 실행 =====
if __name__ == "__main__":
    # 모델 경로 설정
    model_path = r'C:\Users\dnjsr\Desktop\YOLO_Project\runs\detect\mounting_detection3\weights\best.pt'

    # 모델이 없으면 안내
    if not os.path.exists(model_path):
        print(f"❌ 모델을 찾을 수 없습니다: {model_path}")
        print("✅ 먼저 train_yolov8_roboflow.py를 실행해서 모델을 학습시키세요!")
        exit()

    # Discord 웹훅 URL 확인
    if DISCORD_WEBHOOK_URL == "YOUR_DISCORD_WEBHOOK_URL":
        print("⚠️  Discord 웹훅 URL을 설정하세요!")
        print("    코드에서 DISCORD_WEBHOOK_URL = \"...\" 부분 수정")

    # 감지 시작
    detector = YOLODetectorNotebook(
        model_path=model_path,
        webhook_url=DISCORD_WEBHOOK_URL
    )

    # 실시간 임계값: 0.5 (더 민감)
    # 월 1회 임계값: 0.6 (더 엄격)
    detector.run_notebook_camera(
        confidence_threshold_realtime=0.5,
        confidence_threshold_monthly=0.6
    )