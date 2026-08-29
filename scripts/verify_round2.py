import json

with open(r"c:\Users\USER\Downloads\청상1급_Gemini\exam\data\questions_2.json", 'r', encoding='utf-8') as f:
    qs = json.load(f)

log = [f"Total questions in Round 2: {len(qs)}"]

for s_id in range(1, 8):
    subj_qs = [q for q in qs if q["subject_id"] == s_id]
    q = subj_qs[0]
    log.append(f"\n=== Subject {s_id}: {q['subject_name']} (Total {len(subj_qs)} questions) ===")
    log.append(f"Global ID: {q['id']}, Subject Q#: {q['subject_q_num']}")
    log.append(f"Stem: {q['stem'][:80]}...")
    log.append(f"Options (5): {q['options']}")
    log.append(f"Answer: {q['answer']}")
    log.append(f"Explanation: {q['explanation'][:80]}...")
    log.append(f"Distractor: {q['distractor_exp'][:80]}...")
    log.append(f"Citation: {q['citation'][:80]}...")

with open(r"c:\Users\USER\Downloads\청상1급_Gemini\exam\scripts\verify_round2.txt", 'w', encoding='utf-8') as f:
    f.write('\n'.join(log))

print("Validation written to verify_round2.txt")
