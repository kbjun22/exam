import os
import re

subjects = [
    {"id": 3, "name": "상담연구방법론의 실제", "file": "03_상담연구방법론의실제_최종25문항.md"},
    {"id": 4, "name": "비행상담", "file": "04_비행상담_최종25문항.md"},
    {"id": 5, "name": "성상담", "file": "05_성상담_최종25문항.md"},
    {"id": 6, "name": "약물상담", "file": "06_약물상담_최종25문항.md"},
    {"id": 7, "name": "위기상담", "file": "07_위기상담_최종25문항.md"},
]

log = []

for s in subjects:
    path = os.path.join(r"c:\Users\USER\Downloads\청상1급_Gemini\2026년_예상문제_2", s["file"])
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    log.append(f"\n==================== {s['name']} ====================")
    # Search for 정답 in the whole text
    ans_lines = [line.strip() for line in content.split('\n') if '정답' in line][:15]
    log.append("Sample lines with '정답':")
    log.extend(ans_lines)

with open(r"c:\Users\USER\Downloads\청상1급_Gemini\exam\scripts\sample_ans_log.txt", 'w', encoding='utf-8') as f:
    f.write('\n'.join(log))

print("Done inspecting sample answers.")
