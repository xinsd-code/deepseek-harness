from PIL import Image
from pathlib import Path

whale = Image.open("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/whale-hig-white-flat.png").convert("RGBA")
bg = Image.new("RGBA", whale.size, (28, 28, 30, 255))  # #1c1c1e
# Composite white whale onto dark bg
out = Image.alpha_composite(bg, whale)
out.save("/Users/xinsd/Documents/GitHub/deepseek-harness/apps/electron/assets/mac-icon-set/whale-hig-dark-master.png", "PNG")
print("Saved dark variant master")
