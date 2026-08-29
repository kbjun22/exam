import os
import re
import json

BASE_DIR = r"c:\Users\USER\Downloads\청상1급_Gemini\2026년_예상문제_2"

subjects = [
    {"id": 1, "session": 1, "name": "상담사 교육 및 사례지도", "file": "01_상담사교육및사례지도_최종25문항.md", "start": 1, "end": 25},
    {"id": 2, "session": 1, "name": "청소년 관련 법과 행정", "file": "02_청소년관련법과행정_최종25문항.md", "start": 26, "end": 50},
    {"id": 3, "session": 1, "name": "상담연구방법론의 실제", "file": "03_상담연구방법론의실제_최종25문항.md", "start": 51, "end": 75},
    {"id": 4, "session": 2, "name": "비행상담", "file": "04_비행상담_최종25문항.md", "start": 76, "end": 100},
    {"id": 5, "session": 2, "name": "성상담", "file": "05_성상담_최종25문항.md", "start": 101, "end": 125},
    {"id": 6, "session": 2, "name": "약물상담", "file": "06_약물상담_최종25문항.md", "start": 126, "end": 150},
    {"id": 7, "session": 2, "name": "위기상담", "file": "07_위기상담_최종25문항.md", "start": 151, "end": 175},
]

circ_to_num = {'①': 1, '②': 2, '③': 3, '④': 4, '⑤': 5, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5}

def extract_options_and_stem(q_text):
    # Match ①~⑤
    # Find all ①, ②, ③, ④, ⑤
    opt_matches = list(re.finditer(r"(?:^|\n)\s*([①②③④⑤])\s*(.*?)(?=(?:\n\s*[①②③④⑤]|\Z))", q_text, re.DOTALL))
    if len(opt_matches) == 5:
        stem = q_text[:opt_matches[0].start()].strip()
        options = [m.group(2).strip() for m in opt_matches]
        return stem, options
    
    # Try inline options (e.g. ① ... ② ... ③ ... ④ ... ⑤ ...)
    opt_matches2 = list(re.finditer(r"([①②③④⑤])\s*([^\n①②③④⑤]+)", q_text))
    if len(opt_matches2) == 5:
        stem = q_text[:opt_matches2[0].start()].strip()
        options = [m.group(2).strip() for m in opt_matches2]
        return stem, options
    
    # Fallback
    return q_text.strip(), []

