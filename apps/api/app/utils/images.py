"""Image compression / resize helper.

Used by sponsor banner and event poster upload endpoints.
Re-encodes the uploaded image to keep file sizes small and serve
consistent formats (PNG with alpha → PNG, otherwise JPEG).
"""
from pathlib import Path
from typing import Tuple

from PIL import Image


def compress_image(
    src: Path,
    dest_no_ext: Path,
    max_width: int = 1600,
    jpeg_quality: int = 85,
) -> Tuple[Path, str]:
    """Resize+compress `src`, write next to `dest_no_ext` with chosen extension.

    Returns (final_path, extension_with_dot). PNGs preserve transparency;
    everything else is converted to RGB JPEG.
    """
    with Image.open(src) as im:
        im.load()
        has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
        if im.width > max_width:
            ratio = max_width / float(im.width)
            new_size = (max_width, max(1, int(im.height * ratio)))
            im = im.resize(new_size, Image.LANCZOS)

        if has_alpha:
            ext = ".png"
            final = dest_no_ext.with_suffix(ext)
            im.save(final, format="PNG", optimize=True)
        else:
            ext = ".jpg"
            final = dest_no_ext.with_suffix(ext)
            im.convert("RGB").save(final, format="JPEG", quality=jpeg_quality, optimize=True)

    return final, ext
