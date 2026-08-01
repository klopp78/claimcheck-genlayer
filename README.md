# ClaimRegistry for GenLayer

ClaimRegistry is a GenLayer Project that turns public claim verification into a persistent on-chain registry. Each claim check receives its own durable `check_id`, source list, submitter address, and consensus-produced result instead of overwriting one global result slot.

## Live Demo

- App: https://klopp78.github.io/claimcheck-genlayer/
- Contract Explorer: https://explorer-studio.genlayer.com/address/0xCdBD7da09eBB093d0C925510A24EeeB6BBfeF365
- Deployed v2 contract: `0xCdBD7da09eBB093d0C925510A24EeeB6BBfeF365`

## Why v2

The first ClaimCheck version exposed a useful product surface but still had two review weaknesses:

- the contract stored only `latest_result`, so each check overwrote the previous one
- the frontend displayed a local keyword-matching preview before reading a contract result

This v2 removes both issues:

- `contracts/claim_registry.py` stores checks in `TreeMap[str, str]`
- `check_ids: DynArray[str]` preserves a readable history of check IDs
- `create_check()` writes a new registry entry for every submitted claim
- `get_check(check_id)` reads any prior check by ID
- `get_latest_check_id()` and `get_check_count()` expose registry metadata
- `app/page.tsx` no longer computes verdicts locally

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
- two to five source URLs

The contract renders each source page with GenLayer nondeterministic web access, asks an LLM to produce a compact JSON verdict, and then validators independently re-run the same adjudication before a registry entry is stored.

Each stored record includes:

- `check_id`
- `claim`
- `source_urls`
- `submitted_by`
- `result.verdict`
- `result.confidence`
- `result.source_count`
- `result.matched_sources`
- `result.contradicted_sources`
- `result.summary`

## Run Locally

```bash
npm install
npm run dev
```

To submit transactions, use a browser wallet connected to GenLayer Studio.
