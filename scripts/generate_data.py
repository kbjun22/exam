import re
import json
import os

md_path = r"c:\Users\USER\Downloads\청상1급_Gemini\2026년_예상문제\04_실전모의고사_통합본\2026년_청소년상담사1급_실전모의고사_정답및해설집_통합본.md"
out_dir = r"c:\Users\USER\Downloads\청상1급_Gemini\exam\data"
os.makedirs(out_dir, exist_ok=True)

with open(md_path, 'r', encoding='utf-8') as f:
    text = f.read()

subjects = [
    {"id": 1, "session": 1, "name": "상담사 교육 및 사례지도", "start": 1, "end": 25},
    {"id": 2, "session": 1, "name": "청소년 관련 법과 행정", "start": 26, "end": 50},
    {"id": 3, "session": 1, "name": "상담연구방법론의 실제", "start": 51, "end": 75},
    {"id": 4, "session": 2, "name": "비행상담", "start": 76, "end": 100},
    {"id": 5, "session": 2, "name": "성상담", "start": 101, "end": 125},
    {"id": 6, "session": 2, "name": "약물상담", "start": 126, "end": 150},
    {"id": 7, "session": 2, "name": "위기상담", "start": 151, "end": 175},
]

def get_subject_info(q_num):
    for s in subjects:
        if s["start"] <= q_num <= s["end"]:
            return s
    return subjects[0]

header_pattern = r"(?:^|\n)##\s*\[문항\s*(\d+)\]\s*([^\n]+)"
splits = list(re.finditer(header_pattern, text))

