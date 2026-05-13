# Eval Report

- **Cases**: 31
- **Candidate**: `google/gemini-2.5-flash (route:default)`
- **Baseline**:  `anthropic/claude-sonnet-4-5`
- **Judge**:     `(see judge.jsonl)`

## Headline

| Metric | Value |
|---|---|
| Tool match | 29/31 (93.5%) |
| Tool-args match (where asserted) | 30/31 |
| Reply pattern match | 23/31 |
| Judge equivalent (yes+partial) | 27/31 (87.1%) |
| Judge yes / partial / no | 20 / 7 / 4 |
| Cost (baseline → candidate) | $0.7833 → $0.0310 (Δ -96.0%) |
| Latency p50 | 7876ms → 7518ms (Δ -4.5%) |

## Per-case

| # | Case | Cat | Tool | Args | Reply | Judge | Cost Δ | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | save_simple_no_date | save | ❌ | ❌ | ✅ | ❌ | -98% | expected save_memory got (none); missing call save_memory#1 |
| 2 | save_with_tomorrow | save | ✅ | ✅ | ✅ | ✅ | -98% |  |
| 3 | save_with_specific_date | save | ✅ | ✅ | ✅ | ✅ | -98% |  |
| 4 | save_ambiguous_test_word | ambiguous | ✅ | — | ✅ | ✅ | -98% |  |
| 5 | save_ambiguous_single_word | ambiguous | ✅ | — | ✅ | 🟡 | -99% |  |
| 6 | list_pending_empty | list | ✅ | — | ✅ | ✅ | -98% |  |
| 7 | list_pending_three_items | list | ✅ | — | ❌ | ❌ | -100% | reply matched none of: /ส่งการบ้าน|ซื้อนม|นัดหมอ/ |
| 8 | list_pending_with_flex | list | ✅ | — | — | ❌ | -100% |  |
| 9 | list_done_show_recent | list | ✅ | — | ❌ | 🟡 | -98% | reply matched none of: /ใบลา|ออกกำลังกาย|done|เสร็จ/i |
| 10 | complete_position_1 | complete | ✅ | ✅ | ✅ | ✅ | -98% |  |
| 11 | complete_position_3_explicit_list | complete | ✅ | ✅ | ✅ | ✅ | -98% |  |
| 12 | complete_out_of_range | error_path | ✅ | — | ❌ | ✅ | -98% | reply matched none of: /ไม่พบ|ไม่มี|out|range|3 รายการ|only/i |
| 13 | delete_position_2 | delete | ✅ | ✅ | ✅ | ✅ | -98% |  |
| 14 | delete_by_phrase_match | delete | ✅ | — | ✅ | ✅ | -98% |  |
| 15 | update_text_position_2 | update | ✅ | ✅ | ✅ | 🟡 | -73% |  |
| 16 | update_due_position_3 | update | ✅ | ✅ | ❌ | ✅ | -73% | reply matched none of: /พฤหัส|thursday|นัดหมอ|เลื่อน/i |
| 17 | uncomplete_undo | uncomplete | ✅ | ✅ | ✅ | ✅ | -98% |  |
| 18 | dashboard_link_request | dashboard_link | ✅ | — | ✅ | ✅ | -98% |  |
| 19 | profile_set_timezone | profile_memory | ✅ | — | ✅ | 🟡 | -72% |  |
| 20 | multi_save_two_items_one_msg | multi_bubble | ✅ | — | ❌ | ✅ | -98% | reply matched none of: /physics|ขนม|2|สอง/i |
| 21 | greeting_no_tools | ambiguous | ✅ | — | ✅ | 🟡 | -98% |  |
| 22 | thanks_no_tools | ambiguous | ✅ | — | ✅ | 🟡 | -98% |  |
| 23 | save_mixed_language | save | ✅ | ✅ | — | ✅ | -98% |  |
| 24 | save_typo | save | ✅ | ✅ | — | ✅ | -98% |  |
| 25 | complete_pronoun_referent | complete | ✅ | ✅ | ❌ | ✅ | -98% | reply matched none of: /อ่านหนังสือ|ฟิสิกส์|เสร็จ|done/i |
| 26 | list_then_complete | complete | ✅ | — | ❌ | ❌ | -100% | reply matched none of: /นัดประชุม|เสร็จ|complete/i |
| 27 | complete_when_empty | error_path | ✅ | — | ❌ | ✅ | -98% | reply matched none of: /ไม่มี|empty|ว่าง|ยังไม่มี|0/i |
| 28 | save_with_time_only | save | ✅ | ✅ | — | ✅ | -98% |  |
| 29 | save_note_url | save | ✅ | ✅ | ✅ | ✅ | -98% |  |
| 30 | save_note_freeform | save | ❌ | — | ✅ | ✅ | -98% | expected save_note got save_memory,send_flex_reply |
| 31 | adversarial_ignore_instructions | ambiguous | ✅ | — | ✅ | 🟡 | -99% |  |

## Failures (11)

### `save_simple_no_date` — Save a single todo without due date (Thai).

- expected save_memory got (none)
- missing call save_memory#1
- judge: Baseline correctly saved the todo task while Candidate failed to recognize the intent and asked what the user wants instead.

### `list_pending_three_items` — List 3 pending todos — agent should surface positions.

- reply matched none of: /ส่งการบ้าน|ซื้อนม|นัดหมอ/
- judge: Candidate provided no reply to the user while baseline correctly displayed the todo list using flex message.

### `list_pending_with_flex` — List should use todo_list flex template for >=2 items.

- judge: Reply B provides no visible response to the user while Reply A correctly displays the todo list using flex message.

### `list_done_show_recent` — Ask to see recent completions.

- reply matched none of: /ใบลา|ออกกำลังกาย|done|เสร็จ/i

### `complete_out_of_range` — Position 10 when only 3 items exist — agent should report it back gracefully.

- reply matched none of: /ไม่พบ|ไม่มี|out|range|3 รายการ|only/i

### `update_due_position_3` — Move item 3's due date.

- reply matched none of: /พฤหัส|thursday|นัดหมอ|เลื่อน/i

### `multi_save_two_items_one_msg` — User saves 2 items in one message — must call save_memory twice + flex multi.

- reply matched none of: /physics|ขนม|2|สอง/i

### `complete_pronoun_referent` — After list, 'ตัวแรก'/'อันบน' means position 1.

- reply matched none of: /อ่านหนังสือ|ฟิสิกส์|เสร็จ|done/i

### `list_then_complete` — User asks to see list AND complete one in same message.

- reply matched none of: /นัดประชุม|เสร็จ|complete/i
- judge: Reply B provides no visible response to the user while Reply A sends a flex message confirming the task completion.

### `complete_when_empty` — User asks to complete item 1 but list is empty.

- reply matched none of: /ไม่มี|empty|ว่าง|ยังไม่มี|0/i

### `save_note_freeform` — Free-form note without URL.

- expected save_note got save_memory,send_flex_reply
