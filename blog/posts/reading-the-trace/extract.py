#!/usr/bin/env python3
"""Extract a tidy dataset from one redacted Claude Code trace log (JSONL.gz).

Usage: extract.py LOG.jsonl.gz MANIFEST.json OUT.json
"""
import gzip, json, sys, collections
from datetime import datetime, timezone

log_path, manifest_path, out_path = sys.argv[1:4]
recs = [json.loads(l) for l in gzip.open(log_path, 'rt')]
manifest = json.load(open(manifest_path))

def ts(s):
    return datetime.fromisoformat(s.replace('Z', '+00:00')).timestamp()

# ---- API calls: group assistant records by message.id -------------------------
calls = collections.OrderedDict()
tool_use_index = {}  # tool_use_id -> (call_id, name, ts)
for r in recs:
    if r['type'] != 'assistant':
        continue
    m = r['message']
    mid = m['id']
    c = calls.setdefault(mid, {
        'id': mid, 'ts': r['timestamp'], 'model': m.get('model'),
        'requested_model': r.get('requestedModel'), 'effort': r.get('effort'),
        'stop_reason': None, 'usage': {}, 'tools': [], 'text_chars': 0,
        'thinking_chars': 0, 'blocks': 0,
    })
    c['ts'] = min(c['ts'], r['timestamp'])
    if m.get('stop_reason'):
        c['stop_reason'] = m['stop_reason']
    u = m.get('usage') or {}
    flat = {
        'input': u.get('input_tokens', 0),
        'cache_read': u.get('cache_read_input_tokens', 0),
        'cache_write': u.get('cache_creation_input_tokens', 0),
        'cache_write_1h': (u.get('cache_creation') or {}).get('ephemeral_1h_input_tokens', 0),
        'cache_write_5m': (u.get('cache_creation') or {}).get('ephemeral_5m_input_tokens', 0),
        'output': u.get('output_tokens', 0),
        'thinking': (u.get('output_tokens_details') or {}).get('thinking_tokens', 0),
    }
    for k, v in flat.items():
        c['usage'][k] = max(c['usage'].get(k, 0), v or 0)
    for b in m.get('content', []):
        c['blocks'] += 1
        if b.get('type') == 'tool_use':
            c['tools'].append(b['name'])
            tool_use_index[b['id']] = {'call': mid, 'name': b['name'], 'ts': r['timestamp'],
                                       'input': b.get('input', {})}
        elif b.get('type') == 'text':
            c['text_chars'] += len(b.get('text', ''))
        elif b.get('type') == 'thinking':
            c['thinking_chars'] += len(b.get('thinking', ''))

# ---- Tool results ---------------------------------------------------------------
tools = []
for r in recs:
    if r['type'] != 'user' or 'toolUseResult' not in r:
        continue
    content = r['message'].get('content')
    if not isinstance(content, list):
        continue
    for b in content:
        if b.get('type') != 'tool_result':
            continue
        tu = tool_use_index.get(b['tool_use_id'])
        if not tu:
            continue
        res = r.get('toolUseResult')
        text = b.get('content')
        if isinstance(text, list):
            text = ' '.join(x.get('text', '') for x in text if isinstance(x, dict))
        text = text or ''
        is_error = bool(b.get('is_error'))
        inp = tu['input']
        desc = inp.get('description') or inp.get('file_path') or inp.get('query') or inp.get('url') or inp.get('skill') or ''
        tools.append({
            'id': b['tool_use_id'], 'name': tu['name'], 'call': tu['call'],
            'start': tu['ts'], 'end': r['timestamp'],
            'duration_s': round(ts(r['timestamp']) - ts(tu['ts']), 3),
            'is_error': is_error,
            'result_chars': len(text),
            'description': str(desc)[:140],
            'command': str(inp.get('command', ''))[:200] if tu['name'] == 'Bash' else '',
            'error_head': text[:200] if is_error else '',
        })

