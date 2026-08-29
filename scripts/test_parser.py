import os
import re
import json

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

def parse_answer_table(text):
    ans_map = {}
    # Look for table with 문항 and 정답 rows
    # | 문항 | 1 | 2 | ...
    # | 정답 | ④ | ② | ...
    # or multiple tables
    lines = text.split('\n')
    for i in range(len(lines) - 2):
        if '문항' in lines[i] and '정답' in lines[i+2]:
            q_cols = [c.strip() for c in lines[i].split('|')[1:-1] if c.strip()]
            a_cols = [c.strip() for c in lines[i+2].split('|')[1:-1] if c.strip()]
            for q_str, a_str in zip(q_cols, a_cols):
                if q_str.isdigit() and a_str in circ_to_num:
                    ans_map[int(q_str)] = circ_to_num[a_str]
    return ans_map

log = []

for s in subjects:
    path = os.path.join(r"c:\Users\USER\Downloads\청상1급_Gemini\2026년_예상문제_2", s["file"])
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    ans_table = parse_answer_table(content)
    log.append(f"Subject {s['id']} ({s['name']}): Answer table parsed {len(ans_table)} answers: {ans_table}")

with open(r"c:\Users\USER\Downloads\청상1급_Gemini\exam\scripts\test_log.txt", 'w', encoding='utf-8') as f:
    f.write('\n'.join(log))

print("Done parsing answer tables.")
