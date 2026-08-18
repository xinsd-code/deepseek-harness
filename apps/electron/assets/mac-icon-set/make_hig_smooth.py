from PIL import Image, ImageFilter
from pathlib import Path

src = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/whale-extended-light-1024.png")
out = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/whale-hig-smooth-1024.png")

img = Image.open(src).convert("RGBA")
pixels = img.load()

bg = (248, 248, 248, 255)

for y in range(img.height):
    for x in range(img.width):
        r, g, b, a = pixels[x, y]
        avg = (r + g + b) / 3
        # Light pixels (background/plate) -> uniform bg
        if avg > 235:
            pixels[x, y] = bg
        # Whale pixels: ensure opaque
        elif a > 0:
            pixels[x, y] = (r, g, b, 255)

# Very subtle smoothing only on background edges? No, keep sharp.
img.save(out, "PNG")
print(f"Saved smooth HIG master to {out}")
