#!/usr/bin/env python3
import sys, os, re, json, argparse

try:
    import pdfplumber
except ImportError:
    print("pip install pdfplumber", file=sys.stderr)
    sys.exit(1)

try:
    import pytesseract
    from PIL import Image
    import fitz as pymupdf
    import shutil

    _tess_path = os.environ.get("TESSERACT_PATH") or shutil.which("tesseract")
    if not _tess_path and sys.platform == "win32":
        _win_default = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
        if os.path.exists(_win_default):
            _tess_path = _win_default
    if _tess_path:
        pytesseract.pytesseract.tesseract_cmd = _tess_path
    HAS_OCR = True
except ImportError:
    HAS_OCR = False


def _detect_ocr_langs():
    env_lang = os.environ.get("OCR_LANGS")
    if env_lang:
        return env_lang
    try:
        available = set(pytesseract.get_languages(config=""))
        want = ["uzb", "rus", "eng"]
        chosen = [l for l in want if l in available]
        return "+".join(chosen) if chosen else "eng"
    except Exception:
        return "uzb+rus+eng"


def get_rows_from_words(page, y_tol=5, x_tol=3):
    words = page.extract_words(keep_blank_chars=True, x_tolerance=x_tol, y_tolerance=y_tol)
    rows = {}
    for w in words:
        y_key = round(w["top"] / y_tol) * y_tol
        rows.setdefault(y_key, []).append(w)
    result = []
    for y_key in sorted(rows.keys()):
        row_words = sorted(rows[y_key], key=lambda w: w["x0"])
        result.append({"y": y_key, "words": row_words})
    return result


def row_to_text(row):
    return " ".join(w["text"] for w in row["words"]).strip()


def extract_numbers_from_end(text):
    parts = text.split()
    nums = []
    title_parts = []
    found_text = False
    for p in reversed(parts):
        if not found_text and re.match(r"^\d+$", p):
            nums.insert(0, int(p))
        else:
            found_text = True
            title_parts.insert(0, p)
    return " ".join(title_parts), nums


PARTICLE_PDF_ORDER = [
    ("soat",         "soat"),
    ("jami",         "Jami"),
    ("maruza",       "Ma'ruza"),
    ("amaliy",       "Amaliy mashg'ulot"),
    ("laboratoriya", "Laboratoriya mashg'uloti"),
    ("mustaqil",     "Mustaqil ta'lim"),
]


def make_particle(nums, load_cols=None):
    if not nums:
        return [], [], 0

    if load_cols is not None and 0 < load_cols <= len(nums):
        yuk = list(nums[:load_cols])
        kred = list(nums[load_cols:])
    else:
        yuk, kred = [], []
        in_kred = False
        for n in nums:
            if not in_kred and n >= 20:
                yuk.append(n)
            else:
                in_kred = True
                kred.append(n)

    particle = []
    for idx, val in enumerate(yuk):
        if idx < len(PARTICLE_PDF_ORDER):
            slug, title = PARTICLE_PDF_ORDER[idx]
        else:
            slug, title = f"col_{idx}", ""
        particle.append({"slug": slug, "title": title, "value": val})

    total_credit = kred[-1] if kred else 0
    return particle, kred, total_credit


def make_semesters(kred_list):
    return {str(i+1): {"hour": kr, "credit": kr} for i, kr in enumerate(kred_list)}


ROMAN_TO_NUM = {"I":1,"II":2,"III":3,"IV":4,"V":5,"VI":6,"VII":7,
                "11":2,"111":3,"1111":4}
NUM_TO_ROMAN = {1:"I",2:"II",3:"III",4:"IV",5:"V",6:"VI",7:"VII"}

STD_MONTH_NAMES = [
    "Sentabr", "Oktabr", "Noyabr", "Dekabr",
    "Yanvar",  "Fevral", "Mart",   "Aprel",
    "May",     "Iyun",   "Iyul",   "Avgust",
]


def _equal_distribution(names, total_weeks):
    n = len(names) or 1
    base = total_weeks // n
    extra = total_weeks % n
    return [(nm, base + (1 if i < extra else 0)) for i, nm in enumerate(names)]

MONTH_ALIASES = {
    "Sentabr":  ["sentabr", "sentyabr", "сентябр", "september"],
    "Oktabr":   ["oktabr", "oktyabr", "октябр", "october"],
    "Noyabr":   ["noyabr", "ноябр", "november"],
    "Dekabr":   ["dekabr", "декабр", "december"],
    "Yanvar":   ["yanvar", "январ", "january"],
    "Fevral":   ["fevral", "феврал", "february"],
    "Mart":     ["mart", "март", "march"],
    "Aprel":    ["aprel", "апрел", "april"],
    "May":      ["may", "май"],
    "Iyun":     ["iyun", "июн", "june"],
    "Iyul":     ["iyul", "июл", "july"],
    "Avgust":   ["avgust", "август", "august"],
}


def _find_month_markers(page, week_row_y):
    if not week_row_y:
        return []
    try:
        words = page.extract_words(x_tolerance=2, y_tolerance=3)
    except Exception:
        return []
    cand = [w for w in words if w.get("top", 0) < week_row_y]
    if not cand:
        return []

    markers = []
    for w in cand:
        txt_low = w["text"].lower().strip(".,:;")
        if len(txt_low) < 3:
            continue
        for canonical, aliases in MONTH_ALIASES.items():
            if any(a[:4] in txt_low for a in aliases if len(a) >= 4):
                markers.append(((w["x0"] + w["x1"]) / 2, canonical))
                break

    markers.sort(key=lambda m: m[0])
    dedup = []
    for x_c, nm in markers:
        if dedup and dedup[-1][1] == nm and abs(dedup[-1][0] - x_c) < 30:
            continue
        dedup.append((x_c, nm))
    return dedup


