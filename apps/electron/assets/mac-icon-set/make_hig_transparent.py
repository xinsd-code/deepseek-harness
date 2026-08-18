from PIL import Image
from pathlib import Path

src = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/whale-hig-smooth-1024.png")
out = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/whale-hig-transparent.png")

img = Image.open(src).convert("RGBA")
pixels = img.load()

for y in range(img.height):
    for x in range(img.width):
        r, g, b, a = pixels[x, y]
        # Make the uniform light gray background transparent
        if r == 248 and g == 248 and b == 248:
            pixels[x, y] = (248, 248, 248, 0)

img.save(out, "PNG")
print(f"Saved transparent whale to {out}")
