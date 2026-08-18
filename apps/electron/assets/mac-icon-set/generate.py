"""
Generate the full macOS app icon set from the 1024×1024 master.
Outputs:
  - flat PNGs in /Users/xinsd/WorkBuddy/2026-08-14-17-40-06/.workbuddy/mac-icon-set/
  - iconset folder (for `iconutil` to build .icns)
  - .icns file (macOS native)
  - .ico file (Windows / cross-platform fallback)
  - copies the 1024 master as the new app-icon.png in the Electron assets folder
"""

from pathlib import Path
from PIL import Image

SRC = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/icon_1024.png")
OUT_DIR = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set")
ELECTRON_APP_ICON = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/app-icon.png")
ICONSET_DIR = OUT_DIR / "icon.iconset"

# macOS-standard icon sizes (logical + @2x pairs)
ICON_SIZES = [16, 32, 64, 128, 256, 512, 1024]
# Apple's full iconset mapping
ICONSET_FILES = {
    "icon_16x16.png": 16,
    "icon_16x16@2x.png": 32,
    "icon_32x32.png": 32,
    "icon_32x32@2x.png": 64,
    "icon_64x64.png": 64,
    "icon_64x64@2x.png": 128,
    "icon_128x128.png": 128,
    "icon_128x128@2x.png": 256,
    "icon_256x256.png": 256,
    "icon_256x256@2x.png": 512,
    "icon_512x512.png": 512,
    "icon_512x512@2x.png": 1024,
}


def ensure_dirs() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ICONSET_DIR.mkdir(parents=True, exist_ok=True)


def load_master() -> Image.Image:
    img = Image.open(SRC)
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    return img


def generate_flat_sizes(master: Image.Image) -> list[Path]:
    written: list[Path] = []
    for size in ICON_SIZES:
        out = OUT_DIR / f"icon_{size}x{size}.png"
        resized = master.resize((size, size), Image.LANCZOS)
        resized.save(out, format="PNG", optimize=True)
        written.append(out)
    return written


def generate_iconset(master: Image.Image) -> list[Path]:
    written: list[Path] = []
    for filename, size in ICONSET_FILES.items():
        out = ICONSET_DIR / filename
        resized = master.resize((size, size), Image.LANCZOS)
        resized.save(out, format="PNG", optimize=True)
        written.append(out)
    return written


def build_icns() -> Path | None:
    import shutil
    import subprocess

    icns_path = OUT_DIR / "app-icon.icns"
    if icns_path.exists():
        icns_path.unlink()
    try:
        subprocess.run(
            ["iconutil", "-c", "icns", str(ICONSET_DIR), "-o", str(icns_path)],
            check=True,
            capture_output=True,
        )
        return icns_path
    except FileNotFoundError:
        # iconutil only on macOS
        return None
    except subprocess.CalledProcessError as exc:
        print(f"iconutil failed: {exc.stderr.decode(errors='ignore')}")
        return None


def build_ico(master: Image.Image) -> Path:
    ico_sizes = [(s, s) for s in (16, 24, 32, 48, 64, 128, 256, 512, 1024)]
    ico_path = OUT_DIR / "app-icon.ico"
    master.save(ico_path, format="ICO", sizes=ico_sizes)
    return ico_path


def update_electron_app_icon() -> Path:
    import shutil
    shutil.copy2(SRC, ELECTRON_APP_ICON)
    return ELECTRON_APP_ICON


def main() -> None:
    ensure_dirs()
    master = load_master()
    flat = generate_flat_sizes(master)
    iconset = generate_iconset(master)
    ico = build_ico(master)
    icns = build_icns()
    electron = update_electron_app_icon()

    print("== macOS icon set generation ==")
    for p in flat:
        print(f"  PNG  {p.name:>20}  {p.stat().st_size//1024} KB")
    print()
    for p in iconset:
        print(f"  SET  {p.relative_to(ICONSET_DIR)}  {p.stat().st_size//1024} KB")
    print()
    print(f"  ICO  {ico.name}  {ico.stat().st_size//1024} KB")
    if icns:
        print(f"  ICNS {icns.name}  {icns.stat().st_size//1024} KB")
    else:
        print("  ICNS (skipped: iconutil not available)")
    print()
    print(f"  Replaced Electron app-icon: {electron}  ({electron.stat().st_size//1024} KB)")


if __name__ == "__main__":
    main()