def parse_subject_1(content):
    # 01_상담사교육및사례지도_최종25문항.md
    # Questions are in ## 문제지 -> ### 1. ~ ### 25.
    # Answers in ## 정답표
    # Explanations in ## 상세해설·오답 반증·직접출처 -> ### 1번 ~ ### 25번
    
    # 1. Parse answers
    ans_map = {}
    table_m = re.search(r"##\s*정답표.*?(?=##|\Z)", content, re.DOTALL)
    if table_m:
        lines = table_m.group(0).split('\n')
        for i in range(len(lines) - 2):
            if '문항' in lines[i] and '정답' in lines[i+2]:
                q_cols = [c.strip() for c in lines[i].split('|')[1:-1] if c.strip()]
                a_cols = [c.strip() for c in lines[i+2].split('|')[1:-1] if c.strip()]
                for q_s, a_s in zip(q_cols, a_cols):
                    if q_s.isdigit() and a_s in circ_to_num:
                        ans_map[int(q_s)] = circ_to_num[a_s]
    
    # 2. Parse explanations
    exp_sec = ""
    exp_m = re.search(r"##\s*상세해설·오답 반증·직접출처.*?(?=##\s*부록|\Z)", content, re.DOTALL)
    if exp_m:
        exp_sec = exp_m.group(0)
    
    exp_splits = list(re.finditer(r"(?:^|\n)###\s*(\d+)번[^\n]*", exp_sec))
    exp_map = {}
    for idx, m in enumerate(exp_splits):
        q_num = int(m.group(1))
        start_p = m.end()
        end_p = exp_splits[idx+1].start() if idx+1 < len(exp_splits) else len(exp_sec)
        block = exp_sec[start_p:end_p].strip()
        
        # Split into main exp, distractor, citation
        exp_text = block
        distractor = ""
        citation = ""
        
        cit_m = re.search(r"\*\*직접출처:?\*\*\s*(.*)", block, re.DOTALL)
        if cit_m:
            citation = cit_m.group(1).strip()
            block_before_cit = block[:cit_m.start()].strip()
        else:
            block_before_cit = block
            
        dist_m = re.search(r"(?:^|\n)-\s*([①②③④⑤].*)", block_before_cit, re.DOTALL)
        if dist_m:
            exp_text = block_before_cit[:dist_m.start()].strip()
            distractor = dist_m.group(0).strip()
        else:
            exp_text = block_before_cit
            
        # Clean answer lead in exp_text: **정답 ④.** ...
        exp_text = re.sub(r"^\*\*정답\s*[①②③④⑤12345]\.\*\*\s*", "", exp_text).strip()
        
        exp_map[q_num] = {
            "explanation": exp_text,
            "distractor_exp": distractor,
            "citation": citation
        }
    
    # 3. Parse questions
    q_sec_m = re.search(r"##\s*문제지.*?(?=##\s*정답표|\Z)", content, re.DOTALL)
    q_sec = q_sec_m.group(0) if q_sec_m else content
    
    q_splits = list(re.finditer(r"(?:^|\n)###\s*(\d+)\.(?:[^\n]*)", q_sec))
    questions = []
    for idx, m in enumerate(q_splits):
        q_num = int(m.group(1))
        start_p = m.end()
        end_p = q_splits[idx+1].start() if idx+1 < len(q_splits) else len(q_sec)
        block = q_sec[start_p:end_p].strip()
        
        stem, options = extract_options_and_stem(block)
        
        e_info = exp_map.get(q_num, {"explanation": "", "distractor_exp": "", "citation": ""})
        questions.append({
            "subject_q_num": q_num,
            "stem": stem,
            "options": options,
            "answer": ans_map.get(q_num, 0),
            "explanation": e_info["explanation"],
            "distractor_exp": e_info["distractor_exp"],
            "citation": e_info["citation"],
            "domain": "상담사 교육 및 사례지도",
            "difficulty": "중상",
            "cognitive": "적용"
        })
    return questions

