import os
import re
import json

BASE_DIR = r"c:\Users\USER\Downloads\청상1급_Gemini"
OUT_DIR = os.path.join(BASE_DIR, "exam", "data")
os.makedirs(OUT_DIR, exist_ok=True)

subjects_info = [
    {"id": 1, "session": 1, "name": "상담사 교육 및 사례지도", "start": 1, "end": 25},
    {"id": 2, "session": 1, "name": "청소년 관련 법과 행정", "start": 26, "end": 50},
    {"id": 3, "session": 1, "name": "상담연구방법론의 실제", "start": 51, "end": 75},
    {"id": 4, "session": 2, "name": "비행상담", "start": 76, "end": 100},
    {"id": 5, "session": 2, "name": "성상담", "start": 101, "end": 125},
    {"id": 6, "session": 2, "name": "약물상담", "start": 126, "end": 150},
    {"id": 7, "session": 2, "name": "위기상담", "start": 151, "end": 175},
]

circ_to_num = {'①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5}

def get_subject_info(q_num):
    for s in subjects_info:
        if s["start"] <= q_num <= s["end"]:
            return s
    return subjects_info[0]

def extract_options_and_stem(q_text):
    opt_matches = list(re.finditer(r"(?:^|\n)\s*([①②③④⑤])\s*(.*?)(?=(?:\n\s*[①②③④⑤]|\Z))", q_text, re.DOTALL))
    if len(opt_matches) == 5:
        stem = q_text[:opt_matches[0].start()].strip()
        options = [m.group(2).strip() for m in opt_matches]
        return stem, options
    
    opt_matches2 = list(re.finditer(r"([①②③④⑤])\s*([^\n①②③④⑤]+)", q_text))
    if len(opt_matches2) == 5:
        stem = q_text[:opt_matches2[0].start()].strip()
        options = [m.group(2).strip() for m in opt_matches2]
        return stem, options
    
    return q_text.strip(), []

# ==============================================================================
# PARSE ROUND 1
# ==============================================================================
def parse_round_1():
    md_path = os.path.join(BASE_DIR, "2026년_예상문제", "04_실전모의고사_통합본", "2026년_청소년상담사1급_실전모의고사_정답및해설집_통합본.md")
    with open(md_path, 'r', encoding='utf-8') as f:
        text = f.read()

    header_pattern = r"(?:^|\n)##\s*\[문항\s*(\d+)\]\s*([^\n]+)"
    splits = list(re.finditer(header_pattern, text))

    questions = []

    for idx, match in enumerate(splits):
        q_num = int(match.group(1))
        start_pos = match.start()
        end_pos = splits[idx+1].start() if idx+1 < len(splits) else len(text)
        block = text[start_pos:end_pos].strip()
        
        s_info = get_subject_info(q_num)
        
        diff = "중상"
        cog = "적용"
        dom = s_info["name"]
        
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

        ans_num = 0
        ans_m = re.search(r"(?:-\s*)?\*?\*?정답[:\s\*]*([①②③④⑤12345])", block)
        if ans_m:
            ans_num = circ_to_num.get(ans_m.group(1), 0)

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

        ans_anchor = re.search(r"(?:-\s*)?\*?\*?정답[:\s\*]*[①②③④⑤12345]", block)
        ans_start_idx = ans_anchor.start() if ans_anchor else len(block)
        
        raw_q_area = block[:ans_start_idx].strip()
        raw_q_area = re.sub(r"^##\s*\[문항\s*\d+\][^\n]*\n?", "", raw_q_area).strip()
        raw_q_area = re.sub(r"^-\s*\*\*(?:영역/난이도|영역|난이도|인지수준|난도|출제위원|문항 ID|형식|과목)[^\n]*\n?", "", raw_q_area, flags=re.MULTILINE).strip()
        raw_q_area = re.sub(r"^-\s*(?:문항 ID|과목|주 자극|인지수준|공식범위|출제기준일)[^\n]*\n?", "", raw_q_area, flags=re.MULTILINE).strip()
        raw_q_area = re.sub(r"^\*\*난도[^\n]*\n?", "", raw_q_area, flags=re.MULTILINE).strip()
        raw_q_area = re.sub(r"^\*\*영역[^\n]*\n?", "", raw_q_area, flags=re.MULTILINE).strip()
        raw_q_area = re.sub(r"^\*\*인지[^\n]*\n?", "", raw_q_area, flags=re.MULTILINE).strip()
        raw_q_area = re.sub(r"^###\s*(?:문항|문제)\s*\n?", "", raw_q_area, flags=re.MULTILINE).strip()
        raw_q_area = re.sub(r"^-{3,}\s*\n?", "", raw_q_area, flags=re.MULTILINE).strip()

        stem, options = extract_options_and_stem(raw_q_area)
        stem = re.sub(r"^###\s*(?:문항|문제)\s*\n?", "", stem).strip()
        stem = re.sub(r"^-\s*\*\*[^\n]+\n?", "", stem).strip()
        stem = stem.strip()

        q_obj = {
            "id": q_num,
            "uniqueId": f"r1_q{q_num}",
            "round": 1,
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

    return questions

# ==============================================================================
# PARSE ROUND 2
# ==============================================================================
def parse_round_2():
    round2_dir = os.path.join(BASE_DIR, "2026년_예상문제_2")

    # Import parser functions from parse_exam2
    from parse_exam2 import parsers, subjects as r2_subjects

    questions = []
    for s in r2_subjects:
        path = os.path.join(round2_dir, s["file"])
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        s_questions = parsers[s["id"]](content)
        for q in s_questions:
            global_q_num = s["start"] + q["subject_q_num"] - 1
            q_obj = {
                "id": global_q_num,
                "uniqueId": f"r2_q{global_q_num}",
                "round": 2,
                "session": s["session"],
                "session_q_num": global_q_num if s["session"] == 1 else (global_q_num - 75),
                "subject_id": s["id"],
                "subject_name": s["name"],
                "subject_q_num": q["subject_q_num"],
                "difficulty": q.get("difficulty", "중상"),
                "cognitive": q.get("cognitive", "적용"),
                "domain": q.get("domain", s["name"]),
                "stem": q["stem"],
                "options": q["options"],
                "answer": q["answer"],
                "explanation": q["explanation"],
                "distractor_exp": q["distractor_exp"],
                "citation": q["citation"],
                "safety": ""
            }
            questions.append(q_obj)

    return questions

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================
print("Parsing Round 1...")
r1_questions = parse_round_1()
print(f"Round 1 parsed: {len(r1_questions)} questions.")

print("Parsing Round 2...")
r2_questions = parse_round_2()
print(f"Round 2 parsed: {len(r2_questions)} questions.")

# Metadata for rounds
exam_rounds = [
    {
        "id": 1,
        "round": 1,
        "title": "제1회 실전 모의고사 (2026년 대비)",
        "badge": "제1회",
        "badgeClass": "badge-primary",
        "subtitle": "2017~2025년 기출 및 출처분석 기반 실전 모의고사",
        "description": "총 175문항 (1교시 75문항 + 2교시 100문항), 최신 출제경향 완벽 반영",
        "totalQuestions": 175,
        "date": "2026-08",
        "isAvailable": True
    },
    {
        "id": 2,
        "round": 2,
        "title": "제2회 실전 모의고사 (2026년 대비)",
        "badge": "제2회 (NEW)",
        "badgeClass": "badge-accent",
        "subtitle": "2026년 최신 개정 법령 & DSM-5-TR 및 독립 출제·검수 2차 실전 모의고사",
        "description": "총 175문항 (1교시 75문항 + 2교시 100문항), 고난도 앵커 및 전 문항 오답반증 완비",
        "totalQuestions": 175,
        "date": "2026-08-28",
        "isAvailable": True
    }
]

mock_exams_data = {
    "1": r1_questions,
    "2": r2_questions
}

# 1. Save JSON files
with open(os.path.join(OUT_DIR, "mock_exams.json"), 'w', encoding='utf-8') as f:
    json.dump({
        "rounds": exam_rounds,
        "subjects": subjects_info,
        "exams": mock_exams_data
    }, f, ensure_ascii=False, indent=2)

with open(os.path.join(OUT_DIR, "questions_1.json"), 'w', encoding='utf-8') as f:
    json.dump(r1_questions, f, ensure_ascii=False, indent=2)

with open(os.path.join(OUT_DIR, "questions_2.json"), 'w', encoding='utf-8') as f:
    json.dump(r2_questions, f, ensure_ascii=False, indent=2)

# 2. Save Unified JS File for zero-latency client-side execution
js_path = os.path.join(OUT_DIR, "mock_exams.js")
with open(js_path, 'w', encoding='utf-8') as f:
    f.write("// 2026 청소년상담사 1급 실전 모의고사 다회차(Multi-Round) 통합 데이터셋\n")
    f.write("window.MOCK_EXAM_ROUNDS = ")
    json.dump(exam_rounds, f, ensure_ascii=False, indent=2)
    f.write(";\n\n")
    
    f.write("window.EXAM_SUBJECTS = ")
    json.dump(subjects_info, f, ensure_ascii=False, indent=2)
    f.write(";\n\n")
    
    f.write("window.MOCK_EXAMS_DATA = ")
    json.dump(mock_exams_data, f, ensure_ascii=False, indent=2)
    f.write(";\n\n")
    
    # Backward compatibility: default EXAM_QUESTIONS to Round 1 or active
    f.write("// 기본 호환성 유지용 (Default EXAM_QUESTIONS = Round 1)\n")
    f.write("window.EXAM_QUESTIONS = window.MOCK_EXAMS_DATA['1'];\n")

print(f"Successfully generated all datasets in {OUT_DIR}!")
