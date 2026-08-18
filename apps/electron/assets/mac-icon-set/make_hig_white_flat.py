from PIL import Image
from pathlib import Path

src = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/whale-flat-1024.png")
out = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/whale-hig-white-flat.png")

img = Image.open(src).convert("RGBA")
pixels = img.load()

for y in range(img.height):
    for x in range(img.width):
        r, g, b, a = pixels[x, y]
        # Dark pixels -> white whale
        if r < 100 and g < 100 and b < 100:
            pixels[x, y] = (255, 255, 255, 255)
        else:
            pixels[x, y] = (255, 255, 255, 0)

img.save(out, "PNG")
print(f"Saved white flat whale to {out}")