def parse_subject_2(content):
    # 02_청소년관련법과행정_최종25문항.md
    # Questions in ## 문제지 -> ### 1. ~ ### 25.
    # Answers in ## 정답표
    # Explanations in ## 정답 및 상세해설 -> ### 1. ... ~ ### 25. ...
    
    ans_map = {}
    table_m = re.search(r"##\s*정답표.*?(?=##|\Z)", content, re.DOTALL)
    if table_m:
        lines = table_m.group(0).split('\n')
        for i in range(len(lines) - 2):
            if '문항' in lines[i] and '정답' in lines[i+2]:
                q_cols = [c.strip() for c in lines[i].split('|')[1:-1] if c.strip()]
                a_cols = [c.strip() for c in lines[i+2].split('|')[1:-1] if c.strip()]
                for q_s, a_s in zip(q_cols, a_cols):
                    if q_s.isdigit() and a_s in circ_to_num:
                        ans_map[int(q_s)] = circ_to_num[a_s]
                        
    exp_sec = ""
    exp_m = re.search(r"##\s*정답 및 상세해설.*?(?=##\s*선정|\Z)", content, re.DOTALL)
    if exp_m:
        exp_sec = exp_m.group(0)
        
    exp_splits = list(re.finditer(r"(?:^|\n)###\s*(\d+)\.\s*([^\n]*)", exp_sec))
    exp_map = {}
    for idx, m in enumerate(exp_splits):
        q_num = int(m.group(1))
        title = m.group(2).strip()
        start_p = m.end()
        end_p = exp_splits[idx+1].start() if idx+1 < len(exp_splits) else len(exp_sec)
        block = exp_sec[start_p:end_p].strip()
        
        # Check distractor and citation
        distractor = ""
        citation = ""
        
        cit_m = re.search(r"(?:직접\s*근거|직접출처|출처):?\s*(.*)", block, re.DOTALL)
        if cit_m:
            citation = cit_m.group(1).strip()
            block_before_cit = block[:cit_m.start()].strip()
        else:
            block_before_cit = block
            
        dist_m = re.search(r"(?:오답\s*반증|오답\s*해설):?\s*\n*(.*?)(?=\Z)", block_before_cit, re.DOTALL)
        if dist_m:
            exp_text = block_before_cit[:dist_m.start()].strip()
            distractor = dist_m.group(1).strip()
        else:
            exp_text = block_before_cit
            
        exp_map[q_num] = {
            "title": title,
            "explanation": exp_text,
            "distractor_exp": distractor,
            "citation": citation
        }
        
    # Questions
    q_sec_m = re.search(r"##\s*문제지.*?(?=##\s*정답표|\Z)", content, re.DOTALL)
    q_sec = q_sec_m.group(0) if q_sec_m else content
    
    q_splits = list(re.finditer(r"(?:^|\n)###\s*(\d+)\.(?:[^\n]*)", q_sec))
    questions = []
    for idx, m in enumerate(q_splits):
        q_num = int(m.group(1))
        start_p = m.end()
        end_p = q_splits[idx+1].start() if idx+1 < len(q_splits) else len(q_sec)
        block = q_sec[start_p:end_p].strip()
        
        stem, options = extract_options_and_stem(block)
        e_info = exp_map.get(q_num, {"explanation": "", "distractor_exp": "", "citation": ""})
        questions.append({
            "subject_q_num": q_num,
            "stem": stem,
            "options": options,
            "answer": ans_map.get(q_num, 0),
            "explanation": e_info["explanation"],
            "distractor_exp": e_info["distractor_exp"],
            "citation": e_info["citation"],
            "domain": "청소년 관련 법과 행정",
            "difficulty": "중상",
            "cognitive": "적용"
        })
    return questions