# ---- Human prompts, compactions, turn durations, hooks ---------------------------
prompts, compactions, turn_durations, hooks, local_cmds = [], [], [], [], []
for r in recs:
    if r['type'] == 'user' and isinstance(r['message'].get('content'), str):
        txt = r['message']['content']
        kind = 'human'
        if txt.startswith('This session is being continued'):
            kind = 'compact-summary'
        elif txt.startswith('## Context Usage') or txt.startswith('<local-command') or txt.startswith('<command-name>') or txt.startswith('/'):
            kind = 'local'
        prompts.append({'ts': r['timestamp'], 'kind': kind, 'text': txt[:300], 'chars': len(txt)})
    elif r['type'] == 'system':
        st = r.get('subtype')
        if st == 'compact_boundary':
            cm = r['compactMetadata']
            compactions.append({'ts': r['timestamp'], 'trigger': cm.get('trigger'),
                                'pre_tokens': cm.get('preTokens'), 'post_tokens': cm.get('postTokens'),
                                'duration_ms': cm.get('durationMs')})
        elif st == 'turn_duration':
            turn_durations.append({'ts': r['timestamp'], 'duration_ms': r['durationMs'],
                                   'message_count': r.get('messageCount')})
        elif st == 'stop_hook_summary':
            for h in r.get('hookInfos') or []:
                hooks.append({'ts': r['timestamp'], 'command': h.get('command'), 'duration_ms': h.get('durationMs'),
                              'errors': len(r.get('hookErrors') or [])})
        elif st == 'local_command':
            local_cmds.append({'ts': r['timestamp'], 'content': (r.get('content') or '')[:120]})

# ---- Assign calls to windows and prompts -------------------------------------------
windows = manifest.get('context_windows', [])
def window_of(t):
    for w in windows:
        if ts(w['started']) <= t <= ts(w['ended']) + 1:
            return w['index']
    return None

human = [p for p in prompts if p['kind'] == 'human']
human.sort(key=lambda p: p['ts'])
def prompt_of(t):
    idx = None
    for i, p in enumerate(human):
        if ts(p['ts']) <= t:
            idx = i
    return idx

call_list = []
for c in calls.values():
    t = ts(c['ts'])
    u = c['usage']
    c['context_tokens'] = u['input'] + u['cache_read'] + u['cache_write']
    c['window'] = window_of(t)
    c['prompt_index'] = prompt_of(t)
    call_list.append(c)
call_list.sort(key=lambda c: c['ts'])
for i, c in enumerate(call_list):
    c['seq'] = i

for i, p in enumerate(human):
    p['index'] = i
    cs = [c for c in call_list if c['prompt_index'] == i]
    p['api_calls'] = len(cs)
    p['output_tokens'] = sum(c['usage']['output'] for c in cs)
    p['thinking_tokens'] = sum(c['usage']['thinking'] for c in cs)
    p['cache_read'] = sum(c['usage']['cache_read'] for c in cs)
    p['cache_write'] = sum(c['usage']['cache_write'] for c in cs)
    p['input'] = sum(c['usage']['input'] for c in cs)
    p['tool_calls'] = sum(len(c['tools']) for c in cs)
    p['models'] = sorted({c['model'] for c in cs})
    if cs:
        p['first_call'] = cs[0]['ts']; p['last_call'] = cs[-1]['ts']
        p['active_s'] = round(ts(cs[-1]['ts']) - ts(p['ts']), 1)

out = {
    'session_id': manifest['session_id'],
    'manifest': {k: manifest[k] for k in ('title', 'started', 'ended', 'duration_seconds', 'stats', 'tools', 'models', 'client')},
    'context_windows': windows,
    'commits': manifest.get('commits', []),
    'logs': manifest.get('logs', {}),
    'calls': call_list,
    'tools': sorted(tools, key=lambda t: t['start']),
    'prompts': prompts,
    'human_prompts': human,
    'compactions': compactions,
    'turn_durations': turn_durations,
    'hooks': hooks,
    'local_commands': local_cmds,
}
json.dump(out, open(out_path, 'w'), indent=1)
print(f"calls={len(call_list)} tools={len(tools)} prompts={len(human)} compactions={len(compactions)} hooks={len(hooks)}")