circ_to_num = {'①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5}

questions = []

for idx, match in enumerate(splits):
    q_num = int(match.group(1))
    raw_title = match.group(2).strip()
    
    start_pos = match.start()
    end_pos = splits[idx+1].start() if idx+1 < len(splits) else len(text)
    block = text[start_pos:end_pos].strip()
    
    s_info = get_subject_info(q_num)
    
    # 1. Extract metadata
    diff = ""
    cog = ""
    dom = ""
    
    m_combo = re.search(r"\*\*난도[/\s]*인지(?:수준)?[/\s]*영역\*\*\s*:\s*([^/\n]+)\s*/\s*([^/\n]+)\s*/\s*([^\n]+)", block)
    if m_combo:
        diff = m_combo.group(1).strip()
        cog = m_combo.group(2).strip()
        dom = m_combo.group(3).strip()
    else:
        m_diff = re.search(r"난도:?\s*\*?\*?\s*([^\n\*]+)", block)
        if m_diff: diff = m_diff.group(1).strip()
        m_cog = re.search(r"인지(?:수준)?:?\s*\*?\*?\s*([^\n\*]+)", block)
        if m_cog: cog = m_cog.group(1).strip()
        m_dom = re.search(r"영역:?\s*\*?\*?\s*([^\n\*]+)", block)
        if m_dom: dom = m_dom.group(1).strip()

    # 2. Extract Answer
    ans_num = 0
    ans_m = re.search(r"(?:-\s*)?\*?\*?정답[:\s\*]*([①②③④⑤12345])", block)
    if ans_m:
        ans_num = circ_to_num.get(ans_m.group(1), 0)

    # 3. Find boundaries for explanation sections
    exp_text = ""
    distractor_text = ""
    citation_text = ""
    safety_text = ""
    
    sec_exp = re.search(r"(?:###|\*\*|-\s*\*?)\s*정답\s*해설(?:\*\*)?:?\s*\n*(.*?)(?=(?:###|\*\*|-\s*\*?)\s*오답\s*반증|(?:###|\*\*|-\s*\*?)\s*직접\s*(?:출처|근거)|(?:###|\*\*|-\s*\*?)\s*계산|(?:###|\*\*|-\s*\*?)\s*안전|\Z)", block, re.DOTALL)
    if sec_exp:
        exp_text = sec_exp.group(1).strip()
        
    sec_dist = re.search(r"(?:###|\*\*|-\s*\*?)\s*오답\s*반증(?:\*\*)?:?\s*\n*(.*?)(?=(?:###|\*\*|-\s*\*?)\s*직접\s*(?:출처|근거)|(?:###|\*\*|-\s*\*?)\s*계산|(?:###|\*\*|-\s*\*?)\s*안전|\Z)", block, re.DOTALL)
    if sec_dist:
        distractor_text = sec_dist.group(1).strip()
        
    sec_cit = re.search(r"(?:###|\*\*|-\s*\*?)\s*직접\s*(?:출처|근거)(?:\*\*)?:?\s*\n*(.*?)(?=(?:###|\*\*|-\s*\*?)\s*계산|(?:###|\*\*|-\s*\*?)\s*안전|\Z)", block, re.DOTALL)
    if sec_cit:
        citation_text = sec_cit.group(1).strip()
        
    sec_safe = re.search(r"(?:###|\*\*|-\s*\*?)\s*안전[·\s]*윤리(?:[·\s]*편향)?\s*검토(?:\*\*)?:?\s*\n*(.*?)(?=(?:\n---|\Z))", block, re.DOTALL)
    if sec_safe:
        safety_text = sec_safe.group(1).strip()

    # 4. Extract Question Stem and Options
    ans_anchor = re.search(r"(?:-\s*)?\*?\*?정답[:\s\*]*[①②③④⑤12345]", block)
    ans_start_idx = ans_anchor.start() if ans_anchor else len(block)
    
    # Question area is between header and answer
    raw_q_area = block[:ans_start_idx].strip()

    # Strip header line: ## [문항 X] ...
    raw_q_area = re.sub(r"^##\s*\[문항\s*\d+\][^\n]*\n?", "", raw_q_area).strip()

    # Strip all metadata lines
    raw_q_area = re.sub(r"^-\s*\*\*(?:영역/난이도|영역|난이도|인지수준|난도|출제위원|문항 ID|형식|과목)[^\n]*\n?", "", raw_q_area, flags=re.MULTILINE).strip()
    raw_q_area = re.sub(r"^-\s*(?:문항 ID|과목|주 자극|인지수준|공식범위|출제기준일)[^\n]*\n?", "", raw_q_area, flags=re.MULTILINE).strip()
    raw_q_area = re.sub(r"^\*\*난도[^\n]*\n?", "", raw_q_area, flags=re.MULTILINE).strip()
    raw_q_area = re.sub(r"^\*\*영역[^\n]*\n?", "", raw_q_area, flags=re.MULTILINE).strip()
    raw_q_area = re.sub(r"^\*\*인지[^\n]*\n?", "", raw_q_area, flags=re.MULTILINE).strip()

    # Strip "### 문항" and "### 문제" markers completely
    raw_q_area = re.sub(r"^###\s*(?:문항|문제)\s*\n?", "", raw_q_area, flags=re.MULTILINE).strip()

    # Strip leading/trailing horizontal rules (---)
    raw_q_area = re.sub(r"^-{3,}\s*\n?", "", raw_q_area, flags=re.MULTILINE).strip()

    # Extract 5 options from raw_q_area
    opt_matches = list(re.finditer(r"(?:^|\n)\s*([①②③④⑤])\s*(.*?)(?=(?:\n\s*[①②③④⑤]|\Z))", raw_q_area, re.DOTALL))
    options = []
    stem = raw_q_area
    if len(opt_matches) == 5:
        stem = raw_q_area[:opt_matches[0].start()].strip()
        for om in opt_matches:
            options.append(om.group(2).strip())
    elif len(opt_matches) > 0:
        opt_matches2 = list(re.finditer(r"([①②③④⑤])\s*([^\n①②③④⑤]+(?:\n(?![①②③④⑤]|-)[^\n①②③④⑤]+)*)", raw_q_area))
        if len(opt_matches2) == 5:
            stem = raw_q_area[:opt_matches2[0].start()].strip()
            for om in opt_matches2:
                options.append(om.group(2).strip())

    # Final cleanup of stem
    stem = re.sub(r"^###\s*(?:문항|문제)\s*\n?", "", stem).strip()
    stem = re.sub(r"^-\s*\*\*[^\n]+\n?", "", stem).strip()
    stem = stem.strip()

    q_obj = {
        "id": q_num,
        "session": s_info["session"],
        "session_q_num": q_num if s_info["session"] == 1 else (q_num - 75),
        "subject_id": s_info["id"],
        "subject_name": s_info["name"],
        "subject_q_num": q_num - s_info["start"] + 1,
        "difficulty": diff,
        "cognitive": cog,
        "domain": dom,
        "stem": stem,
        "options": options,
        "answer": ans_num,
        "explanation": exp_text,
        "distractor_exp": distractor_text,
        "citation": citation_text,
        "safety": safety_text
    }
    questions.append(q_obj)

# Save JSON
json_path = os.path.join(out_dir, "questions.json")
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(questions, f, ensure_ascii=False, indent=2)

# Save JS
js_path = os.path.join(out_dir, "questions.js")
with open(js_path, 'w', encoding='utf-8') as f:
    f.write("// 2026년 청소년상담사 1급 실전 모의고사 전체 175문항 데이터셋\n")
    f.write("window.EXAM_QUESTIONS = ")
    json.dump(questions, f, ensure_ascii=False, indent=2)
    f.write(";\n")
    f.write("window.EXAM_SUBJECTS = ")
    json.dump(subjects, f, ensure_ascii=False, indent=2)
    f.write(";\n")

print(f"Successfully generated {len(questions)} clean questions in {out_dir}")