def parse_subject_3(content):
    # 03_상담연구방법론의실제_최종25문항.md
    # Questions in ## Ⅰ. 문제지 -> ### 1. Title ~ ### 25. Title
    # Table in ## Ⅱ. 정답표
    # Explanations in ## Ⅲ. 정답·상세해설·오답반증·직접출처·계산검산 -> ### 1. Title ~ ### 25. Title
    
    # 1. Answers from vertical table in Ⅱ. 정답표
    # | 문항 | 정답 | 영역 | 응답구조 | 인지수준 | 난이도 |
    # | 1 | ① | ... |
    ans_map = {}
    meta_map = {}
    tbl_m = re.search(r"##\s*Ⅱ\.\s*정답표.*?(?=##|\Z)", content, re.DOTALL)
    if tbl_m:
        for line in tbl_m.group(0).split('\n'):
            parts = [p.strip() for p in line.split('|')[1:-1]]
            if len(parts) >= 2 and parts[0].isdigit() and parts[1] in circ_to_num:
                q_num = int(parts[0])
                ans_map[q_num] = circ_to_num[parts[1]]
                domain = parts[2] if len(parts) > 2 else ""
                cog = parts[4] if len(parts) > 4 else ""
                diff = parts[5] if len(parts) > 5 else ""
                meta_map[q_num] = {"domain": domain, "cognitive": cog, "difficulty": diff}
                
    # 2. Explanations in Ⅲ
    exp_sec = ""
    exp_m = re.search(r"##\s*Ⅲ\.\s*정답·상세해설.*?(?=##\s*Ⅳ|\Z)", content, re.DOTALL)
    if exp_m:
        exp_sec = exp_m.group(0)
        
    exp_splits = list(re.finditer(r"(?:^|\n)###\s*(\d+)\.\s*([^\n]*)", exp_sec))
    exp_map = {}
    for idx, m in enumerate(exp_splits):
        q_num = int(m.group(1))
        title = m.group(2).strip()
        start_p = m.end()
        end_p = exp_splits[idx+1].start() if idx+1 < len(exp_splits) else len(exp_sec)
        block = exp_sec[start_p:end_p].strip()
        
        # In subject 3, answer is also in: - **정답:** ①
        ans_m = re.search(r"-\s*\*\*정답:\*\*\s*([①②③④⑤12345])", block)
        if ans_m and q_num not in ans_map:
            ans_map[q_num] = circ_to_num[ans_m.group(1)]
            
        # Explanations has: **정답 해설**, **오답 반증**, **직접 출처 및 산식 근거**, **계산·가정 검산표**
        exp_text = ""
        distractor = ""
        citation = ""
        
        exp_match = re.search(r"\*\*정답\s*해설\*\*\s*\n*(.*?)(?=\*\*오답|\*\*직접|\*\*계산|\Z)", block, re.DOTALL)
        if exp_match:
            exp_text = exp_match.group(1).strip()
            
        dist_match = re.search(r"\*\*오답\s*반증\*\*\s*\n*(.*?)(?=\*\*직접|\*\*계산|\Z)", block, re.DOTALL)
        if dist_match:
            distractor = dist_match.group(1).strip()
            
        cit_match = re.search(r"\*\*직접\s*출처[^\*]*\*\*\s*\n*(.*?)(?=\*\*계산|\Z)", block, re.DOTALL)
        if cit_match:
            citation = cit_match.group(1).strip()
            
        calc_match = re.search(r"\*\*계산[^\*]*\*\*\s*\n*(.*?)(?=\Z)", block, re.DOTALL)
        if calc_match:
            citation += "\n\n[계산·가정 검산]\n" + calc_match.group(1).strip()
            
        exp_map[q_num] = {
            "title": title,
            "explanation": exp_text,
            "distractor_exp": distractor,
            "citation": citation
        }
        
    # 3. Questions in Ⅰ. 문제지
    q_sec_m = re.search(r"##\s*Ⅰ\.\s*문제지.*?(?=##\s*Ⅱ|\Z)", content, re.DOTALL)
    q_sec = q_sec_m.group(0) if q_sec_m else content
    
    q_splits = list(re.finditer(r"(?:^|\n)###\s*(\d+)\.\s*([^\n]*)", q_sec))
    questions = []
    for idx, m in enumerate(q_splits):
        q_num = int(m.group(1))
        title = m.group(2).strip()
        start_p = m.end()
        end_p = q_splits[idx+1].start() if idx+1 < len(q_splits) else len(q_sec)
        block = q_sec[start_p:end_p].strip()
        
        stem, options = extract_options_and_stem(block)
        e_info = exp_map.get(q_num, {"explanation": "", "distractor_exp": "", "citation": ""})
        m_info = meta_map.get(q_num, {"domain": "상담연구방법론의 실제", "cognitive": "분석", "difficulty": "상"})
        
        questions.append({
            "subject_q_num": q_num,
            "stem": stem,
            "options": options,
            "answer": ans_map.get(q_num, 0),
            "explanation": e_info["explanation"],
            "distractor_exp": e_info["distractor_exp"],
            "citation": e_info["citation"],
            "domain": m_info.get("domain", "상담연구방법론의 실제"),
            "difficulty": m_info.get("difficulty", "상"),
            "cognitive": m_info.get("cognitive", "분석")
        })
    return questions

