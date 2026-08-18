from PIL import Image
from pathlib import Path

src = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/whale-source-1024.png")
out = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/whale-clean-1024.png")

img = Image.open(src).convert("RGBA")
pixels = img.load()

# For each pixel: if all RGB channels are very light (>235), make it pure white.
# Otherwise keep the pixel (whale or shadow).
for y in range(img.height):
    for x in range(img.width):
        r, g, b, a = pixels[x, y]
        if r > 235 and g > 235 and b > 235:
            pixels[x, y] = (255, 255, 255, 255)

img.save(out, "PNG")
print(f"Saved clean whale to {out}")
