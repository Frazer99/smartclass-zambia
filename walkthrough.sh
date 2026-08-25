#!/bin/bash
set -e
B=http://127.0.0.1:8000
j() { python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps(d $1))"; }

TOKEN=$(curl -s -X POST $B/api/auth/login -H 'Content-Type: application/json' -d '{"email":"student@smartclass.zm","password":"password123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

echo "== start lesson =="
SESSION=$(curl -s -X POST $B/api/lessons/start -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"subject_id":1,"topic_id":2}')
SID=$(echo "$SESSION" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "session id: $SID"

echo "== answer comprehension check (should be marked correct) =="
R=$(curl -s -X POST $B/api/lessons/message -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"session_id\":$SID,\"content\":\"we isolate x by doing the same operation on both sides, subtract then divide, to balance the equation\",\"elapsed_seconds\":30}")
echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['messages'][-1]['content'][:150])"

echo "== finish lesson (say done) =="
R=$(curl -s -X POST $B/api/lessons/message -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"session_id\":$SID,\"content\":\"done\",\"elapsed_seconds\":30}")
echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['messages'][-1]['content'][:200]); print('ended_at:', d['ended_at'])"

echo
echo "== trial status after lesson (90s used of 600s) =="
curl -s "$B/api/lessons/trial-status/1" -H "Authorization: Bearer $TOKEN"
echo

echo
echo "== past paper: list for subject 1 form 4 =="
curl -s "$B/api/catalog/past-papers?subject_id=1&form_level=4" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo "== start past paper, question 1 only =="
PP=$(curl -s -X POST $B/api/past-papers/start -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"past_paper_id":1,"question_ids":[1]}')
echo "$PP" | python3 -c "import sys,json; d=json.load(sys.stdin); print('session',d['id']); print(d['messages'][-1]['content'])"
PPSID=$(echo "$PP" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")

echo "== ask a follow-up 'why' question =="
curl -s -X POST $B/api/past-papers/message -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"session_id\":$PPSID,\"content\":\"why do we subtract 5 first?\",\"elapsed_seconds\":20}" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['messages'][-1]['content'])"

echo
echo "== force trial exhaustion: send a big elapsed_seconds chunk =="
curl -s -X POST $B/api/past-papers/message -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"session_id\":$PPSID,\"content\":\"next\",\"elapsed_seconds\":500}" -o /tmp/r1.json -w "HTTP %{http_code}\n"
cat /tmp/r1.json | python3 -m json.tool | head -5

echo "== try again, should now be 402 Payment Required =="
curl -s -X POST $B/api/past-papers/message -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"session_id\":$PPSID,\"content\":\"next\",\"elapsed_seconds\":50}" -o /tmp/r2.json -w "HTTP %{http_code}\n"
cat /tmp/r2.json

echo
echo "== subscribe via MTN Mobile Money =="
curl -s -X POST $B/api/billing/pay -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"subject_id":1,"method":"mtn_momo","msisdn":"+260971234567"}' | python3 -m json.tool

echo "== trial status now should show has_active_subscription true =="
curl -s "$B/api/lessons/trial-status/1" -H "Authorization: Bearer $TOKEN"
echo

echo "== now the past paper interaction should work again despite trial exhaustion =="
curl -s -X POST $B/api/past-papers/message -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d "{\"session_id\":$PPSID,\"content\":\"next\",\"elapsed_seconds\":5}" -w "\nHTTP %{http_code}\n" | tail -5

echo
echo "== admin: upload a new syllabus doc and check topics auto-created =="
ADMIN_TOKEN=$(curl -s -X POST $B/api/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@smartclass.zm","password":"password123"}' | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
echo -e "Topic 1: Forces and Motion\nTopic 2: Energy and Work\nTopic 3: Pressure" > /tmp/sample_syllabus.txt
curl -s -X POST $B/api/admin/syllabus -H "Authorization: Bearer $ADMIN_TOKEN" -F "subject_id=2" -F "form_level=5" -F "file=@/tmp/sample_syllabus.txt" | python3 -m json.tool
curl -s "$B/api/catalog/topics?subject_id=2&form_level=5" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo
echo "== progress record =="
curl -s "$B/api/progress" -H "Authorization: Bearer $TOKEN" | python3 -m json.tool

echo "ALL CHECKS DONE"
