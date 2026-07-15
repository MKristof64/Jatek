"""Build the local Source Sans 3 variable webfont.

The font outlines and metrics remain untouched. The script only converts the
official Google Fonts source to WOFF2 so the app can use it without a network
request.
"""

from __future__ import annotations

import shutil
import urllib.request
from pathlib import Path

from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = ROOT / "src" / "assets" / "fonts"
SOURCE_DIR = ROOT / "artifacts" / "font-source"
SOURCE_FONT = SOURCE_DIR / "SourceSans3-wght.ttf"
OUTPUT_FONT = FONT_DIR / "source-sans-3-variable.woff2"
SOURCE_LICENSE = ROOT / "public" / "fonts" / "OFL-SourceSans3.txt"

SOURCE_FONT_URL = (
    "https://raw.githubusercontent.com/google/fonts/main/ofl/sourcesans3/"
    "SourceSans3%5Bwght%5D.ttf"
)
SOURCE_LICENSE_URL = (
    "https://raw.githubusercontent.com/google/fonts/main/ofl/sourcesans3/OFL.txt"
)


def download(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".download")
    with urllib.request.urlopen(url, timeout=45) as response:
        temporary.write_bytes(response.read())
    temporary.replace(destination)


def main() -> None:
    FONT_DIR.mkdir(parents=True, exist_ok=True)
    download(SOURCE_FONT_URL, SOURCE_FONT)
    download(SOURCE_LICENSE_URL, SOURCE_LICENSE)

    font = TTFont(SOURCE_FONT)
    font.flavor = "woff2"
    font.save(OUTPUT_FONT)

    shutil.rmtree(SOURCE_DIR, ignore_errors=True)
    print(f"Built {OUTPUT_FONT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
