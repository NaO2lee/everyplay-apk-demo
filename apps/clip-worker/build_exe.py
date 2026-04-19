"""PyInstaller 빌드 스크립트.

Windows PC 에서 실행:
  pip install pyinstaller
  python build_exe.py

결과물: dist/clip-worker/ 폴더
  - clip-worker.exe
  - config.ini.example
  → 여기에 ffmpeg.exe 를 직접 넣으면 배포 준비 완료
"""

import PyInstaller.__main__
import shutil
from pathlib import Path

DIST_DIR = Path("dist/clip-worker")

PyInstaller.__main__.run([
    "worker.py",
    "--name=clip-worker",
    "--onefile",
    "--console",
    "--clean",
    "--noconfirm",
])

# config.ini 샘플 복사
DIST_DIR.mkdir(parents=True, exist_ok=True)
shutil.copy("config.ini.example", DIST_DIR / "config.ini.example")

print()
print("=" * 50)
print("빌드 완료!")
print(f"  출력: {DIST_DIR.resolve()}")
print()
print("배포 준비:")
print("  1. config.ini.example 를 config.ini 로 복사 후 설정 입력")
print("  2. ffmpeg.exe 를 같은 폴더에 넣기")
print("  3. clip-worker.exe 더블클릭으로 실행")
print("=" * 50)