def parse_subject_4(content):
    # 04_비행상담_최종25문항.md
    # Questions in ## Ⅰ. 문제지 -> ### 1. Title ~ ### 25. Title
    # Explanations in ## Ⅱ. 정답 및 상세해설 -> ### 1. 정답 ④ ~ ### 25. 정답 ①
    
    exp_sec = ""
    exp_m = re.search(r"##\s*Ⅱ\.\s*정답 및 상세해설.*?(?=##\s*Ⅲ|\Z)", content, re.DOTALL)
    if exp_m:
        exp_sec = exp_m.group(0)
        
    exp_splits = list(re.finditer(r"(?:^|\n)###\s*(\d+)\.\s*정답\s*([①②③④⑤12345])", exp_sec))
    ans_map = {}
    exp_map = {}
    for idx, m in enumerate(exp_splits):
        q_num = int(m.group(1))
        ans = circ_to_num[m.group(2)]
        ans_map[q_num] = ans
        
        start_p = m.end()
        end_p = exp_splits[idx+1].start() if idx+1 < len(exp_splits) else len(exp_sec)
        block = exp_sec[start_p:end_p].strip()
        
        # Parse - **정답 해설:** ..., - **오답 반증:** ..., - **직접 출처:** ...
        exp_text = ""
        distractor = ""
        citation = ""
        
        exp_match = re.search(r"-\s*\*\*정답\s*해설:?\*\*\s*(.*?)(?=-\s*\*\*오답|-\s*\*\*직접|\Z)", block, re.DOTALL)
        if exp_match:
            exp_text = exp_match.group(1).strip()
        else:
            exp_text = block
            
        dist_match = re.search(r"-\s*\*\*오답\s*반증:?\*\*\s*(.*?)(?=-\s*\*\*직접|\Z)", block, re.DOTALL)
        if dist_match:
            distractor = dist_match.group(1).strip()
            
        cit_match = re.search(r"-\s*\*\*직접\s*출처:?\*\*\s*(.*?)(?=\Z)", block, re.DOTALL)
        if cit_match:
            citation = cit_match.group(1).strip()
            
        exp_map[q_num] = {
            "explanation": exp_text,
            "distractor_exp": distractor,
            "citation": citation
        }
        
    # Questions
    q_sec_m = re.search(r"##\s*Ⅰ\.\s*문제지.*?(?=##\s*Ⅱ|\Z)", content, re.DOTALL)
    q_sec = q_sec_m.group(0) if q_sec_m else content
    
    q_splits = list(re.finditer(r"(?:^|\n)###\s*(\d+)\.\s*([^\n]*)", q_sec))
    questions = []
    for idx, m in enumerate(q_splits):
        q_num = int(m.group(1))
        title = m.group(2).strip()
        start_p = m.end()
        end_p = q_splits[idx+1].start() if idx+1 < len(q_splits) else len(q_sec)
        block = q_sec[start_p:end_p].strip()
        
        stem, options = extract_options_and_stem(block)
        e_info = exp_map.get(q_num, {"explanation": "", "distractor_exp": "", "citation": ""})
        
        questions.append({
            "subject_q_num": q_num,
            "stem": stem,
            "options": options,
            "answer": ans_map.get(q_num, 0),
            "explanation": e_info["explanation"],
            "distractor_exp": e_info["distractor_exp"],
            "citation": e_info["citation"],
            "domain": "비행상담",
            "difficulty": "중상",
            "cognitive": "적용"
        })
    return questions

