# Reference data

Loaded with `cd api && uv run python -m app.seed ../data`. One bad record and nothing loads.

- Every record names a source in `sources.yaml`.
- Only official sites (`*.ac.za`, `*.gov.za`, `*.edu.za`, plus a short list in `app/seed.py`).
- `checked_on` stays empty until someone has opened the page and checked it.
- Programmes only count once a second person sets `verified_on`.
- Leave a value out rather than guess it. The app shows "check with the institution".

Still to collect: application windows, programmes and requirements for each
institution, and the two TVET colleges (Central Johannesburg, South West Gauteng).
