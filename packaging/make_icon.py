"""Draw mySpotify's app icon (amber disc with a note) and save it as a multi-size .ico. Needs Pillow."""
from pathlib import Path

from PIL import Image, ImageDraw

S = 1024
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle((0, 0, S - 1, S - 1), radius=224, fill=(13, 12, 16, 255))
d.ellipse((160, 160, S - 160, S - 160), fill=(245, 184, 61, 255))
ink = (27, 19, 5, 255)
w = 60
# two note heads, two stems, one beam (matches app/icon.svg)
d.ellipse((300, 590, 470, 730), fill=ink)
d.ellipse((560, 540, 730, 680), fill=ink)
d.line((452, 660, 452, 330), fill=ink, width=w)
d.line((712, 610, 712, 285), fill=ink, width=w)
d.polygon([(422, 300), (742, 245), (742, 330), (422, 385)], fill=ink)
out = Path(__file__).with_name("mySpotify.ico")
img.save(out, sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print(f"wrote {out}")
