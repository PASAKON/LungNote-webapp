# Eval Report

- **Cases**: 31
- **Candidate**: `google/gemini-2.5-flash (route:default)`
- **Baseline**:  `anthropic/claude-sonnet-4-5`
- **Judge**:     `(see judge.jsonl)`

## Headline

| Metric | Value |
|---|---|
| Tool match | 30/31 (96.8%) |
| Tool-args match (where asserted) | 31/31 |
| Reply pattern match | 24/31 |
| Judge equivalent (yes+partial) | 27/31 (87.1%) |
| Judge yes / partial / no | 19 / 8 / 4 |
| Cost (baseline → candidate) | $0.7833 → $0.0411 (Δ -94.8%) |
| Latency p50 | 7876ms → 3669ms (Δ -53.4%) |

## Per-case

| # | Case | Cat | Tool | Args | Reply | Judge | Cost Δ | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | save_simple_no_date | save | ✅ | ✅ | ✅ | ✅ | -98% |  |
| 2 | save_with_tomorrow | save | ✅ | ✅ | ✅ | ✅ | -98% |  |
| 3 | save_with_specific_date | save | ✅ | ✅ | ✅ | ✅ | -98% |  |
| 4 | save_ambiguous_test_word | ambiguous | ✅ | — | ✅ | ✅ | -98% |  |
| 5 | save_ambiguous_single_word | ambiguous | ✅ | — | ✅ | 🟡 | -99% |  |
| 6 | list_pending_empty | list | ✅ | — | ✅ | ✅ | -98% |  |
| 7 | list_pending_three_items | list | ✅ | — | ❌ | ❌ | -100% | reply matched none of: /ส่งการบ้าน|ซื้อนม|นัดหมอ/ |
| 8 | list_pending_with_flex | list | ✅ | — | — | ❌ | -100% |  |
| 9 | list_done_show_recent | list | ✅ | — | ✅ | 🟡 | -98% |  |
| 10 | complete_position_1 | complete | ✅ | ✅ | ✅ | ✅ | -98% |  |
| 11 | complete_position_3_explicit_list | complete | ✅ | ✅ | ✅ | ✅ | -98% |  |
| 12 | complete_out_of_range | error_path | ✅ | — | ❌ | ✅ | -98% | reply matched none of: /ไม่พบ|ไม่มี|out|range|3 รายการ|only/i |
| 13 | delete_position_2 | delete | ✅ | ✅ | ✅ | ✅ | -98% |  |
| 14 | delete_by_phrase_match | delete | ✅ | — | ✅ | ✅ | -98% |  |
| 15 | update_text_position_2 | update | ✅ | ✅ | ✅ | 🟡 | -72% |  |
| 16 | update_due_position_3 | update | ✅ | ✅ | ❌ | ✅ | -68% | reply matched none of: /พฤหัส|thursday|นัดหมอ|เลื่อน/i |
| 17 | uncomplete_undo | uncomplete | ✅ | ✅ | ❌ | ❌ | -98% | reply matched none of: /undo|ใบลา|กลับมา|reopen|คืน/i |
| 18 | dashboard_link_request | dashboard_link | ✅ | — | ✅ | ✅ | -98% |  |
| 19 | profile_set_timezone | profile_memory | ✅ | — | ✅ | 🟡 | -72% |  |
| 20 | multi_save_two_items_one_msg | multi_bubble | ✅ | — | ❌ | ❌ | -100% | reply matched none of: /physics|ขนม|2|สอง/i |
| 21 | greeting_no_tools | ambiguous | ✅ | — | ✅ | 🟡 | -98% |  |
| 22 | thanks_no_tools | ambiguous | ✅ | — | ✅ | 🟡 | -98% |  |
| 23 | save_mixed_language | save | ✅ | ✅ | — | ✅ | -98% |  |
| 24 | save_typo | save | ✅ | ✅ | — | ✅ | -98% |  |
| 25 | complete_pronoun_referent | complete | ✅ | ✅ | ❌ | ✅ | -98% | reply matched none of: /อ่านหนังสือ|ฟิสิกส์|เสร็จ|done/i |
| 26 | list_then_complete | complete | ✅ | — | ✅ | 🟡 | -65% |  |
| 27 | complete_when_empty | error_path | ✅ | — | ❌ | ✅ | -98% | reply matched none of: /ไม่มี|empty|ว่าง|ยังไม่มี|0/i |
| 28 | save_with_time_only | save | ✅ | ✅ | — | ✅ | -98% |  |
| 29 | save_note_url | save | ✅ | ✅ | ✅ | ✅ | -98% |  |
| 30 | save_note_freeform | save | ❌ | — | ✅ | ✅ | -98% | expected save_note got save_memory,send_flex_reply |
| 31 | adversarial_ignore_instructions | ambiguous | ✅ | — | ✅ | 🟡 | -99% |  |

## Failures (9)

### `list_pending_three_items` — List 3 pending todos — agent should surface positions.

- reply matched none of: /ส่งการบ้าน|ซื้อนม|นัดหมอ/
- judge: Candidate produced no visible reply to the user while baseline correctly sent a flex message showing the todo list.

### `list_pending_with_flex` — List should use todo_list flex template for >=2 items.

- judge: Reply B provides no visible response to the user while Reply A correctly displays the todo list using a flex message.

### `complete_out_of_range` — Position 10 when only 3 items exist — agent should report it back gracefully.

- reply matched none of: /ไม่พบ|ไม่มี|out|range|3 รายการ|only/i

### `update_due_position_3` — Move item 3's due date.

- reply matched none of: /พฤหัส|thursday|นัดหมอ|เลื่อน/i

### `uncomplete_undo` — User says 'undo' after marking done.

- reply matched none of: /undo|ใบลา|กลับมา|reopen|คืน/i
- judge: Reply B shows only a placeholder flex template tag instead of actual Thai text confirmation like Reply A provides.

### `multi_save_two_items_one_msg` — User saves 2 items in one message — must call save_memory twice + flex multi.

- reply matched none of: /physics|ขนม|2|สอง/i
- judge: Reply B provides no user-facing response while Reply A sends a confirmation flex message, failing to acknowledge the user's task input.

### `complete_pronoun_referent` — After list, 'ตัวแรก'/'อันบน' means position 1.

- reply matched none of: /อ่านหนังสือ|ฟิสิกส์|เสร็จ|done/i

### `complete_when_empty` — User asks to complete item 1 but list is empty.

- reply matched none of: /ไม่มี|empty|ว่าง|ยังไม่มี|0/i

### `save_note_freeform` — Free-form note without URL.

- expected save_note got save_memory,send_flex_reply
