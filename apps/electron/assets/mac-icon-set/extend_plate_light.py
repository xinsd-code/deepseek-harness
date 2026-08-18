from PIL import Image
from pathlib import Path

src = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/whale-source-1024.png")
out = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/whale-extended-light-1024.png")

img = Image.open(src).convert("RGBA")
pixels = img.load()

# Use a very light gray for the extended background to keep icon bright
bg = (248, 248, 248)

for y in range(img.height):
    for x in range(img.width):
        r, g, b, a = pixels[x, y]
        if r > 250 and g > 250 and b > 250:
            pixels[x, y] = (*bg, 255)

img.save(out, "PNG")
print(f"Saved light extended plate whale to {out}")
