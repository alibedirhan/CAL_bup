"""Masaüstünün Python ortamında tam Unicode dönüşüm sözleşmesini üretir.

Kullanım: kaynak/.venv/bin/python tools/pythonMetinReferansi.py TABLO_JSON BASVURU_JSON
Tarayıcının Unicode sürümü veya yerel ayarı başvuruya karışmaz.
"""
import hashlib
import json
import re
import sys
import unicodedata
from pathlib import Path


def main():
    upper, fold, decimal, ranges = {}, {}, {}, []
    upper_hash, fold_hash = hashlib.sha256(), hashlib.sha256()
    start = previous = None
    for point in range(0x110000):
        if 0xD800 <= point <= 0xDFFF:
            continue
        char = chr(point)
        uppercase, folded = char.upper(), char.casefold()
        if uppercase != char:
            upper[char] = uppercase
        if folded != char:
            fold[char] = folded
        digit = unicodedata.decimal(char, None)
        if digit is not None:
            decimal[char] = str(digit)
        upper_hash.update((uppercase + '\0').encode('utf-8'))
        fold_hash.update((folded + '\0').encode('utf-8'))
        if re.fullmatch(r'\w', char):
            if start is None:
                start = point
            elif previous != point - 1:
                ranges.append([start, previous])
                start = point
            previous = point
    if start is not None:
        ranges.append([start, previous])
    table = {'upper': upper, 'fold': fold, 'decimal': decimal, 'wordRanges': ranges}
    reference = {'unicode': unicodedata.unidata_version, 'upper': upper_hash.hexdigest(), 'fold': fold_hash.hexdigest()}
    for path, data in zip(sys.argv[1:3], [table, reference]):
        Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'Unicode {unicodedata.unidata_version}: tüm karakterlerin upper/casefold sözleşmesi üretildi.')


if __name__ == '__main__':
    main()