def _detect_months(page, week_row_y, week_positions):
    total_weeks = len(week_positions) if week_positions else 52
    markers = _find_month_markers(page, week_row_y)

    if markers and week_positions and len(markers) >= 10:
        sorted_weeks = sorted(week_positions.items(), key=lambda kv: kv[1])
        result = []
        for i, (x_c, nm) in enumerate(markers):
            x_next = markers[i + 1][0] if i + 1 < len(markers) else float("inf")
            x_lo = x_c - 10 if i == 0 else (markers[i - 1][0] + x_c) / 2
            x_hi = x_next if i + 1 < len(markers) else float("inf")
            wk_count = sum(1 for _, wx in sorted_weeks if x_lo <= wx < x_hi)
            if wk_count > 0:
                result.append((nm, wk_count))
        if len(result) >= 10 and abs(sum(c for _, c in result) - total_weeks) <= 2:
            return result

    return _equal_distribution(STD_MONTH_NAMES, total_weeks)


def _load_default_key_titles():
    custom_path = os.environ.get("KEY_TITLES_JSON")
    if custom_path and os.path.exists(custom_path):
        try:
            with open(custom_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, dict):
                return {str(k): str(v) for k, v in data.items()}
        except Exception as e:
            print(f"WARN: KEY_TITLES_JSON yuklanmadi ({custom_path}): {e}", file=sys.stderr)
    return {}


DEFAULT_KEY_TITLES = _load_default_key_titles()

def _is_single_letter(token):
    if not token or len(token) != 1:
        return False
    return token.isalpha()


def _normalize_legend_key(letter):
    if not letter:
        return ""
    latin = _to_latin_letter(letter)
    return latin.upper() if latin.isalpha() else latin


def _is_numeric_token(text):
    clean = text.strip(".,:;()- ").replace(",", "").replace(".", "")
    return clean.isdigit() if clean else False


def _parse_legend_words(page):
    try:
        words = page.extract_words(x_tolerance=2, y_tolerance=3)
    except Exception:
        return {}
    if not words:
        return {}

    page_h = getattr(page, "height", None) or max(
        (w.get("bottom", w.get("top", 0)) for w in words), default=600
    )

    for threshold in (0.75, 0.60, 0.50):
        legend_words = [w for w in words if w.get("top", 0) > page_h * threshold]
        if len(legend_words) >= 4:
            break
    else:
        return {}

    lines = {}
    for w in legend_words:
        y_key = round(w["top"] / 4) * 4
        lines.setdefault(y_key, []).append(w)

    filtered_lines = {}
    for y_key, row_words in lines.items():
        total = len(row_words)
        num_count = sum(1 for w in row_words if _is_numeric_token(w["text"]))
        if total > 0 and num_count / total < 0.4:
            filtered_lines[y_key] = row_words
    lines = filtered_lines if filtered_lines else lines

    result = {}
    for y_key in sorted(lines.keys()):
        row = sorted(lines[y_key], key=lambda w: w["x0"])

        orphan_tokens = []
        i = 0
        while i < len(row):
            tok = row[i]["text"].strip(".,:;()")
            if _is_single_letter(tok):
                break
            if _is_numeric_token(row[i]["text"]):
                i += 1
                continue
            orphan_tokens.append(row[i]["text"])
            i += 1
        if orphan_tokens:
            orphan_title = " ".join(orphan_tokens).strip()
            if len(orphan_title) >= 5 and not orphan_title.replace(" ", "").isdigit():
                if " " not in result or len(orphan_title) > len(result[" "]):
                    result[" "] = orphan_title

        while i < len(row):
            tok = row[i]["text"].strip(".,:;()")
            if _is_single_letter(tok):
                title_tokens = []
                j = i + 1
                while j < len(row):
                    nxt = row[j]["text"].strip(".,:;()")
                    if _is_single_letter(nxt):
                        break
                    if _is_numeric_token(row[j]["text"]):
                        j += 1
                        continue
                    title_tokens.append(row[j]["text"])
                    j += 1
                if title_tokens:
                    title = " ".join(title_tokens).strip()
                    if len(title) >= 3 and not title.replace(" ", "").isdigit():
                        key = _normalize_legend_key(tok)
                        if key and (key not in result or len(title) > len(result[key])):
                            result[key] = title
                i = j
            else:
                i += 1
    return result