def parse_subject_5(content):
    # 05_성상담_최종25문항.md
    # Each question is self contained in ## 문제지 -> ### 1. ~ ### 25.
    # Has **정답: ②**, **해설:**, **오답 반증:**, **직접 출처:**
    
    q_sec_m = re.search(r"##\s*문제지.*?(?=##\s*정답표|\Z)", content, re.DOTALL)
    q_sec = q_sec_m.group(0) if q_sec_m else content
    
    q_splits = list(re.finditer(r"(?:^|\n)###\s*(\d+)\.\s*([^\n]*)", q_sec))
    questions = []
    for idx, m in enumerate(q_splits):
        q_num = int(m.group(1))
        title = m.group(2).strip()
        start_p = m.end()
        end_p = q_splits[idx+1].start() if idx+1 < len(q_splits) else len(q_sec)
        block = q_sec[start_p:end_p].strip()
        
        # Meta line: **영역:** 성 개념·발달　 **자극:** 사례　 **응답:** 단일최선답　 **인지:** 이해　 **난도:** 중상
        meta_m = re.search(r"\*\*영역:\*\*\s*([^\s\*]+).*?\*\*인지:\*\*\s*([^\s\*]+).*?\*\*난도:\*\*\s*([^\s\*]+)", block)
        domain = meta_m.group(1).strip() if meta_m else "성상담"
        cog = meta_m.group(2).strip() if meta_m else "이해"
        diff = meta_m.group(3).strip() if meta_m else "중상"
        
        # Answer
        ans = 0
        ans_m = re.search(r"\*\*정답:\s*([①②③④⑤12345])\*\*", block)
        if ans_m:
            ans = circ_to_num[ans_m.group(1)]
            
        # Explanations
        exp_text = ""
        distractor = ""
        citation = ""
        
        exp_m = re.search(r"\*\*해설:\*\*\s*(.*?)(?=\*\*오답|\*\*직접|\Z)", block, re.DOTALL)
        if exp_m:
            exp_text = exp_m.group(1).strip()
            
        dist_m = re.search(r"\*\*오답\s*반증:\*\*\s*(.*?)(?=\*\*직접|\Z)", block, re.DOTALL)
        if dist_m:
            distractor = dist_m.group(1).strip()
            
        cit_m = re.search(r"\*\*직접\s*출처:\*\*\s*(.*?)(?=\n---|\Z)", block, re.DOTALL)
        if cit_m:
            citation = cit_m.group(1).strip()
            
        # Cut stem + options before **정답:
        stem_opt_part = block
        if ans_m:
            stem_opt_part = block[:ans_m.start()].strip()
            
        # Remove meta line
        stem_opt_part = re.sub(r"^\*\*영역:\*\*[^\n]*\n?", "", stem_opt_part).strip()
        stem, options = extract_options_and_stem(stem_opt_part)
        
        questions.append({
            "subject_q_num": q_num,
            "stem": stem,
            "options": options,
            "answer": ans,
            "explanation": exp_text,
            "distractor_exp": distractor,
            "citation": citation,
            "domain": domain,
            "difficulty": diff,
            "cognitive": cog
        })
    return questions

