"""
weplay 로고 → 푸른색 입체 favicon/app icon 생성기

입력: 원본 dark 버전 PNG (검정 배경 + 흰 stroke)
출력:
  - favicon-32.png, favicon-16.png
  - apple-touch-icon.png (180px)
  - app-icon-512.png
  - weplay-icon.svg (PNG embed)
"""

from pathlib import Path
from PIL import Image, ImageFilter, ImageChops
import base64
import sys

HERE = Path(__file__).parent
# apps/web/public(0) → web(1) → apps(2) → everyone-play(3) → modu play(4)
SOURCE = HERE.parents[3] / "26_WEPLAY_ICON_dark.png"
OUT = HERE  # apps/web/public

# 푸른 그라데이션
TOP_COLOR = (79, 195, 247)   # 밝은 하늘색
BOTTOM_COLOR = (21, 101, 192)  # 진한 파랑
HIGHLIGHT_COLOR = (187, 222, 251)  # 하이라이트


def extract_stroke_mask(src: Image.Image) -> Image.Image:
    """dark 버전(검정 배경 + 흰 stroke)에서 stroke 영역을 알파 마스크로 추출."""
    gray = src.convert("L")
    # 흰색에 가까울수록 alpha 높게
    return gray


def make_gradient(size, top, bottom):
    w, h = size
    grad = Image.new("RGB", (1, h))
    px = grad.load()
    for y in range(h):
        t = y / max(1, h - 1)
        r = int(top[0] * (1 - t) + bottom[0] * t)
        g = int(top[1] * (1 - t) + bottom[1] * t)
        b = int(top[2] * (1 - t) + bottom[2] * t)
        px[0, y] = (r, g, b)
    return grad.resize((w, h))


def composite_logo(src: Image.Image, target_size: int, with_bg=True) -> Image.Image:
    # 1) 원본 stroke mask 만들기
    mask = extract_stroke_mask(src)

    # 2) 그라데이션 컬러
    grad = make_gradient(src.size, TOP_COLOR, BOTTOM_COLOR)

    # 3) stroke 부분만 그라데이션으로 칠한 RGBA
    stroke_rgba = Image.new("RGBA", src.size, (0, 0, 0, 0))
    stroke_rgba.paste(grad, mask=mask)

    # 4) 입체감: drop shadow (어두운 그림자 + offset)
    shadow_mask = mask.filter(ImageFilter.GaussianBlur(radius=src.size[0] * 0.012))
    shadow_layer = Image.new("RGBA", src.size, (0, 0, 0, 0))
    shadow_color = Image.new("RGBA", src.size, (10, 30, 80, 200))
    shadow_layer.paste(shadow_color, mask=shadow_mask)

    offset = max(1, int(src.size[0] * 0.008))
    shadow_layer = ImageChops.offset(shadow_layer, offset, offset)

    # 5) 하이라이트 (밝은 inner top edge)
    high_mask = mask.filter(ImageFilter.GaussianBlur(radius=src.size[0] * 0.004))
    highlight_layer = Image.new("RGBA", src.size, (0, 0, 0, 0))
    h_color = Image.new("RGBA", src.size, (*HIGHLIGHT_COLOR, 180))
    highlight_layer.paste(h_color, mask=high_mask)
    highlight_layer = ImageChops.offset(highlight_layer, -1, -1)

    # 6) 합성: 그림자 → stroke → 하이라이트
    composed = Image.new("RGBA", src.size, (0, 0, 0, 0))
    composed = Image.alpha_composite(composed, shadow_layer)
    # stroke 위에 하이라이트만 stroke 안쪽에 보이도록 alpha 마스킹
    inner_high = Image.new("RGBA", src.size, (0, 0, 0, 0))
    inner_high.paste(highlight_layer, mask=mask)
    composed = Image.alpha_composite(composed, stroke_rgba)
    composed = Image.alpha_composite(composed, inner_high)

    # 7) 배경 (선택): 푸른 그라데이션 둥근 사각 또는 투명
    if with_bg:
        bg_size = composed.size
        bg = Image.new("RGBA", bg_size, (0, 0, 0, 0))
        # 배경 그라데이션
        bg_grad = make_gradient(bg_size, (227, 242, 253), (144, 202, 249)).convert("RGBA")
        # 둥근 사각 마스크
        from PIL import ImageDraw
        radius = int(min(bg_size) * 0.18)
        rmask = Image.new("L", bg_size, 0)
        ImageDraw.Draw(rmask).rounded_rectangle(
            (0, 0, bg_size[0] - 1, bg_size[1] - 1), radius=radius, fill=255
        )
        bg.paste(bg_grad, mask=rmask)
        # 패딩 적용해서 로고 크기 줄이기
        pad = int(min(bg_size) * 0.12)
        inner = composed.resize((bg_size[0] - pad * 2, bg_size[1] - pad * 2), Image.LANCZOS)
        bg.paste(inner, (pad, pad), inner)
        composed = bg

    # 8) 최종 사이즈로 리샘플
    return composed.resize((target_size, target_size), Image.LANCZOS)


def main():
    if not SOURCE.exists():
        print(f"원본 없음: {SOURCE}")
        sys.exit(1)

    src = Image.open(SOURCE).convert("RGBA")
    print(f"원본: {src.size}")

    # 정사각형으로 trim (이미 정사각이지만 안전)
    w, h = src.size
    s = min(w, h)
    left = (w - s) // 2
    top = (h - s) // 2
    src = src.crop((left, top, left + s, top + s))

    sizes_with_bg = {
        "favicon-32.png": 32,
        "favicon-16.png": 16,
        "apple-touch-icon.png": 180,
        "app-icon-512.png": 512,
    }
    sizes_transparent = {
        "weplay-icon-512-transparent.png": 512,
    }

    for name, size in sizes_with_bg.items():
        img = composite_logo(src, size, with_bg=True)
        out_path = OUT / name
        img.save(out_path, optimize=True)
        print(f"saved {out_path} ({size}x{size})")

    for name, size in sizes_transparent.items():
        img = composite_logo(src, size, with_bg=False)
        out_path = OUT / name
        img.save(out_path, optimize=True)
        print(f"saved {out_path} ({size}x{size})")

    # SVG (PNG embed) — 단순 / favicon 호환
    big_png = OUT / "app-icon-512.png"
    b64 = base64.b64encode(big_png.read_bytes()).decode("ascii")
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <image href="data:image/png;base64,{b64}" width="512" height="512"/>
</svg>'''
    (OUT / "weplay-icon.svg").write_text(svg, encoding="utf-8")
    print(f"saved {OUT / 'weplay-icon.svg'}")

    print("done")


if __name__ == "__main__":
    main()
