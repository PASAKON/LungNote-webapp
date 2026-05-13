# Eval Report

- **Cases**: 31
- **Candidate**: `google/gemini-2.5-flash`
- **Baseline**:  `anthropic/claude-sonnet-4-5`
- **Judge**:     `(see judge.jsonl)`

## Headline

| Metric | Value |
|---|---|
| Tool match | 28/31 (90.3%) |
| Tool-args match (where asserted) | 30/31 |
| Reply pattern match | 25/31 |
| Judge equivalent (yes+partial) | 26/31 (83.9%) |
| Judge yes / partial / no | 20 / 6 / 5 |
| Cost (baseline → candidate) | $0.7833 → $0.0111 (Δ -98.6%) |
| Latency p50 | 7876ms → 4162ms (Δ -47.2%) |

## Per-case

| # | Case | Cat | Tool | Args | Reply | Judge | Cost Δ | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | save_simple_no_date | save | ✅ | ✅ | ✅ | ✅ | -98% |  |
| 2 | save_with_tomorrow | save | ✅ | ✅ | ✅ | ✅ | -98% |  |
| 3 | save_with_specific_date | save | ✅ | ✅ | ✅ | ✅ | -98% |  |
| 4 | save_ambiguous_test_word | ambiguous | ✅ | — | ✅ | ✅ | -99% |  |
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
| 15 | update_text_position_2 | update | ✅ | ✅ | ✅ | ✅ | -99% |  |
| 16 | update_due_position_3 | update | ❌ | ❌ | ✅ | ❌ | -99% | expected update_by_position got list_pending; missing call update_by_position#1 |
| 17 | uncomplete_undo | uncomplete | ✅ | ✅ | ❌ | ❌ | -98% | reply matched none of: /undo|ใบลา|กลับมา|reopen|คืน/i |
| 18 | dashboard_link_request | dashboard_link | ✅ | — | ✅ | 🟡 | -98% |  |
| 19 | profile_set_timezone | profile_memory | ✅ | — | ✅ | ❌ | -98% |  |
| 20 | multi_save_two_items_one_msg | multi_bubble | ✅ | — | ❌ | ✅ | -98% | reply matched none of: /physics|ขนม|2|สอง/i |
| 21 | greeting_no_tools | ambiguous | ✅ | — | ✅ | 🟡 | -99% |  |
| 22 | thanks_no_tools | ambiguous | ✅ | — | ✅ | ✅ | -98% |  |
| 23 | save_mixed_language | save | ✅ | ✅ | — | ✅ | -98% |  |
| 24 | save_typo | save | ✅ | ✅ | — | ✅ | -98% |  |
| 25 | complete_pronoun_referent | complete | ✅ | ✅ | ❌ | ✅ | -98% | reply matched none of: /อ่านหนังสือ|ฟิสิกส์|เสร็จ|done/i |
| 26 | list_then_complete | complete | ❌ | — | ✅ | 🟡 | -99% | expected list_pending,complete_by_position got complete_by_position,send_flex_re |
| 27 | complete_when_empty | error_path | ✅ | — | ❌ | ✅ | -99% | reply matched none of: /ไม่มี|empty|ว่าง|ยังไม่มี|0/i |
| 28 | save_with_time_only | save | ✅ | ✅ | — | ✅ | -98% |  |
| 29 | save_note_url | save | ✅ | ✅ | ✅ | ✅ | -98% |  |
| 30 | save_note_freeform | save | ❌ | — | ✅ | ✅ | -98% | expected save_note got save_memory,send_flex_reply |
| 31 | adversarial_ignore_instructions | ambiguous | ✅ | — | ✅ | 🟡 | -99% |  |

## Failures (11)

### `list_pending_three_items` — List 3 pending todos — agent should surface positions.

- reply matched none of: /ส่งการบ้าน|ซื้อนม|นัดหมอ/
- judge: Candidate produced no reply to the user while baseline sent the todo list via Flex message.

### `list_pending_with_flex` — List should use todo_list flex template for >=2 items.

- judge: Reply B provides no visible response to the user while Reply A sends the requested todo list.

### `complete_out_of_range` — Position 10 when only 3 items exist — agent should report it back gracefully.

- reply matched none of: /ไม่พบ|ไม่มี|out|range|3 รายการ|only/i

### `update_due_position_3` — Move item 3's due date.

- expected update_by_position got list_pending
- missing call update_by_position#1
- judge: Reply A completed the task by updating the item, while Reply B only asked for confirmation without performing the update.

### `uncomplete_undo` — User says 'undo' after marking done.

- reply matched none of: /undo|ใบลา|กลับมา|reopen|คืน/i
- judge: Reply A successfully undoes the action and confirms completion, while Reply B only asks for confirmation without actually performing the undo.

### `profile_set_timezone` — User reveals stable fact — agent stores via update_memory.

- judge: Baseline invoked the correct memory update tool but gave no user feedback, while candidate acknowledged the user in Thai but failed to invoke the necessary tool.

### `multi_save_two_items_one_msg` — User saves 2 items in one message — must call save_memory twice + flex multi.

- reply matched none of: /physics|ขนม|2|สอง/i

### `complete_pronoun_referent` — After list, 'ตัวแรก'/'อันบน' means position 1.

- reply matched none of: /อ่านหนังสือ|ฟิสิกส์|เสร็จ|done/i

### `list_then_complete` — User asks to see list AND complete one in same message.

- expected list_pending,complete_by_position got complete_by_position,send_flex_reply

### `complete_when_empty` — User asks to complete item 1 but list is empty.

- reply matched none of: /ไม่มี|empty|ว่าง|ยังไม่มี|0/i

### `save_note_freeform` — Free-form note without URL.

- expected save_note got save_memory,send_flex_reply
