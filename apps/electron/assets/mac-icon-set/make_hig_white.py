from PIL import Image
from pathlib import Path

src = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/whale-hig-transparent.png")
out = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/whale-hig-white.png")

img = Image.open(src).convert("RGBA")
pixels = img.load()

for y in range(img.height):
    for x in range(img.width):
        r, g, b, a = pixels[x, y]
        if a > 10:
            # Invert to white (preserve slight alpha for anti-aliasing)
            pixels[x, y] = (255, 255, 255, a)

img.save(out, "PNG")
print(f"Saved white whale to {out}")
