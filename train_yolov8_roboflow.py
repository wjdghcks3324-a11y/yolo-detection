from ultralytics import YOLO
from pathlib import Path
import yaml


def train_model():
    # ===== 1️⃣ 데이터셋 경로 설정 =====
    desktop_path = Path.home() / "Desktop"
    dataset_folder = desktop_path / "-2.v12i.yolov8"

    print("=" * 60)
    print("🎓 YOLOv8 모델 학습 시작")
    print("=" * 60)

    # ===== 2️⃣ data.yaml 파일 확인/생성 =====
    data_yaml_path = dataset_folder / "data.yaml"

    # 만약 data.yaml이 없으면 직접 생성
    if not data_yaml_path.exists():
        print("\n⚠️  data.yaml 파일이 없습니다. 직접 생성합니다...")

        # 클래스 찾기 (labels 폴더 확인)
        train_labels = dataset_folder / "train" / "labels"
        if train_labels.exists():
            # 클래스 정보 추출
            data_yaml_content = {
                'path': str(dataset_folder),  # 데이터셋 루트 경로
                'train': 'train/images',  # 훈련 이미지 경로
                'val': 'valid/images',  # 검증 이미지 경로
                'test': 'test/images',  # 테스트 이미지 경로
                'nc': 3,  # 클래스 개수 (mounting, impossibility, sale = 3개)
                'names': ['mounting', 'impossibility', 'sale']  # 클래스 이름
            }

            # YAML 파일 생성
            with open(data_yaml_path, 'w') as f:
                yaml.dump(data_yaml_content, f, default_flow_style=False)

            print(f"✅ data.yaml 파일 생성 완료: {data_yaml_path}")
        else:
            print("❌ 에러: train/labels 폴더를 찾을 수 없습니다!")
            return
    else:
        print(f"✅ data.yaml 파일 발견: {data_yaml_path}")

    # ===== 3️⃣ 폴더 구조 확인 =====
    print("\n📁 폴더 구조 확인...")
    for folder in ['train', 'valid', 'test']:
        folder_path = dataset_folder / folder
        if folder_path.exists():
            images_count = len(list((folder_path / 'images').glob('*')))
            labels_count = len(list((folder_path / 'labels').glob('*')))
            print(f"   ✅ {folder}/: images={images_count}, labels={labels_count}")
        else:
            print(f"   ❌ {folder}/ 폴더 없음")

    # ===== 4️⃣ YOLOv8 모델 로드 =====
    print("\n🚀 YOLOv8 모델 로드 중...")
    model = YOLO('yolov8n.pt')  # nano 모델 (가장 빠름)
    # 더 큰 모델 옵션:
    # - yolov8s.pt  (small)
    # - yolov8m.pt  (medium)
    # - yolov8l.pt  (large)
    # - yolov8x.pt  (extra large)

    # ===== 5️⃣ 모델 학습 =====
    print("\n📚 모델 학습 시작...\n")

    results = model.train(
        data=str(data_yaml_path),  # 데이터셋 YAML 파일 경로
        epochs=200,  # 학습 반복 횟수
        imgsz=640,  # 입력 이미지 크기
        device=0,  # GPU 사용 (device='cpu'로 변경 가능)
        batch=16,  # 배치 크기 (메모리 부족하면 8로 줄이기)
        patience=20,  # Early stopping (20 epoch 개선 없으면 멈춤)
        save=True,  # 모델 저장
        project='runs/detect',  # 결과 저장 폴더
        name='mounting_detection',  # 프로젝트 이름
        verbose=True,  # 상세 출력
        augment=True,  # 이미지 증강 (학습 안정화)
        hsv_h=0.015,  # HSV 색상 증강
        hsv_s=0.7,  # HSV 채도 증강
        hsv_v=0.4,  # HSV 밝기 증강
        degrees=10,  # 회전 각도
        flipud=0.5,  # 위아래 뒤집기 확률
        fliplr=0.5,  # 좌우 뒤집기 확률
        mosaic=1.0,  # Mosaic 증강
        workers=0,  # Windows 호환성 - multiprocessing 비활성화
    )

    # ===== 6️⃣ 학습 완료 =====
    print("\n" + "=" * 60)
    print("✅ 학습 완료!")
    print("=" * 60)

    # ===== 7️⃣ 저장된 모델 정보 =====
    model_path = Path('runs/detect/mounting_detection/weights/best.pt')
    print(f"\n📊 저장된 모델:")
    print(f"   최고 성능 모델: {model_path}")
    print(f"   마지막 모델: runs/detect/mounting_detection/weights/last.pt")
    print(f"   학습 기록: runs/detect/mounting_detection/results.csv")

    print("\n" + "=" * 60)
    print("🎉 다음 단계")
    print("=" * 60)


# ===== ⭐️ 이것이 중요! Windows에서 필수 =====
if __name__ == '__main__':
    train_model()