def parse_subject_6(content):
    # 06_약물상담_최종25문항.md
    # Questions in ## 문제지 -> ### 1. Title ~ ### 25. Title
    # Explanations in ## 정답·해설·오답 반증 -> ### 1번 — 정답 ④ ~ ### 25번 — 정답 ...
    
    exp_sec = ""
    exp_m = re.search(r"##\s*정답·해설·오답 반증.*?(?=##\s*선정|\Z)", content, re.DOTALL)
    if exp_m:
        exp_sec = exp_m.group(0)
        
    exp_splits = list(re.finditer(r"(?:^|\n)###\s*(\d+)번\s*[—\-]\s*정답\s*([①②③④⑤12345])", exp_sec))
    ans_map = {}
    exp_map = {}
    for idx, m in enumerate(exp_splits):
        q_num = int(m.group(1))
        ans = circ_to_num[m.group(2)]
        ans_map[q_num] = ans
        
        start_p = m.end()
        end_p = exp_splits[idx+1].start() if idx+1 < len(exp_splits) else len(exp_sec)
        block = exp_sec[start_p:end_p].strip()
        
        # - **해설:** ..., - **오답 반증:** ..., - **직접출처:** ...
        exp_text = ""
        distractor = ""
        citation = ""
        
        exp_match = re.search(r"-\s*\*\*해설:?\*\*\s*(.*?)(?=-\s*\*\*오답|-\s*\*\*직접|\Z)", block, re.DOTALL)
        if exp_match:
            exp_text = exp_match.group(1).strip()
        else:
            exp_text = block
            
        dist_match = re.search(r"-\s*\*\*오답\s*반증:?\*\*\s*(.*?)(?=-\s*\*\*직접|\Z)", block, re.DOTALL)
        if dist_match:
            distractor = dist_match.group(1).strip()
            
        cit_match = re.search(r"-\s*\*\*직접\s*출처:?\*\*\s*(.*?)(?=\Z)", block, re.DOTALL)
        if cit_match:
            citation = cit_match.group(1).strip()
            
        exp_map[q_num] = {
            "explanation": exp_text,
            "distractor_exp": distractor,
            "citation": citation
        }
        
    # Questions
    q_sec_m = re.search(r"##\s*문제지.*?(?=##\s*정답|\Z)", content, re.DOTALL)
    q_sec = q_sec_m.group(0) if q_sec_m else content
    
    q_splits = list(re.finditer(r"(?:^|\n)###\s*(\d+)\.\s*([^\n]*)", q_sec))
    questions = []
    for idx, m in enumerate(q_splits):
        q_num = int(m.group(1))
        title = m.group(2).strip()
        start_p = m.end()
        end_p = q_splits[idx+1].start() if idx+1 < len(q_splits) else len(q_sec)
        block = q_sec[start_p:end_p].strip()
        
        stem, options = extract_options_and_stem(block)
        e_info = exp_map.get(q_num, {"explanation": "", "distractor_exp": "", "citation": ""})
        
        questions.append({
            "subject_q_num": q_num,
            "stem": stem,
            "options": options,
            "answer": ans_map.get(q_num, 0),
            "explanation": e_info["explanation"],
            "distractor_exp": e_info["distractor_exp"],
            "citation": e_info["citation"],
            "domain": "약물상담",
            "difficulty": "중상",
            "cognitive": "적용"
        })
    return questions

def parse_subject_7(content):
    # 07_위기상담_최종25문항.md
    # Questions in # I. 최종 문제지 -> ## 1. Title ~ ## 25. Title
    # Explanations in # II. 정답·해설·오답 반증·직접출처 -> ## 1번 — CR-A-01 ~ ## 25번 — CR-B-15
    
    exp_sec = ""
    exp_m = re.search(r"#\s*II\.\s*정답·해설.*?(?=#\s*III|\Z)", content, re.DOTALL)
    if exp_m:
        exp_sec = exp_m.group(0)
        
    exp_splits = list(re.finditer(r"(?:^|\n)##\s*(\d+)번[^\n]*", exp_sec))
    ans_map = {}
    exp_map = {}
    for idx, m in enumerate(exp_splits):
        q_num = int(m.group(1))
        start_p = m.end()
        end_p = exp_splits[idx+1].start() if idx+1 < len(exp_splits) else len(exp_sec)
        block = exp_sec[start_p:end_p].strip()
        
        ans_m = re.search(r"-\s*\*\*정답:\s*([①②③④⑤12345])\*\*", block)
        if ans_m:
            ans_map[q_num] = circ_to_num[ans_m.group(1)]
            
        exp_text = ""
        distractor = ""
        citation = ""
        
        exp_match = re.search(r"###\s*정답\s*해설\s*\n*(.*?)(?=###\s*오답|###\s*직접|\Z)", block, re.DOTALL)
        if exp_match:
            exp_text = exp_match.group(1).strip()
            
        dist_match = re.search(r"###\s*오답\s*반증\s*\n*(.*?)(?=###\s*직접|\Z)", block, re.DOTALL)
        if dist_match:
            distractor = dist_match.group(1).strip()
            
        cit_match = re.search(r"###\s*직접\s*출처\s*\n*(.*?)(?=\Z)", block, re.DOTALL)
        if cit_match:
            citation = cit_match.group(1).strip()
            
        exp_map[q_num] = {
            "explanation": exp_text,
            "distractor_exp": distractor,
            "citation": citation
        }
        
    # Questions in # I. 최종 문제지
    q_sec_m = re.search(r"#\s*I\.\s*최종 문제지.*?(?=#\s*II|\Z)", content, re.DOTALL)
    q_sec = q_sec_m.group(0) if q_sec_m else content
    
    q_splits = list(re.finditer(r"(?:^|\n)##\s*(\d+)\.\s*([^\n]*)", q_sec))
    questions = []
    for idx, m in enumerate(q_splits):
        q_num = int(m.group(1))
        title = m.group(2).strip()
        start_p = m.end()
        end_p = q_splits[idx+1].start() if idx+1 < len(q_splits) else len(q_sec)
        block = q_sec[start_p:end_p].strip()
        
        # Meta items: - 문항 ID: ..., - 내용영역: ..., - 형식: ..., - 인지수준·난도: ...
        domain = "위기상담"
        cog = "적용"
        diff = "중상"
        
        dom_m = re.search(r"-\s*내용영역:\s*([^\n]+)", block)
        if dom_m: domain = dom_m.group(1).strip()
        
        cog_diff_m = re.search(r"-\s*인지수준·난도:\s*([^/\n]+)\s*/\s*([^\n]+)", block)
        if cog_diff_m:
            cog = cog_diff_m.group(1).strip()
            diff = cog_diff_m.group(2).strip()
            
        # Clean block from meta lines
        clean_q = re.sub(r"-\s*(?:문항 ID|내용영역|형식|인지수준·난도):[^\n]*\n?", "", block).strip()
        
        stem, options = extract_options_and_stem(clean_q)
        e_info = exp_map.get(q_num, {"explanation": "", "distractor_exp": "", "citation": ""})
        
        questions.append({
            "subject_q_num": q_num,
            "stem": stem,
            "options": options,
            "answer": ans_map.get(q_num, 0),
            "explanation": e_info["explanation"],
            "distractor_exp": e_info["distractor_exp"],
            "citation": e_info["citation"],
            "domain": domain,
            "difficulty": diff,
            "cognitive": cog
        })
    return questions