def _parse_legend_text(page):
    text = page.extract_text() or ""
    if not text:
        return {}
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    if not lines:
        return {}
    bottom = lines[len(lines) // 2:] if len(lines) >= 4 else lines
    joined = " ".join(bottom)
    if len(joined) < 10:
        return {}

    pattern = re.compile(
        r"(?<![\wА-Яа-яЁё])([A-ZА-ЯҚҒҲЎЁ])\s+"
        r"([A-Za-zА-Яа-яЁёҚқҒғҲҳЎўІі][\w\sА-Яа-яЁёҚқҒғҲҳЎўІі\'`\u2019\(\)\-]{2,}?)"
        r"(?=\s+[A-ZА-ЯҚҒҲЎЁ]\s|\s*$)"
    )
    result = {}
    first_match_start = None
    for m in pattern.finditer(joined):
        if first_match_start is None:
            first_match_start = m.start()
        key_raw = m.group(1)
        title = m.group(2).strip(" .,:;-")
        key = _normalize_legend_key(key_raw)
        if key and len(title) >= 3:
            if key not in result or len(title) > len(result[key]):
                result[key] = title

    if first_match_start and first_match_start > 5:
        orphan = joined[:first_match_start].strip(" .,:;-")
        if ":" in orphan:
            orphan = orphan.rsplit(":", 1)[-1].strip()
        if len(orphan) >= 5 and not orphan.replace(" ", "").isdigit():
            if " " not in result or len(orphan) > len(result[" "]):
                result[" "] = orphan

    return result


def parse_legend(page):
    result = _parse_legend_words(page)
    if len(result) >= 2:
        return result
    text_result = _parse_legend_text(page)
    merged = dict(result)
    for k, v in text_result.items():
        if k not in merged or len(v) > len(merged[k]):
            merged[k] = v
    return merged


DEFAULT_VALID_KEYS = ""


CYRILLIC_TO_LATIN = {
    "А": "A", "а": "A",   "В": "B", "в": "B",
    "С": "C", "с": "C",   "Е": "E", "е": "E",
    "Н": "H", "н": "H",   "К": "K", "к": "K",
    "М": "M", "м": "M",   "О": "O", "о": "O",
    "Р": "P", "р": "P",   "Т": "T", "т": "T",
    "Х": "X", "х": "X",   "У": "Y", "у": "Y",
    "І": "I", "і": "I",   "Ј": "J", "ј": "J",

    "Б": "B", "б": "B",   "Г": "G", "г": "G",
    "Д": "D", "д": "D",   "Ж": "J", "ж": "J",
    "З": "Z", "з": "Z",   "И": "I", "и": "I",
    "Й": "Y", "й": "Y",   "Л": "L", "л": "L",
    "П": "P", "п": "P",   "Ф": "F", "ф": "F",
    "Ц": "C", "ц": "C",   "Ч": "C", "ч": "C",
    "Ш": "S", "ш": "S",   "Щ": "S", "щ": "S",
    "Ы": "Y", "ы": "Y",   "Э": "E", "э": "E",
    "Ю": "U", "ю": "U",   "Я": "A", "я": "A",
    "Ё": "E", "ё": "E",

    "Қ": "Q", "қ": "Q",   "Ғ": "G", "ғ": "G",
    "Ҳ": "H", "ҳ": "H",   "Ў": "O", "ў": "O",

    "Ї": "I", "ї": "I",   "Є": "E", "є": "E",
}


def _to_latin_letter(ch):
    if not ch or not isinstance(ch, str) or len(ch) != 1:
        return ch
    return CYRILLIC_TO_LATIN.get(ch, ch)


def _normalize_key(p, valid_keys=DEFAULT_VALID_KEYS):
    if not p or not isinstance(p, str):
        return None

    if p in ("о", "О", "o", "O"):
        return " "
    if p == "0":
        return " "

    if p in CYRILLIC_TO_LATIN:
        candidate = CYRILLIC_TO_LATIN[p].upper()
        if not valid_keys or candidate in valid_keys:
            return candidate

    if p.isdigit() or not p.isalpha():
        return None

    if len(p) == 1:
        u = p.upper()
        if not valid_keys or u in valid_keys:
            return u

    return None


def _slugify(text):
    if not text:
        return "unknown"
    s = text.lower().strip()
    s = s.replace("'", "").replace("ʼ", "").replace("`", "").replace("\u2019", "").replace("\u2018", "")
    s = "".join(CYRILLIC_TO_LATIN.get(ch, ch) for ch in s).lower()
    s = re.sub(r"[^\w\s]", "", s, flags=re.UNICODE)
    s = re.sub(r"\s+", "_", s.strip("_ "))
    s = re.sub(r"_+", "_", s)
    return s or "unknown"


def _tokenize_for_match(text):
    if not text:
        return []
    s = text.lower()
    for ch in "'ʼ`\u2018\u2019":
        s = s.replace(ch, "")
    s = re.sub(r"[^\w\s]", " ", s, flags=re.UNICODE)
    s = "".join(CYRILLIC_TO_LATIN.get(ch, ch) for ch in s).lower()
    return [t for t in s.split() if len(t) >= 3]


def _tokens_match(a, b, min_prefix=4):
    if a == b:
        return True
    shorter, longer = (a, b) if len(a) < len(b) else (b, a)
    return len(shorter) >= min_prefix and longer.startswith(shorter)


def _match_legend_key(header_text, legend_titles, threshold=0.5):
    if not header_text or not legend_titles:
        return None
    header_toks = _tokenize_for_match(header_text)
    if not header_toks:
        return None

    best_key = None
    best_score = 0.0
    for key, title in legend_titles.items():
        if not title or not isinstance(title, str):
            continue
        title_toks = _tokenize_for_match(title)
        if not title_toks:
            continue
        matches = sum(
            1 for tt in title_toks if any(_tokens_match(tt, ht) for ht in header_toks)
        )
        score = matches / len(title_toks)
        if score > best_score:
            best_score = score
            best_key = key
    return best_key if best_score >= threshold else None


def _looks_reversed(text):
    if not text or len(text) < 3:
        return False
    tokens = text.split()
    if not tokens:
        return False
    last_tok = tokens[-1]
    first_tok = tokens[0]
    if last_tok and last_tok[-1].isupper() and first_tok and first_tok[0].islower():
        return True
    return False


def _maybe_unreverse(text):
    if _looks_reversed(text):
        return text[::-1]
    return text


def _extract_vertical_columns(page, week_row_y, max_week_x):
    try:
        chars = page.chars or []
    except Exception:
        return []
    if not chars:
        return []

    vert_chars = []
    for c in chars:
        if c.get("upright", True):
            continue
        top = c.get("top", 0)
        if top >= week_row_y:
            continue
        x_c = (c.get("x0", 0) + c.get("x1", 0)) / 2
        if x_c <= max_week_x - 10:
            continue
        vert_chars.append(c)

    if not vert_chars:
        return []

    vert_chars.sort(key=lambda c: (c["x0"] + c["x1"]) / 2)
    columns = []
    for c in vert_chars:
        x_c = (c["x0"] + c["x1"]) / 2
        placed = False
        for i, (cx, chlist) in enumerate(columns):
            if abs(cx - x_c) < 8:
                chlist.append(c)
                new_cx = sum((ch["x0"] + ch["x1"]) / 2 for ch in chlist) / len(chlist)
                columns[i] = (new_cx, chlist)
                placed = True
                break
        if not placed:
            columns.append((x_c, [c]))

    result = []
    for cx, chlist in columns:
        chlist_sorted = sorted(chlist, key=lambda c: c.get("top", 0))
        text = "".join(c.get("text", "") for c in chlist_sorted).strip()
        if len(text) >= 2:
            result.append((cx, text))
    result.sort(key=lambda r: r[0])
    return result


def _detect_stat_columns(page, week_row_y, max_week_x, legend_titles=None):
    vert_cols = _extract_vertical_columns(page, week_row_y, max_week_x)

    try:
        words = page.extract_words(x_tolerance=2, y_tolerance=3)
    except Exception:
        words = []

    cand = []
    for w in words:
        if w.get("top", 0) >= week_row_y:
            continue
        x_c = (w["x0"] + w["x1"]) / 2
        if x_c <= max_week_x - 10:
            continue
        cand.append(w)

    cand_sorted = sorted(cand, key=lambda w: (w["x0"] + w["x1"]) / 2)
    columns = []
    for w in cand_sorted:
        x_c = (w["x0"] + w["x1"]) / 2
        placed = False
        for i, (cx, txt) in enumerate(columns):
            if abs(cx - x_c) < 12:
                columns[i] = ((cx + x_c) / 2, (txt + " " + w["text"]).strip())
                placed = True
                break
        if not placed:
            columns.append((x_c, w["text"]))

    columns.sort(key=lambda c: c[0])

    if vert_cols:
        merged = []
        used_vert = set()
        for hx, htxt in columns:
            best_v = None
            best_d = 15
            for i, (vx, vtxt) in enumerate(vert_cols):
                d = abs(vx - hx)
                if d < best_d:
                    best_d = d
                    best_v = i
            if best_v is not None:
                merged.append((vert_cols[best_v][0], vert_cols[best_v][1]))
                used_vert.add(best_v)
            else:
                merged.append((hx, htxt))
        for i, (vx, vtxt) in enumerate(vert_cols):
            if i not in used_vert:
                merged.append((vx, vtxt))
        merged.sort(key=lambda r: r[0])
        columns = merged

    if not columns:
        return []

    result = []
    used_legend_keys = set()
    for idx, (_, col_text) in enumerate(columns):
        header = col_text.strip()

        header = _maybe_unreverse(header)

        legend_key = None
        if legend_titles:
            legend_key = _match_legend_key(header, legend_titles)
            if not legend_key:
                lk_rev = _match_legend_key(header[::-1], legend_titles)
                if lk_rev:
                    header = header[::-1]
                    legend_key = lk_rev

        if legend_key and legend_key in used_legend_keys:
            legend_key = None
        if legend_key:
            used_legend_keys.add(legend_key)

        result.append({
            "index": idx,
            "header": header,
            "slug": _slugify(header),
            "legendKey": legend_key,
        })
    return result


def _has_q_in_legend(page):
    try:
        words = page.extract_words(x_tolerance=3, y_tolerance=3)
    except Exception:
        return False
    page_h = getattr(page, "height", None) or 600
    for w in words:
        if w["text"] == "Q" and w["top"] > page_h * 0.55:
            return True
    return False


def parse_calendar(page, valid_keys=DEFAULT_VALID_KEYS, key_titles=None):
    if key_titles is None:
        key_titles = DEFAULT_KEY_TITLES
    has_q = _has_q_in_legend(page) or "Q" in valid_keys

    words = page.extract_words(x_tolerance=2, y_tolerance=3)
    rows = {}
    for w in words:
        y_key = round(w["top"] / 6) * 6
        rows.setdefault(y_key, []).append(w)

    week_positions = {}
    week_row_y = 0
    for y_key in sorted(rows.keys()):
        row_words = sorted(rows[y_key], key=lambda w: w["x0"])
        nums = [w for w in row_words if w["text"].isdigit() and 1 <= int(w["text"]) <= 52]
        if len(nums) >= 25:
            week_row_y = y_key
            for w in nums:
                wn = int(w["text"])
                week_positions[wn] = (w["x0"] + w["x1"]) / 2
            break

    if week_positions:
        all_x = sorted(week_positions.items(), key=lambda kv: kv[1])
        if len(all_x) >= 2:
            avg_gap = (all_x[-1][1] - all_x[0][1]) / (all_x[-1][0] - all_x[0][0])
            for wn in range(1, 53):
                if wn not in week_positions:
                    closest = min(week_positions.keys(), key=lambda k: abs(k - wn))
                    week_positions[wn] = week_positions[closest] + (wn - closest) * avg_gap

    max_week_x_pre = max(week_positions.values()) if week_positions else 0
    stat_cols = (
        _detect_stat_columns(page, week_row_y, max_week_x_pre, legend_titles=key_titles)
        if week_row_y else []
    )

    stat_col_map = {c["legendKey"]: c["index"] for c in stat_cols if c.get("legendKey")}

    months_layout = _detect_months(page, week_row_y, week_positions)

    raw_courses = []
    jami_nums = []
    keys_found = set()

    for y_key in sorted(rows.keys()):
        if y_key <= week_row_y:
            continue

        row_words = sorted(rows[y_key], key=lambda w: w["x0"])
        if not row_words:
            continue

        first = row_words[0]["text"]

        course_num = 0
        first_is_key = False

        if first in ROMAN_TO_NUM:
            course_num = ROMAN_TO_NUM[first]
        elif first.isdigit() and 1 <= int(first) <= 10:
            course_num = int(first)
        elif _normalize_key(first, valid_keys) is not None and week_positions:
            first_x = (row_words[0]["x0"] + row_words[0]["x1"]) / 2
            if 1 in week_positions and abs(week_positions[1] - first_x) < 15:
                course_num = len(raw_courses) + 1
                first_is_key = True

        if course_num > 0 and week_positions:
            weeks_mapped = {}
            stat_nums = []

            max_week_x = max(week_positions.values()) if week_positions else 999

            words_to_process = row_words[1:] if not first_is_key else row_words

            for w in words_to_process:
                txt = w["text"]
                x_center = (w["x0"] + w["x1"]) / 2

                if txt.isdigit() and x_center > max_week_x + 15:
                    stat_nums.append(int(txt))
                    continue

                best_week = min(week_positions.keys(), key=lambda wn: abs(week_positions[wn] - x_center))
                dist = abs(week_positions[best_week] - x_center)

                nk = _normalize_key(txt, valid_keys)
                if has_q and txt == "0" and nk == " ":
                    nk = "Q"
                if nk is not None and len(txt) <= 2 and dist < 10:
                    weeks_mapped[best_week] = nk
                    if nk.strip():
                        keys_found.add(nk)

            if len(weeks_mapped) >= 3:
                existing_idx = next((i for i, (cn, _, _) in enumerate(raw_courses) if cn == course_num), None)
                if existing_idx is not None:
                    _, old_wm, _ = raw_courses[existing_idx]
                    if len(weeks_mapped) > len(old_wm):
                        raw_courses[existing_idx] = (course_num, weeks_mapped, stat_nums)
                else:
                    raw_courses.append((course_num, weeks_mapped, stat_nums))
            continue

        if first.lower() == "jami":
            jami_nums = [int(w["text"]) for w in row_words[1:] if w["text"].isdigit()]

    if not raw_courses and not week_positions:
        text = page.extract_text() or ""
        for line in text.split("\n"):
            parts = line.strip().split()
            if not parts: continue
            course_num = 0
            if parts[0] in ROMAN_TO_NUM:
                rest = parts[1:]
                n_keys = sum(1 for p in rest[:15] if len(p)==1 and _normalize_key(p, valid_keys) is not None)
                if n_keys >= 5:
                    course_num = ROMAN_TO_NUM[parts[0]]
            if course_num > 0:
                letters = [_normalize_key(p, valid_keys) or "_" for p in parts[1:] if len(p)==1]
                nums = [int(p) for p in parts[1:] if p.isdigit()]
                wm = {}
                for i, letter in enumerate(letters):
                    if letter and letter != "_":
                        wm[i+1] = letter
                raw_courses.append((course_num, wm, nums))
            if parts[0].lower() == "jami":
                jami_nums = [int(p) for p in parts[1:] if p.isdigit()]

    courses = []
    for course_num, weeks_mapped, nums in raw_courses:
        weeks_map = {}
        for i in range(1, 53):
            key = weeks_mapped.get(i)
            weeks_map[str(i)] = key if (key and key.strip()) else None

        months = []
        wk = 1
        for m_name, m_count in months_layout:
            m_weeks = []
            for _ in range(m_count):
                if wk <= 52:
                    m_weeks.append({"week": wk, "key": weeks_map.get(str(wk)) or " "})
                    wk += 1
            months.append({"month": m_name, "weeks": m_weeks})

        statistics = []
        if stat_cols:
            for col in stat_cols:
                idx = col["index"]
                if idx < len(nums):
                    statistics.append({
                        "key":   col.get("legendKey"),
                        "slug":  col.get("slug", ""),
                        "title": col.get("header", ""),
                        "value": nums[idx],
                    })
        elif nums:
            positional = ["jami", "col_1", "col_2", "col_3", "col_4",
                          "col_5", "col_6", "col_7", "col_8", "hammasi"]
            for i, n in enumerate(nums):
                name = positional[i] if i < len(positional) else f"col_{i}"
                statistics.append({
                    "key":   None,
                    "slug":  name,
                    "title": "",
                    "value": n,
                })
        stat = statistics

        total = nums[0] if nums else sum(1 for v in weeks_map.values() if v)

        courses.append({
            "course": NUM_TO_ROMAN.get(course_num, str(course_num)),
            "courseNum": course_num,
            "months": months,
            "weeks": weeks_map,
            "total": total,
            "statistics": stat,
        })

    av = {"total": 0, "statistics": []}
    if jami_nums:
        n = jami_nums
        av["total"] = n[0] if n else 0
        if stat_cols:
            for col in stat_cols:
                idx = col["index"]
                if idx < len(n):
                    if idx == 0 and col.get("slug", "").lower() in ("jami", "total"):
                        continue
                    av["statistics"].append({
                        "key":   col.get("legendKey"),
                        "slug":  col.get("slug", ""),
                        "title": col.get("header", ""),
                        "value": n[idx],
                    })
        else:
            positional = ["jami", "col_1", "col_2", "col_3", "col_4",
                          "col_5", "col_6", "col_7", "col_8", "hammasi"]
            for i, num in enumerate(n):
                if i == 0:
                    continue
                name = positional[i] if i < len(positional) else f"col_{i}"
                av["statistics"].append({
                    "key":   None,
                    "slug":  name,
                    "title": "",
                    "value": num,
                })

    key_counts = {}
    for _, weeks_mapped, _ in raw_courses:
        for wk_key in weeks_mapped.values():
            if wk_key and wk_key.strip():
                key_counts[wk_key] = key_counts.get(wk_key, 0) + 1

    keys = []
    keys.append({"key": " ", "title": key_titles.get(" ", "")})

    for k in sorted(key_counts.keys()):
        if k and k != " " and key_counts[k] >= 1:
            keys.append({"key": k, "title": key_titles.get(k, "")})

    return courses, av, keys


HEADER_KEYWORDS = {
    "ministry1": [
        ("oliy ta", "vazirl"),
        ("oliy", "vazirlig"),
        ("высшего", "образован"),
        ("higher", "education"),
    ],
    "ministry2": [
        ("sog'", "vazirl"),
        ("sog", "saqlash"),
        ("здравоохран",),
        ("health",),
    ],
    "instituteName": [
        ("institut",),
        ("universitet",),
        ("akademiya",),
        ("akademi",),
        ("university",),
    ],
}


def _line_matches(low_line, combos):
    for combo in combos:
        if all(tok in low_line for tok in combo):
            return True
    return False


def parse_header(page):
    text = page.extract_text() or ""
    lines = [l.strip() for l in text.split("\n") if l.strip()]
    h = dict.fromkeys([
        "ministry1", "ministry2", "instituteName", "directionCode", "directionName",
        "academicLevel", "educationForm", "readingForm", "studyPeriod", "specialization",
    ], "")

    for line in lines:
        low = line.lower().replace("`", "'")

        is_ministry = (
            _line_matches(low, HEADER_KEYWORDS["ministry1"])
            or _line_matches(low, HEADER_KEYWORDS["ministry2"])
        )
        if not h["ministry1"] and _line_matches(low, HEADER_KEYWORDS["ministry1"]):
            h["ministry1"] = line
        elif not h["ministry2"] and _line_matches(low, HEADER_KEYWORDS["ministry2"]):
            h["ministry2"] = line
        elif not h["instituteName"] and _line_matches(low, HEADER_KEYWORDS["instituteName"]) and not is_ministry:
            h["instituteName"] = line

        m = re.search(r"(\d{7,8})\s*[-\u2013]\s*(\S+)", line)
        if m:
            h["directionCode"] = m.group(1)
            h["directionName"] = m.group(2)

    return h


SERIAL_RE = re.compile(r"^[I\d]+[.\s]+\d+\.?$|^\d+\.\d+\.?$")
CODE_RE = re.compile(r"^[A-ZА-Я0-9]{2,}[A-ZА-Я\d/'()]+$|^[A-ZА-Я]{2,}\d+")
BLOCK_HEADER_RE = re.compile(r"^(\d+)\.0+\s*\|?\s*(.+)")

BLOCK_PATTERNS_FALLBACK = [
    re.compile(r"^(\d+)\.0+\s+([A-ZА-Яa-zа-я].+)"),
    re.compile(r"^(?:Blok|Блок|Block|BLOK)\s*[-№]?\s*(\d+)[:\-\.\s]+(.+)", re.I),
    re.compile(r"^(\d+)\s*[-–]\s*modul[:\s]+(.+)", re.I),
    re.compile(r"^(?:Modul|Module)\s*(\d+)[:\-\.\s]+(.+)", re.I),
]


def _match_block_header(line):
    m = BLOCK_HEADER_RE.match(line)
    if m and "|" in line:
        return m
    for pat in BLOCK_PATTERNS_FALLBACK:
        m2 = pat.match(line)
        if m2:
            return m2
    return None


def _detect_load_cols(pages):
    from collections import Counter
    fan_re = re.compile(r"^\d+[.\s]+\d+\.?\s+(.+)")
    counts = []
    for page in pages[:3]:
        try:
            text = page.extract_text() or ""
        except Exception:
            continue
        for line in text.split("\n"):
            m = fan_re.match(line.strip())
            if not m:
                continue
            _, nums = extract_numbers_from_end(m.group(1))
            if len(nums) < 4:
                continue
            load = 0
            for n in nums:
                if n >= 20:
                    load += 1
                else:
                    break
            if load >= 2:
                counts.append(load)
    if not counts:
        return None
    most_common, freq = Counter(counts).most_common(1)[0]
    return most_common if freq >= 3 else None


TOTAL_ROW_KEYWORDS = ("hammasi", "jami", "total", "all", "sum", "всего", "итого", "ҳаммаси", "жами")
ALL_ROW_KEYWORDS = ("hammasi", "all", "всего", "ҳаммаси")
COURSE_WORDS = ("kurs", "course", "year", "курс", "yil")


def _is_total_row(low, is_all_variant=False):
    keywords = ALL_ROW_KEYWORDS if is_all_variant else TOTAL_ROW_KEYWORDS
    for kw in keywords:
        if low.startswith(kw + " ") or low == kw or low.startswith(kw + ":"):
            return True
    return False


COURSE_PRACTICE_RE = re.compile(
    r"^(\d+)[\s\-]*(?:" + "|".join(COURSE_WORDS) + r")\s+(.+?)\s+(\d[\d\s]+)$",
    re.IGNORECASE,
)


def parse_subjects_pages(pages, load_cols=None):
    blocks = []
    current_block = None
    jami_nums = []
    hammasi_nums = []
    amaliyotlar = []
    pending_title = ""

    for page in pages:
        text = page.extract_text() or ""
        for raw_line in text.split("\n"):
            line = raw_line.strip()
            if not line:
                continue

            low = line.lower()

            if _is_total_row(low, is_all_variant=True):
                _, nums = extract_numbers_from_end(line)
                hammasi_nums = nums
                continue

            if _is_total_row(low, is_all_variant=False):
                _, nums = extract_numbers_from_end(line)
                jami_nums = nums
                continue

            m_am = COURSE_PRACTICE_RE.match(line)
            if m_am:
                nums = [int(x) for x in m_am.group(3).split() if x.isdigit()]
                amaliyotlar.append({"course": m_am.group(1), "title": m_am.group(2), "numbers": nums})
                continue

            bm = _match_block_header(line)
            if bm:
                title_part, nums = extract_numbers_from_end(bm.group(2).replace("|","").strip())
                p, kred, tc = make_particle(nums, load_cols)
                current_block = {
                    "blockCode": f"BLK{bm.group(1)}",
                    "serialNumber": f"{bm.group(1)}.00",
                    "title": title_part,
                    "particle": p,
                    "semesters": make_semesters(kred),
                    "totalCredit": tc,
                    "sciences": [],
                }
                blocks.append(current_block)
                continue

            m_fan = re.match(r"^(\d+)[.\s]+(\d+)\.?\s+(.+)", line)
            if m_fan:
                block_num = m_fan.group(1)
                fan_num = m_fan.group(2)
                rest = m_fan.group(3)

                title_part, nums = extract_numbers_from_end(rest)

                if not nums:
                    pending_title = f"{block_num}.{fan_num} {title_part}"
                    continue

                words = title_part.split()
                code = ""
                title = title_part

                if words and re.match(r"^[A-ZА-Я0-9/'()]+$", words[0]) and len(words[0]) >= 2:
                    code = words[0]
                    if len(words) > 1 and re.match(r"^\d{3,}$", words[1]):
                        code = f"{words[0]} {words[1]}"
                        title = " ".join(words[2:])
                    else:
                        title = " ".join(words[1:])

                if not current_block or not current_block["serialNumber"].startswith(f"{block_num}."):
                    current_block = {
                        "blockCode": f"BLK{block_num}",
                        "serialNumber": f"{block_num}.00",
                        "title": "",
                        "particle": [],
                        "semesters": {},
                        "totalCredit": 0,
                        "sciences": [],
                    }
                    blocks.append(current_block)

                p, kred, tc = make_particle(nums, load_cols)

                if pending_title:
                    title = pending_title + " " + title
                    pending_title = ""

                current_block["sciences"].append({
                    "serialNumber": f"{block_num}.{fan_num}",
                    "code": code,
                    "title": title.strip(),
                    "particle": p,
                    "semesters": make_semesters(kred),
                    "totalCredit": tc,
                })
                continue

            if pending_title:
                title_part, nums = extract_numbers_from_end(line)
                if nums and current_block:
                    full_title = pending_title + " " + title_part
                    parts = full_title.split(None, 1)
                    serial = parts[0] if len(parts) > 0 else ""
                    rest_title = parts[1] if len(parts) > 1 else ""

                    rwords = rest_title.split()
                    code = ""
                    title = rest_title
                    if rwords and re.match(r"^[A-ZА-Я0-9/'()]+$", rwords[0]):
                        code = rwords[0]
                        title = " ".join(rwords[1:])

                    p, kred, tc = make_particle(nums, load_cols)
                    current_block["sciences"].append({
                        "serialNumber": serial,
                        "code": code,
                        "title": title.strip(),
                        "particle": p,
                        "semesters": make_semesters(kred),
                        "totalCredit": tc,
                    })
                pending_title = ""
                continue

            if current_block and line and not line[0].isdigit():
                title_part, nums = extract_numbers_from_end(line)
                if len(nums) >= 4 and any(n >= 20 for n in nums[:2]):
                    p, kred, tc = make_particle(nums, load_cols)
                    current_block["sciences"].append({
                        "serialNumber": "",
                        "code": "",
                        "title": title_part.strip(),
                        "particle": p,
                        "semesters": make_semesters(kred),
                        "totalCredit": tc,
                    })

    for block in blocks:
        if block["sciences"]:
            slug_sums = {}
            slug_titles = {}
            slug_order = []
            for s in block["sciences"]:
                for item in (s.get("particle") or []):
                    slug = item.get("slug")
                    if not slug:
                        continue
                    if slug not in slug_sums:
                        slug_sums[slug] = 0
                        slug_titles[slug] = item.get("title", "")
                        slug_order.append(slug)
                    slug_sums[slug] += int(item.get("value") or 0)
            block["particle"] = [
                {"slug": s, "title": slug_titles[s], "value": slug_sums[s]}
                for s in slug_order
            ]
            block["totalCredit"] = sum(s["totalCredit"] for s in block["sciences"])
            all_sems = set()
            for s in block["sciences"]:
                all_sems.update(s["semesters"].keys())
            for sem in all_sems:
                h = sum(s["semesters"].get(sem, {}).get("hour", 0) for s in block["sciences"])
                c = sum(s["semesters"].get(sem, {}).get("credit", 0) for s in block["sciences"])
                block["semesters"][sem] = {"hour": h, "credit": c}

    return blocks, jami_nums, amaliyotlar, hammasi_nums


def _title_to_key(title, legend_titles=None):
    if not title:
        return " "
    if legend_titles:
        key = _match_legend_key(title, legend_titles)
        if key:
            return key
    return " "


def parse_footer(page, legend_titles=None):
    text = page.extract_text() or ""
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    comments = []
    lp_keys = []
    signatures = []
    section = None

    for line in lines:
        low = line.lower()

        if re.match(r"^(izoh|note|прим|comment)[:\.\s]", low):
            section = "comments"; continue

        if section == "comments":
            m = re.match(r"^(\d+)\.\s+(.+)", line)
            if m:
                comments.append(m.group(2)); continue
            if any(w in low for w in ("tarkib", "structural", "part ")):
                section = "lp_keys"; continue

        if any(w in low for w in ("tarkib", "structural")):
            section = "lp_keys"; continue

        if section == "lp_keys":
            m = re.match(r"^(.+?)\s+(\d+)\s+([\d,.\-]+)\s*$", line)
            if m:
                title = m.group(1).strip()
                key = _title_to_key(title, legend_titles)
                lp_keys.append({"key":key, "title":title, "week":int(m.group(2)), "semester":m.group(3)})
                continue
            m2 = re.match(r"^(JAMI|TOTAL|ИТОГО|ВСЕГО)\s+(\d+)", line, re.I)
            if m2:
                lp_keys.append({"key":" ", "title":m2.group(1).upper(), "week":int(m2.group(2)), "semester":"0"})
                section = "signatures"; continue

        if section == "signatures":
            m = re.match(r"^(.+?)\s{2,}(.+)$", line)
            if m and len(m.group(1)) > 5 and len(m.group(2)) > 2:
                signatures.append({"role": m.group(1).strip(), "name": m.group(2).strip()})

    return comments, lp_keys, signatures


def build_meta(blocks, jami_nums, hammasi_nums):
    max_sems = max((len(s["semesters"]) for b in blocks for s in b["sciences"]), default=0)
    kurs_count = (max_sems + 1) // 2 if max_sems else 0
    courses = [str(i + 1) for i in range(kurs_count)]

    particles_items = []
    for b in blocks:
        for s in b.get("sciences") or []:
            for it in (s.get("particle") or []):
                if it.get("slug"):
                    particles_items.append({"slug": it["slug"], "title": it.get("title", "")})
            if particles_items:
                break
        if particles_items:
            break

    return {
        "serialNumber": "",
        "code": "",
        "title": "",
        "particles": {
            "title": "",
            "items": particles_items,
        },
        "distribution": {
            "title":    "",
            "courses":  courses,
            "weekly":   [30] * kurs_count,
            "semester": list(range(1, max_sems + 1)),
            "audience": [30] * max_sems,
        },
        "credit": {
            "title":    "",
            "courses":  courses,
            "weekly":   [30] * kurs_count,
            "semester": list(range(1, max_sems + 1)),
            "distribution": hammasi_nums[-max_sems:] if hammasi_nums else [],
        },
        "totalCredit": str(sum(b["totalCredit"] for b in blocks)),
    }


def is_scanned_pdf(pdf):
    for i in range(min(2, len(pdf.pages))):
        text = pdf.pages[i].extract_text() or ""
        if len(text.strip()) > 50:
            return False
    return True


def ocr_pdf_to_text_pages(pdf_path):
    if not HAS_OCR:
        raise RuntimeError(
            "Skan qilingan PDF uchun OCR kerak. "
            "O'rnating: pip install pytesseract PyMuPDF Pillow"
        )

    doc = pymupdf.open(pdf_path)
    text_pages = []
    lang = _detect_ocr_langs()

    for i in range(doc.page_count):
        page = doc[i]
        pix = page.get_pixmap(matrix=pymupdf.Matrix(3, 3))
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

        text = pytesseract.image_to_string(img, lang=lang, config="--psm 6")
        text_pages.append(text)

    doc.close()
    return text_pages


class OcrPage:
    def __init__(self, text):
        self._text = text

    def extract_text(self):
        return self._text

    def extract_words(self, **kwargs):
        return []


def parse_pdf(pdf_path):
    pdf = pdfplumber.open(pdf_path)

    if is_scanned_pdf(pdf):
        print("Skan PDF aniqlandi — OCR ishlatilmoqda...", file=sys.stderr)
        pdf.close()
        text_pages = ocr_pdf_to_text_pages(pdf_path)
        pages = [OcrPage(t) for t in text_pages]
    else:
        pages = pdf.pages

    header = parse_header(pages[0])

    try:
        legend = parse_legend(pages[0])
    except Exception:
        legend = {}

    if legend:
        key_titles = dict(legend)
        valid_keys = "".join(
            sorted({k.upper() for k in legend if isinstance(k, str) and len(k) == 1 and k.isalpha()})
        ) or DEFAULT_VALID_KEYS
        if " " not in key_titles:
            key_titles[" "] = ""
            print(
                "WARN: legendadan bo'sh kalit (' ') uchun title topilmadi — bo'sh qoldirildi",
                file=sys.stderr,
            )
    else:
        source = "KEY_TITLES_JSON env" if DEFAULT_KEY_TITLES else "bo'sh (titles yo'q)"
        print(
            f"WARN: legend topilmadi — kalit titles manba: {source}. "
            "Agar custom titles kerak bo'lsa, KEY_TITLES_JSON env var orqali sozlang.",
            file=sys.stderr,
        )
        key_titles = dict(DEFAULT_KEY_TITLES)
        valid_keys = DEFAULT_VALID_KEYS

    calendar_courses, calendar_allValues, calendar_keys = parse_calendar(
        pages[0], valid_keys=valid_keys, key_titles=key_titles
    )

    try:
        load_cols = _detect_load_cols(pages[1:])
    except Exception:
        load_cols = None

    blocks, jami_nums, amaliyotlar, hammasi_nums = parse_subjects_pages(pages[1:], load_cols=load_cols)
    comments, lp_keys, signatures = parse_footer(pages[-1], legend_titles=key_titles)
    meta = build_meta(blocks, jami_nums, hammasi_nums)

    if hasattr(pdf, 'close'):
        try: pdf.close()
        except: pass

    return {
        "meta": meta, "blocks": blocks, "header": header,
        "courses": calendar_courses, "allValues": calendar_allValues,
        "keys": calendar_keys,
        "learningProcessKeys": lp_keys, "comments": comments,
        "signatures": signatures, "amaliyotlar": amaliyotlar,
    }


def main():
    if sys.platform == "win32":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    ap = argparse.ArgumentParser()
    ap.add_argument("pdf_path")
    ap.add_argument("--stdout", action="store_true")
    ap.add_argument("-o", "--output")
    args = ap.parse_args()
    if not os.path.exists(args.pdf_path):
        print(f"Fayl topilmadi: {args.pdf_path}", file=sys.stderr); sys.exit(1)
    result = parse_pdf(args.pdf_path)
    out = json.dumps(result, ensure_ascii=False, indent=2)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f: f.write(out)
    else:
        sys.stdout.buffer.write(out.encode("utf-8"))
        sys.stdout.buffer.write(b"\n")

if __name__ == "__main__":
    main()
