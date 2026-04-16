# References for Sync Waves Seed Data

## Similar Implementations

### Seed script

- **Location:** `backend/scripts/seed.py`
- **Relevance:** Shows how waves.json and projects.json are consumed — fields seeded, ordering, FK dependency (waves seeded before projects).

### Wave model

- **Location:** `backend/app/models/wave.py`
- **Relevance:** Authoritative field list for Wave records.

### Existing seed data

- **Location:** `backend/scripts/seed_data/waves.json`, `backend/scripts/seed_data/projects.json`
- **Relevance:** Format reference for seed entries.