# Run all parsers
parsers = {
    1: parse_subject_1,
    2: parse_subject_2,
    3: parse_subject_3,
    4: parse_subject_4,
    5: parse_subject_5,
    6: parse_subject_6,
    7: parse_subject_7
}

all_round2_questions = []
validation_report = []

for s in subjects:
    path = os.path.join(BASE_DIR, s["file"])
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
        
    s_questions = parsers[s["id"]](content)
    validation_report.append(f"Subject {s['id']} ({s['name']}): Extracted {len(s_questions)} questions.")
    
    for q in s_questions:
        global_q_num = s["start"] + q["subject_q_num"] - 1
        q_obj = {
            "id": global_q_num,
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
        
        # Check validation errors
        if len(q["options"]) != 5:
            validation_report.append(f"  [ERROR] Q{global_q_num} (Subject {s['id']}-{q['subject_q_num']}) options count is {len(q['options'])}!")
        if q["answer"] < 1 or q["answer"] > 5:
            validation_report.append(f"  [ERROR] Q{global_q_num} (Subject {s['id']}-{q['subject_q_num']}) invalid answer: {q['answer']}!")
        if not q["stem"]:
            validation_report.append(f"  [ERROR] Q{global_q_num} (Subject {s['id']}-{q['subject_q_num']}) empty stem!")
            
        all_round2_questions.append(q_obj)

validation_report.append(f"\nTOTAL Round 2 Questions: {len(all_round2_questions)}")

with open(r"c:\Users\USER\Downloads\청상1급_Gemini\exam\scripts\parse_report.txt", 'w', encoding='utf-8') as f:
    f.write('\n'.join(validation_report))

# Save Round 2 questions to JSON
with open(r"c:\Users\USER\Downloads\청상1급_Gemini\exam\data\questions_2.json", 'w', encoding='utf-8') as f:
    json.dump(all_round2_questions, f, ensure_ascii=False, indent=2)

print("Parse complete! Check parse_report.txt")
