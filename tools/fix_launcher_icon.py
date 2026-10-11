#!/usr/bin/env python3
"""AO3 Reader 自适应图标修复：
1. 从四角 flood-fill 抠掉渐变酒红背景 -> 透明
2. 内容(书+心+AO3) 缩到安全区(~58%) 居中
3. 输出 ic_launcher_foreground.png (432x432 透明)
4. 合成 5 密度传统图标 (背景#5e101e + 内容 82%)
"""
from PIL import Image, ImageDraw, ImageOps
import os, sys

SRC = "app/src/main/res/drawable/ic_launcher_foreground.png"
FG_OUT = "app/src/main/res/drawable/ic_launcher_foreground.png"
CANVAS = 432
SAFE_RATIO = 0.58          # foreground 内容占画布比例（自适应安全区 ~66%，留 58% 更稳）

img = Image.open(SRC).convert("RGBA")
print("源图", img.size)

# ---- 1. 四角 flood-fill 抠背景（在原图上标记，PIL floodfill 比较的是目标图自身像素） ----
thresh = 45  # 容差
corners = [(3, 3), (CANVAS - 4, 3), (3, CANVAS - 4), (CANVAS - 4, CANVAS - 4)]
MARK = (255, 0, 255, 255)
img = img.copy()
for c in corners:
    ImageDraw.floodfill(img, c, MARK, thresh=thresh)

px = img.load()
mask = Image.new("L", img.size, 0)  # 255 = 背景(要透明)
mk = mask.load()
for y in range(CANVAS):
    for x in range(CANVAS):
        r, g, b, a = px[x, y]
        if abs(r - 255) < 4 and abs(g) < 4 and abs(b - 255) < 4:
            mk[x, y] = 255
        else:
            # 额外清理：低亮度且红主导的暗酒红残留（渐变边缘漏网）
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            if lum < 70 and r > g * 1.25 and r > b * 1.2:
                mk[x, y] = 255
print("背景占比: %.1f%%" % (100 * sum(mask.getdata()) / 255 / (CANVAS * CANVAS)))

# 应用透明
out = Image.open(SRC).convert("RGBA")
alpha = out.getchannel("A")
alpha.paste(0, mask)  # 背景处 alpha=0
out.putalpha(alpha)

# 清理孤立噪点（透明区周边 1px 的半透明残留）
import numpy as np
arr = np.array(out)
arr[arr[:, :, 3] < 40] = 0  # 半透明边缘清掉

# 填充主体内部的孤立透明小洞（形态学：3x3 邻域全非零但中心为 0 -> 补上）
from scipy import ndimage  # noqa: F401 (fallback below)
try:
    from scipy import ndimage
    alpha0 = arr[:, :, 3] > 0
    filled = ndimage.binary_fill_holes(alpha0)
    arr[:, :, 3] = np.where(filled & ~alpha0, 255, arr[:, :, 3])
    print("已用 scipy 填充内部空洞")
except ImportError:
    # 无 scipy：简单 3x3 补洞
    h, w = arr.shape[:2]
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if arr[y, x, 3] == 0:
                nb = arr[y-1:y+2, x-1:x+2, 3] > 0
                if nb.sum() >= 7:
                    arr[y, x, 3] = 255
    print("已用 3x3 补洞（无 scipy）")

# ---- 2. 裁剪内容并缩到安全区居中 ----
bbox = Image.fromarray(arr).getbbox()
if bbox is None:
    print("!! 内容为空，中止"); sys.exit(1)
print("内容bbox", bbox)
content = Image.fromarray(arr).crop(bbox)
csize = max(content.size)
scale = (CANVAS * SAFE_RATIO) / csize
content = content.resize((int(content.width * scale), int(content.height * scale)), Image.LANCZOS)

fg = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 0))
fg.paste(content, ((CANVAS - content.width) // 2, (CANVAS - content.height) // 2), content)
fg.save(FG_OUT)
print("foreground 输出", FG_OUT, fg.size)

# ---- 3. 合成传统 5 密度图标 ----
BG_COLOR = (94, 16, 30, 255)
LEGACY_RATIO = 0.82
for dpi, size in [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)]:
    # 传统图标：背景色 + 内容(前景按传统比例放大到满版 82%)
    content2 = Image.fromarray(arr).crop(bbox)
    csize2 = max(content2.size)
    scale2 = (size * LEGACY_RATIO) / csize2
    content2 = content2.resize((int(content2.width * scale2), int(content2.height * scale2)), Image.LANCZOS)
    icon = Image.new("RGBA", (size, size), BG_COLOR)
    icon.paste(content2, ((size - content2.width) // 2, (size - content2.height) // 2), content2)
    for kind in ["ic_launcher", "ic_launcher_round"]:
        p = f"app/src/main/res/mipmap-{dpi}/{kind}.png"
        icon.convert("RGB").save(p)
        print("传统图标", p, icon.size)
print("DONE")
