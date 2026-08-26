# ClaimRegistry for GenLayer

ClaimRegistry is a GenLayer Project that turns public claim verification into a persistent on-chain registry. Each claim check receives its own durable `check_id`, source provenance manifest, evidence hash commitment, submitter address, accepted-write binding, and consensus-produced result instead of overwriting one global result slot.

## Live Demo

- App: https://klopp78.github.io/claimcheck-genlayer/
- Contract Explorer: https://explorer-studio.genlayer.com/address/0x73594e8c3A4A08Bb3fe24d612f2e1A06c23e13A8
- Deployed v3 contract: `0x73594e8c3A4A08Bb3fe24d612f2e1A06c23e13A8`
- v3 contract source: `contracts/claim_registry.py`

## Why v3

The first ClaimCheck version exposed a useful product surface but still had two review weaknesses:

- the contract stored only `latest_result`, so each check overwrote the previous one
- the frontend displayed a local keyword-matching preview before reading a contract result

The v2 registry removed both issues:

- `contracts/claim_registry.py` stores checks in `TreeMap[str, str]`
- `check_ids: DynArray[str]` preserves a readable history of check IDs
- `create_check()` writes a new registry entry for every submitted claim
- `get_check(check_id)` reads any prior check by ID
- `get_latest_check_id()` and `get_check_count()` expose registry metadata
- `app/page.tsx` no longer computes verdicts locally

The v3 source responds to the steward request for stronger evidence handling:

- every source URL must use HTTPS
- duplicate source URLs are rejected before consensus begins
- every accepted check must include at least two independent source hosts
- the contract stores a `source_manifest` with URL, host, source type, and URL hash
- each consensus run retains its observed rendered-source snapshot hashes as evidence
- validator consensus binds to a stable `source_bundle_hash` derived from the normalized URL provenance manifest, never character-exact live HTML
- every registry record stores `accepted_write.check_id`, `registry_sequence`, and `source_bundle_hash`

## GenLayer Integration

- Contract source: `contracts/claim_registry.py`
- GenLayer SDK client: `lib/genlayer.ts`
- Product surface: `app/page.tsx`

The SDK client uses `genlayer-js` on `studionet` and exposes:

- `submitRegistryCheck()` for `writeContract({ functionName: "create_check" })`
- `readRegistryCheck()` for `readContract({ functionName: "get_check" })`
- `readLatestCheckId()` for `readContract({ functionName: "get_latest_check_id" })`
- `readCheckCount()` for `readContract({ functionName: "get_check_count" })`
- `waitForTransactionReceipt({ status: TransactionStatus.ACCEPTED })` for transaction lifecycle tracking

## Contract Behavior

`create_check(claim, source_urls)` requires:

- a claim of at least 12 characters
- two to five HTTPS source URLs
- no duplicate source URLs
- at least two independent source hosts

The contract renders each source page with GenLayer nondeterministic web access, creates a provenance manifest, retains per-run snapshot hashes, asks an LLM to produce a compact JSON verdict, and then validators independently re-run the same adjudication before a registry entry is stored. Validator agreement uses the claim verdict and the stable normalized source-provenance commitment; it does not require dynamic page HTML or snapshot hashes to match character-for-character.

Each stored record includes:

- `check_id`
- `claim`
- `source_urls`
- `source_manifest[].host`
- `source_manifest[].source_type`
- `source_manifest[].url_hash`
- `submitted_by`
- `accepted_write.check_id`
- `accepted_write.registry_sequence`
- `accepted_write.source_bundle_hash`
- `result.verdict`
- `result.confidence`
- `result.source_count`
- `result.unique_hosts`
- `result.matched_sources`
- `result.contradicted_sources`
- `result.source_bundle_hash`
- `result.summary`

## Run Locally

```bash
npm install
npm run dev
```

To submit transactions, use a browser wallet connected to GenLayer Studio.
