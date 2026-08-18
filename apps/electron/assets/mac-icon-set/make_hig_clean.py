from PIL import Image
from pathlib import Path

# Start from the flat silhouette (pure white bg + black whale) to avoid shadow/plate artifacts
src = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/whale-flat-1024.png")
out = Path("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/whale-hig-clean-1024.png")

img = Image.open(src).convert("RGBA")
pixels = img.load()

# Uniform background color (light gray, matches existing app-icon corners)
bg = (248, 248, 248, 255)

for y in range(img.height):
    for x in range(img.width):
        r, g, b, a = pixels[x, y]
        # Replace white/very-light background pixels with uniform bg
        if r > 250 and g > 250 and b > 250:
            pixels[x, y] = bg
        # Keep whale pixels fully opaque
        elif a > 0:
            pixels[x, y] = (r, g, b, 255)

img.save(out, "PNG")
print(f"Saved clean HIG master to {out}")

# Verify corners
px = img.load()
print("TL:", px[0,0], "TR:", px[1023,0], "BL:", px[0,1023], "BR:", px[1023,1023])
