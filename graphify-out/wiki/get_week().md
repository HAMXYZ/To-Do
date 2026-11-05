# get_week()

> God node · 13 connections · [D:\BT\To-Do\BE\src\routers\weeks.py](file:///D:/BT/To-Do/BE/src/routers/weeks.py#L72)

## Call Trace Diagram

```mermaid
sequenceDiagram
    participant P0 as get_week()
    participant P1 as _outs()
    participant P2 as update_task()
    participant P3 as Task
    participant P4 as today
    participant P5 as utc_now()
    participant P6 as _parse_time()
    participant P7 as _get_task()
    participant P8 as _steps_for()
    participant P9 as upsert_log()
    participant P10 as _get_category()
    participant P11 as update_habit_log()
    participant P12 as list_trash()
    participant P13 as create_task()
    participant P14 as _out()
    participant P15 as carry_over()
    participant P16 as list_tasks()
    participant P17 as search_tasks()
    participant P18 as overdue_tasks()
    participant P19 as restore_task()
    participant P20 as DayStat
    participant P21 as WeekStats
    participant P22 as HabitWeekOut
    participant P23 as WeekResponse
    participant P24 as _active()
    participant P25 as round_half_up()
    participant P26 as week_progress()
    participant P27 as _habit_out()
    participant P28 as _order()
    P0->>+ P1: calls
    P1-->>- P0: return
    P1->>+ P0: calls
    P0-->>- P1: return
    P1->>+ P2: calls
    P2-->>- P1: return
    P2->>+ P3: calls
    P3-->>- P2: return
    P2->>+ P1: calls
    P1-->>- P2: return
    P2->>+ P4: calls
    P4-->>- P2: return
    P2->>+ P5: calls
    P5-->>- P2: return
    P2->>+ P6: calls
    P6-->>- P2: return
    P2->>+ P7: calls
    P7-->>- P2: return
    P2->>+ P8: calls
    P8-->>- P2: return
    P2->>+ P9: calls
    P9-->>- P2: return
    P2->>+ P10: calls
    P10-->>- P2: return
    P1->>+ P8: calls
    P8-->>- P1: return
    P8->>+ P1: calls
    P1-->>- P8: return
    P8->>+ P2: calls
    P2-->>- P8: return
    P8->>+ P11: calls
    P11-->>- P8: return
    P8->>+ P12: calls
    P12-->>- P8: return
    P1->>+ P13: calls
    P13-->>- P1: return
    P1->>+ P7: calls
    P7-->>- P1: return
    P1->>+ P14: calls
    P14-->>- P1: return
    P1->>+ P15: calls
    P15-->>- P1: return
    P1->>+ P16: calls
    P16-->>- P1: return
    P1->>+ P17: calls
    P17-->>- P1: return
    P1->>+ P18: calls
    P18-->>- P1: return
    P1->>+ P19: calls
    P19-->>- P1: return
    P0->>+ P4: calls
    P4-->>- P0: return
    P0->>+ P20: calls
    P20-->>- P0: return
    P0->>+ P21: calls
    P21-->>- P0: return
    P0->>+ P22: calls
    P22-->>- P0: return
    P0->>+ P23: calls
    P23-->>- P0: return
    P0->>+ P24: calls
    P24-->>- P0: return
    P0->>+ P25: calls
    P25-->>- P0: return
    P0->>+ P26: calls
    P26-->>- P0: return
    P0->>+ P27: calls
    P27-->>- P0: return
    P0->>+ P28: calls
    P28-->>- P0: return
```

## Connections by Relation

### calls
- [[_outs()]] `INFERRED`
- [[today]] `INFERRED`
- [[DayStat]] `EXTRACTED`
- [[WeekStats]] `EXTRACTED`
- [[HabitWeekOut]] `EXTRACTED`
- [[WeekResponse]] `EXTRACTED`
- [[_active()]] `INFERRED`
- [[round_half_up()]] `INFERRED`
- [[week_progress()]] `INFERRED`
- [[_habit_out()]] `INFERRED`
- [[_order()]] `INFERRED`

### contains
- [[weeks.py]] `EXTRACTED`

### rationale_for
- [[Lấy dữ liệu toàn bộ của một tuần ISO: tasks, thống kê 7 ngày, thống kê tuần, hab]] `EXTRACTED`

---

*Part of the graphify knowledge wiki. See [[index]] to navigate.*