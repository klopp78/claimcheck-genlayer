# ClaimCheck for GenLayer

ClaimCheck is a small GenLayer project that turns the deployed Source Credibility Adjudicator Intelligent Contract into a reviewer-facing product. A user enters a claim and two to five public URLs, previews the expected verdict shape, then can read from or submit to the deployed Studio contract through the GenLayer SDK.

## Live Demo

- App: https://klopp78.github.io/claimcheck-genlayer/
- Contract Explorer: https://explorer-studio.genlayer.com/address/0x8dB841C6958547155283AD48Ff2B9B7be03BB42d
- Deployed contract: `0x8dB841C6958547155283AD48Ff2B9B7be03BB42d`

## GenLayer Integration

This repository includes the full Intelligent Contract source and the frontend SDK integration:

- Contract source: `contracts/source_credibility_adjudicator.py`
- GenLayer SDK client: `lib/genlayer.ts`
- Product surface: `app/page.tsx`

The SDK client uses `genlayer-js` on `studionet` and exposes:

- `readLatestClaimCheckResult()` for `readContract({ functionName: "get_latest_result" })`
- `submitClaimCheck()` for `writeContract({ functionName: "adjudicate_claim" })`
- `waitForTransactionReceipt({ status: TransactionStatus.ACCEPTED })` to track the transaction lifecycle

## Contract Behavior

`adjudicate_claim(claim, source_urls)` requires:

- a claim of at least 12 characters
- two to five source URLs

The contract renders source pages with GenLayer nondeterministic web access, asks an LLM to produce a compact JSON verdict, then has validators independently re-run the same adjudication and compare stable fields:

- exact `verdict`
- confidence within 20 points
- exact `source_count`
- matched and contradicted source counts within one source

The accepted result is stored and exposed through `get_latest_result()`.

## Run Locally

```bash
npm install
npm run dev
```

To submit transactions, use a browser wallet connected to GenLayer Studio.
