# 배포 가이드 (Deployment Guide)

## 📋 배포 개요

이 프로젝트는 두 부분으로 나뉘어 배포됩니다:
- **프론트엔드**: React 앱 (Vercel 추천)
- **백엔드**: Flask + YOLO 서버 (Railway 또는 PythonAnywhere)

---

## 🎨 프론트엔드 배포 (Vercel - 추천)

### Vercel 배포 (무료)

1. **Vercel 계정 생성**
   - https://vercel.com 접속
   - GitHub 계정으로 로그인

2. **프로젝트 임포트**
   - **New Project** 클릭
   - GitHub 저장소 선택
   - **Import** 클릭

3. **환경 변수 설정**
   - **Environment Variables** 섹션에서 추가:
     ```
     VITE_API_URL=https://your-flask-server.com
     ```

4. **배포 설정**
   - Framework Preset: `Vite` 선택
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - **Deploy** 클릭

5. **배포 완료!**
   - `https://your-project.vercel.app` 형식의 URL 생성
   - 이후 GitHub에 푸시하면 자동으로 재배포됨

### 대안: Netlify 배포

1. https://netlify.com 접속
2. **Add new site** → **Import an existing project**
3. GitHub 저장소 연결
4. Build settings:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. **Deploy site** 클릭

---

## 🐍 백엔드 배포 (Flask 서버)

### 옵션 1: Railway (추천 - 무료 티어)

1. **Railway 계정 생성**
   - https://railway.app 접속
   - GitHub 계정으로 로그인

2. **새 프로젝트 생성**
   - **New Project** → **Deploy from GitHub repo**
   - Flask 서버 코드가 있는 저장소 선택

3. **필수 파일 추가** (Flask 프로젝트 폴더에)

   **`requirements.txt`** 생성:
   ```txt
   flask==3.0.0
   flask-cors==4.0.0
   ultralytics==8.1.0
   opencv-python-headless==4.8.1.78
   torch==2.1.0
   torchvision==0.16.0
   pillow==10.1.0
   numpy==1.24.3
   ```

   **`Procfile`** 생성:
   ```
   web: python app.py
   ```

   **Flask 코드 수정** (`app.py`):
   ```python
   import os
   from flask import Flask
   from flask_cors import CORS
   
   app = Flask(__name__)
   CORS(app, origins=["https://your-vercel-app.vercel.app"])
   
   # ... 기존 코드 ...
   
   if __name__ == '__main__':
       port = int(os.environ.get('PORT', 5000))
       app.run(host='0.0.0.0', port=port)
   ```

4. **환경 변수 설정**
   - Railway 대시보드에서 **Variables** 탭
   - 필요한 환경 변수 추가

5. **배포**
   - Railway가 자동으로 빌드 및 배포
   - 생성된 URL 확인 (예: `https://your-app.railway.app`)

### 옵션 2: PythonAnywhere (Python 특화)

1. **PythonAnywhere 가입**
   - https://www.pythonanywhere.com
   - 무료 계정 생성

2. **웹 앱 생성**
   - **Web** 탭 → **Add a new web app**
   - Flask 선택

3. **코드 업로드**
   - **Files** 탭에서 코드 업로드
   - 또는 Git으로 clone

4. **가상환경 설정**
   ```bash
   mkvirtualenv --python=/usr/bin/python3.10 myenv
   pip install flask flask-cors ultralytics opencv-python-headless
   ```

5. **WSGI 설정**
   - **Web** 탭에서 WSGI configuration file 수정
   - Flask 앱 경로 설정

6. **재시작**
   - **Reload** 버튼 클릭
   - `https://yourusername.pythonanywhere.com` 접속

### 옵션 3: Render (간단한 대안)

1. https://render.com 접속
2. **New** → **Web Service**
3. GitHub 저장소 연결
4. 설정:
   - Environment: `Python 3`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `python app.py`

---

## 🔗 프론트엔드-백엔드 연결

### 1. Flask 서버 URL 업데이트

프론트엔드 코드에서 Flask URL을 배포된 주소로 변경:

**`App.tsx`** 수정:
```typescript
// 로컬 개발
// const API_URL = 'http://127.0.0.1:5000';

// 배포 환경
const API_URL = import.meta.env.VITE_API_URL || 'https://your-flask-server.railway.app';
```

### 2. CORS 설정 업데이트

Flask 서버에서 프론트엔드 도메인 허용:

```python
from flask_cors import CORS

app = Flask(__name__)
CORS(app, origins=[
    "http://localhost:5173",  # 로컬 개발
    "https://your-vercel-app.vercel.app"  # 배포된 프론트엔드
])
```

### 3. Vercel 환경 변수 설정

Vercel 프로젝트 설정에서:
```
VITE_API_URL=https://your-flask-server.railway.app
```

---

## ⚠️ 중요 고려사항

### 🎥 카메라 기능
- **웹 배포 시 카메라는 사용자의 브라우저 카메라만 접근 가능**
- CCTV 또는 외부 카메라는 Flask 서버에서 직접 처리해야 함
- Flask 서버에서 영상 스트리밍 API 제공 필요

### 🤖 YOLO 모델
- **모델 파일 크기 주의** (`best.pt` 파일이 클 수 있음)
- Railway/Render: 파일 크기 제한 확인
- PythonAnywhere: 파일 저장 용량 제한 확인
- Git LFS 사용 권장:
  ```bash
  git lfs install
  git lfs track "*.pt"
  ```

### 💰 비용
- **Vercel**: 프론트엔드 무료
- **Railway**: 월 $5 무료 크레딧 (이후 종량제)
- **PythonAnywhere**: 무료 티어 제한적
- **Render**: 무료 티어 있음 (대기 시간 있음)

### 🔒 보안
- API 키 환경 변수로 관리
- CORS 설정 프로덕션 도메인만 허용
- HTTPS 사용 (대부분 플랫폼 기본 제공)

---

## 🚀 빠른 배포 체크리스트

### 프론트엔드 (Vercel)
- [ ] GitHub에 코드 푸시
- [ ] Vercel 계정 생성 및 연결
- [ ] 프로젝트 임포트
- [ ] 환경 변수 설정 (`VITE_API_URL`)
- [ ] 배포 완료

### 백엔드 (Railway)
- [ ] Flask 코드를 별도 저장소에 푸시
- [ ] `requirements.txt` 생성
- [ ] `Procfile` 생성
- [ ] Railway 계정 생성 및 연결
- [ ] 프로젝트 임포트
- [ ] YOLO 모델 파일 업로드
- [ ] 배포 완료

### 연결 확인
- [ ] Flask API URL 복사
- [ ] Vercel 환경 변수에 추가
- [ ] Flask CORS에 Vercel URL 추가
- [ ] 재배포
- [ ] 브라우저에서 테스트

---

## 📞 도움이 필요하신가요?

배포 중 문제가 발생하면:
1. 플랫폼의 로그 확인 (Vercel/Railway 대시보드)
2. 브라우저 콘솔 확인 (F12)
3. CORS 에러 확인
4. API URL이 올바른지 확인

성공적인 배포를 응원합니다! 🎉
