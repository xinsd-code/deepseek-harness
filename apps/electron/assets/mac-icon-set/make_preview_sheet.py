"""Render a contact sheet that shows all generated icon sizes side by side,
plus a size reference for the user. Used for visual verification only.
"""

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT_DIR = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set")
SHEET_PATH = OUT_DIR / "preview-sheet.png"

ICON_SIZES = [16, 32, 64, 128, 256, 512, 1024]
ICONSET_FILENAMES = {
    16: "icon_16x16.png",
    32: "icon_16x16@2x.png",  # = 32
    64: "icon_32x32@2x.png",  # = 64
    128: "icon_64x64@2x.png",  # = 128
    256: "icon_128x128@2x.png",  # = 256
    512: "icon_256x256@2x.png",  # = 512
    1024: "icon_512x512@2x.png",  # = 1024
}


def find_font(size: int) -> ImageFont.FreeTypeFont:
    candidates = [
        "/System/Library/Fonts/STHeiti Medium.ttc",
        "/System/Library/Fonts/STHeiti Light.ttc",
        "/System/Library/Fonts/Hiragino Sans GB.ttc",
        "/Library/Fonts/PingFang.ttc",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size=size)
            except OSError:
                continue
    return ImageFont.load_default()


def main() -> None:
    canvas_w = 2400
    canvas_h = 1500
    sheet = Image.new("RGBA", (canvas_w, canvas_h), (245, 246, 248, 255))
    draw = ImageDraw.Draw(sheet)

    title_font = find_font(56)
    sub_font = find_font(28)
    label_font = find_font(28)
    small_label = find_font(20)

    # Title
    draw.text((100, 80), "macOS App Icon · 多尺寸对比预览", fill=(29, 29, 31, 255), font=title_font)
    draw.text(
        (100, 156),
        "macOS App Icon · Multi-size Preview · icon_16/32/64/128/256/512/1024",
        fill=(110, 110, 115, 255),
        font=sub_font,
    )

    # 1024 master on the left
    master = Image.open(OUT_DIR / "icon_1024.png").convert("RGBA")
    master_x, master_y = 100, 240
    sheet.paste(master, (master_x, master_y), master)
    draw.text(
        (master_x, master_y + 1024 + 20),
        "主图 1024 × 1024",
        fill=(29, 29, 31, 255),
        font=label_font,
    )
    draw.text(
        (master_x, master_y + 1024 + 60),
        "主交付尺寸，iconutil 自动生成 .icns",
        fill=(110, 110, 115, 255),
        font=small_label,
    )

    # Smaller sizes stacked right side, bottom-aligned at y = 1264
    right_x = 1240
    baseline_y = 1264
    cursor = right_x
    for size in ICON_SIZES:
        icon_path = OUT_DIR / f"icon_{size}x{size}.png"
        icon = Image.open(icon_path).convert("RGBA")
        x = cursor
        y = baseline_y - size
        sheet.paste(icon, (x, y), icon)
        # Label below
        label = f"{size}×{size}"
        bbox = draw.textbbox((0, 0), label, font=small_label)
        text_w = bbox[2] - bbox[0]
        draw.text(
            (x + size / 2 - text_w / 2, baseline_y + 16),
            label,
            fill=(110, 110, 115, 255),
            font=small_label,
        )
        cursor += size + 32

    # Footer with file inventory
    footer_y = 1400
    inventory = (
        "已生成文件：app-icon.png (主图) · app-icon.icns (macOS) · app-icon.ico (Windows) · "
        "icon.iconset/ (12 个 @1x/@2x) · icon_16~1024.png (7 个扁平 PNG)"
    )
    draw.text((100, footer_y), inventory, fill=(134, 134, 139, 255), font=sub_font)

    sheet.convert("RGB").save(SHEET_PATH, format="PNG", optimize=True)
    print(f"Preview sheet saved: {SHEET_PATH}  ({SHEET_PATH.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
