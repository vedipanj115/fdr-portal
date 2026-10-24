# Automation (Hetakshi)

Planned modules:

| Module | What it does |
| --- | --- |
| `ocr/` | Reads uploaded FDR PDFs/images (Tesseract or EasyOCR) and extracts FDR number, bank, amount, dates |
| `rules/` | Compares claimed vs extracted vs bank values; flags mismatches, missing fields, duplicates, maturity before required period |
| `scheduler/` | Daily job: reminders at 90/60/30/7 days before maturity, escalation to admin if unresolved |
| `mock_bank/` | Small API that pretends to be a bank: `GET /verify?fdrNumber=&bank=` returns the bank's record |
| `time_machine/` | Runs the scheduler with a fake "today" so reminders can be demoed live |

Output format must match the `verification` object in `docs/api-contract.md`.

Use sample FDRs with fake data only — never real bank documents.
