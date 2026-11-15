import json
import random
import string

print("Synthetic JSON body-size benchmark; proposed contracts are NOT implemented.")
print("Serialization: json.dumps(separators=(',', ':'), ensure_ascii=False), UTF-8 bytes.")
print("No network, credentials, real customer data, compression, HTTP/RPC envelopes, or latency measurements.")
print("Generator: random.Random(17); 800 ASCII words, lengths randrange(4,13); text(n) joins n//4+1 sampled words then slices to n characters.")
print("Chat fixture: message-0000..0098 alternate user/assistant (1000/2000 characters); message-0099 is user (1000 characters): 51 user + 49 assistant messages.")
print("Chat messages contain only id, role, and one text part: no metadata, tools, approvals, attachments, or saved-post hydration.")
print("POST envelope includes only chatId, synthetic model, timezone, and messages; other optional/current transport fields are omitted.")
print("Proposed POST sends only message-0099 plus expectedLastMessageId=message-0098; requires server-side history merge and concurrency handling, not a drop-in truncation.")
print("GET compares all 100 messages against last 20 plus previousCursor; other response fields are unchanged. Requires a compatible server-authoritative send contract.")
print("Content fixture: 20 non-image blog_post drafts, 2000 ASCII markdown characters each, empty content, null htmlUrl/contentSubtype, fixed timestamps, page 1/20 of 100.")
print("Proposed content drops content/markdown and adds preview=markdown[:200]; synthetic text has no Markdown syntax. Real implementation must preserve formatting-removal semantics; images excluded.")
print("Sessions fixture: 1000 summaries, fixed timestamps, null pinnedAt/externalChannelId; proposed first 50 plus nextCursor. Pinning, filtering, and ordering correctness are not benchmarked.")
print("Logs fixture: 200 GitHub incoming success summaries, hasPayload=true but no payload, fixed timestamps; proposed first 10 plus pagination. Existing overview already strips payload; pagination trades smaller initial fetch for extra navigation requests.")
print()

r = random.Random(17)
words = [
    ''.join(r.choices(string.ascii_lowercase, k=r.randrange(4, 13)))
    for _ in range(800)
]


def text(n):
    s = ' '.join(r.choice(words) for _ in range(n // 4 + 1))
    return s[:n]


def size(x):
    return len(json.dumps(x, separators=(',', ':'), ensure_ascii=False).encode())


def compare(name, a, b):
    x, y = size(a), size(b)
    print(f'{name}: {x} -> {y} bytes; saved {x-y}; reduction {(1-y/x)*100:.3f}%')


messages = [
    {
        'id': f'message-{i:04}',
        'role': 'user' if i % 2 == 0 else 'assistant',
        'parts': [{'type': 'text', 'text': text(1000 if i % 2 == 0 else 2000)}],
    }
    for i in range(99)
]
messages.append({
    'id': 'message-0099',
    'role': 'user',
    'parts': [{'type': 'text', 'text': text(1000)}],
})
base = {'chatId': 'chat-synthetic', 'model': 'synthetic-model', 'timezone': 'Europe/Berlin'}
compare(
    'Chat POST: 100 full messages vs proposed latest-message+revision',
    dict(base, messages=messages),
    dict(base, messages=messages[-1:], expectedLastMessageId=messages[-2]['id']),
)
compare(
    'Chat GET: 100 messages vs proposed last 20',
    {
        'chatId': 'chat-synthetic', 'messages': messages,
        'lastResponseStopped': False, 'activeStreamId': None,
        'externalChannelId': None, 'slackThreadUrl': None,
    },
    {
        'chatId': 'chat-synthetic', 'messages': messages[-20:],
        'lastResponseStopped': False, 'activeStreamId': None,
        'externalChannelId': None, 'slackThreadUrl': None,
        'previousCursor': 'message-0080',
    },
)
posts = [
    {
        'id': f'post-{i:04}', 'title': f'Synthetic article {i}',
        'slug': f'synthetic-{i}', 'content': '', 'htmlUrl': None,
        'markdown': text(2000), 'contentType': 'blog_post',
        'contentSubtype': None, 'status': 'draft',
        'createdAt': '2026-10-18T10:00:00.000Z',
        'updatedAt': '2026-10-18T10:00:00.000Z',
    }
    for i in range(20)
]
small = [
    dict(
        {k: v for k, v in p.items() if k not in ['markdown', 'content']},
        preview=p['markdown'][:200],
    )
    for p in posts
]
compare(
    'Content list: 20x2000-char markdown vs 20x200-char plain preview',
    {'posts': posts, 'pagination': {'page': 1, 'pageSize': 20, 'totalCount': 100, 'totalPages': 5}},
    {'posts': small, 'pagination': {'page': 1, 'pageSize': 20, 'totalCount': 100, 'totalPages': 5}},
)
sessions = [
    {
        'chatId': f'chat-{i:06}', 'title': f'Synthetic conversation {i:06}',
        'createdAt': '2026-10-18T10:00:00.000Z',
        'updatedAt': '2026-10-18T10:00:00.000Z',
        'pinnedAt': None, 'externalChannelId': None,
    }
    for i in range(1000)
]
compare(
    'Session list: 1000 summaries vs proposed page 50',
    {'sessions': sessions},
    {'sessions': sessions[:50], 'nextCursor': 'chat-000049'},
)
logs = [
    {
        'id': f'log_{i:05}', 'integrationId': 'integration-synthetic',
        'referenceId': None, 'title': f'Synthetic webhook delivery {i:03}',
        'integrationType': 'github', 'direction': 'incoming', 'status': 'success',
        'statusCode': 200, 'errorMessage': None,
        'createdAt': '2026-10-18T10:00:00.000Z', 'hasPayload': True,
    }
    for i in range(200)
]
compare(
    'Logs overview: 200 summaries vs proposed page 10',
    {'logs': logs},
    {'logs': logs[:10], 'pagination': {'page': 1, 'pageSize': 10, 'totalCount': 200, 'totalPages': 20}},
)
