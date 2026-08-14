"use client";

import { useMemo, useState } from "react";
import {
  CLAIM_REGISTRY_CONTRACT_ADDRESS,
  readCheckCount,
  readLatestCheckId,
  readRegistryCheck,
  submitRegistryCheck,
  type WalletAddress,
} from "@/lib/genlayer";

const repoUrl = "https://github.com/klopp78/claimcheck-genlayer";
const contractRepoUrl =
  "https://github.com/klopp78/claimcheck-genlayer/tree/main/contracts";
const explorerUrl =
  `https://explorer-studio.genlayer.com/address/${CLAIM_REGISTRY_CONTRACT_ADDRESS}`;
const xPostUrl = "https://x.com/Galax2u/status/2082509877990260885?s=20";

const starterSources = [
  "https://github.com/klopp78/claimcheck-genlayer",
  "https://docs.genlayer.com/developers/intelligent-contracts/storage",
  "https://docs.genlayer.com/developers/decentralized-applications/writing-data",
];

type ChainStatus =
  | "idle"
  | "connecting"
  | "reading"
  | "submitting"
  | "accepted"
  | "error";

type RegistryRecord = {
  check_id?: string;
  claim?: string;
  source_urls?: string[];
  source_manifest?: {
    source_index?: number;
    url?: string;
    host?: string;
    source_type?: string;
    url_hash?: string;
  }[];
  submitted_by?: string;
  accepted_write?: {
    check_id?: string;
    registry_sequence?: number;
    evidence_bundle_hash?: string;
  };
  result?: {
    verdict?: string;
    confidence?: number;
    source_count?: number;
    unique_hosts?: number;
    matched_sources?: number;
    contradicted_sources?: number;
    evidence_bundle_hash?: string;
    summary?: string;
  };
};

declare global {
  interface Window {
    ethereum?: {
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
    };
  }
}

function parseRecord(value: unknown): RegistryRecord | null {
  if (!value) return null;
  if (typeof value === "object") return value as RegistryRecord;
  if (typeof value !== "string") return null;

  try {
    return JSON.parse(value) as RegistryRecord;
  } catch {
    return null;
  }
}

function shortAddress(value: string) {
  if (value.length < 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

export default function Home() {
  const [claim, setClaim] = useState(
    "ClaimRegistry v3 preserves each GenLayer claim check with source provenance, evidence hashes, and an accepted-write check ID.",
  );
  const [sources, setSources] = useState(starterSources.join("\n"));
  const [walletAddress, setWalletAddress] = useState<WalletAddress | null>(
    null,
  );
  const [checkId, setCheckId] = useState("");
  const [checkCount, setCheckCount] = useState("0");
  const [latestCheckId, setLatestCheckId] = useState("");
  const [chainStatus, setChainStatus] = useState<ChainStatus>("idle");
  const [chainMessage, setChainMessage] = useState(
    "Use the deployed registry contract, connect a Studio wallet, then create or read checks from on-chain state. The repository includes the v3 source update for provenance and evidence hashes.",
  );
  const [txHash, setTxHash] = useState("");
  const [rawRecord, setRawRecord] = useState("");

  const parsedSources = useMemo(
    () =>
      sources
        .split("\n")
        .map((source) => source.trim())
        .filter(Boolean)
        .slice(0, 5),
    [sources],
  );
  const record = useMemo(() => parseRecord(rawRecord), [rawRecord]);
  const result = record?.result;

  async function connectWallet() {
    if (!window.ethereum) {
      setChainStatus("error");
      setChainMessage("No browser wallet was detected.");
      return;
    }

    try {
      setChainStatus("connecting");
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const [account] = accounts as string[];
      if (!account) throw new Error("Wallet did not return an account.");

      setWalletAddress(account as WalletAddress);
      setChainStatus("idle");
      setChainMessage("Wallet connected. Registry reads and writes are ready.");
    } catch (error) {
      setChainStatus("error");
      setChainMessage(error instanceof Error ? error.message : "Wallet failed.");
    }
  }

  async function refreshRegistry() {
    try {
      setChainStatus("reading");
      const [countValue, latestValue] = await Promise.all([
        readCheckCount({ walletAddress: walletAddress ?? undefined }),
        readLatestCheckId({ walletAddress: walletAddress ?? undefined }),
      ]);
      const nextLatest = String(latestValue ?? "");
      setCheckCount(String(countValue ?? "0"));
      setLatestCheckId(nextLatest);
      setCheckId((current) => current || nextLatest);
      setChainStatus("idle");
      setChainMessage("Registry metadata loaded from the deployed registry contract.");
    } catch (error) {
      setChainStatus("error");
      setChainMessage(
        error instanceof Error
          ? error.message
          : "Could not read registry metadata.",
      );
    }
  }

  async function readCheck(id = checkId) {
    if (!id) {
      setChainStatus("error");
      setChainMessage("Enter a check ID or load the latest ID first.");
      return;
    }

    try {
      setChainStatus("reading");
      const value = await readRegistryCheck(id, {
        walletAddress: walletAddress ?? undefined,
      });
      setRawRecord(
        typeof value === "string" ? value : JSON.stringify(value, null, 2),
      );
      setCheckId(id);
      setChainStatus("idle");
      setChainMessage(`Check ${id} loaded from contract storage.`);
    } catch (error) {
      setChainStatus("error");
      setChainMessage(
        error instanceof Error ? error.message : "Could not read that check.",
      );
    }
  }

  async function readLatestCheck() {
    try {
      setChainStatus("reading");
      const latestValue = await readLatestCheckId({
        walletAddress: walletAddress ?? undefined,
      });
      const id = String(latestValue ?? "");
      setLatestCheckId(id);
      await readCheck(id);
    } catch (error) {
      setChainStatus("error");
      setChainMessage(
        error instanceof Error ? error.message : "Could not read latest check.",
      );
    }
  }

  async function submitCheck() {
    if (!walletAddress) {
      setChainStatus("error");
      setChainMessage("Connect a wallet before submitting a registry entry.");
      return;
    }

    try {
      setChainStatus("submitting");
      setRawRecord("");
      const submitted = await submitRegistryCheck({
        walletAddress,
        claim,
        sourceUrls: parsedSources,
      });
      setTxHash(submitted.hash);
      setLatestCheckId(submitted.latestCheckId);
      setCheckId(submitted.latestCheckId);
      setRawRecord(
        typeof submitted.check === "string"
          ? submitted.check
          : JSON.stringify(submitted.check, null, 2),
      );
      setChainStatus("accepted");
      setChainMessage(
        `Transaction accepted. Check ${submitted.latestCheckId} is now stored in the registry.`,
      );
      await refreshRegistry();
    } catch (error) {
      setChainStatus("error");
      setChainMessage(
        error instanceof Error
          ? error.message
          : "The Studio transaction was not accepted.",
      );
    }
  }

  return (
    <main className="min-h-screen bg-[#f7f4ef] text-[#171411]">
      <section className="border-b border-[#ddd4c7] bg-[#f7f4ef]">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#386f5c]">
              GenLayer registry project
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#171411] md:text-5xl">
              ClaimRegistry for GenLayer
            </h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="pill" href={repoUrl} target="_blank">
              GitHub
            </a>
            <a className="pill" href={contractRepoUrl} target="_blank">
              Contract
            </a>
            <a className="pill" href={explorerUrl} target="_blank">
              Explorer
            </a>
            <a className="pill" href={xPostUrl} target="_blank">
              Launch post
            </a>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-0 px-5 py-6 md:grid-cols-[1.02fr_0.98fr] md:px-8 md:py-8">
        <div className="tool-surface border-[#ddd4c7] md:border-r">
          <div className="mb-6 flex flex-col gap-2">
            <h2 className="text-xl font-semibold">Create a registry check</h2>
            <p className="max-w-2xl text-sm leading-6 text-[#5c554c]">
              Each submission becomes a persistent on-chain registry entry with
              its own check ID, provenance manifest, evidence hashes, submitter,
              and consensus result. The UI no longer calculates a local verdict.
            </p>
          </div>

          <label className="field-label" htmlFor="claim">
            Claim
          </label>
          <textarea
            id="claim"
            className="input-area min-h-32"
            value={claim}
            onChange={(event) => setClaim(event.target.value)}
          />

          <label className="field-label mt-5" htmlFor="sources">
            Source URLs from at least two hosts
          </label>
          <textarea
            id="sources"
            className="input-area min-h-44"
            value={sources}
            onChange={(event) => setSources(event.target.value)}
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="metric">
              <span>Registry size</span>
              <strong>{checkCount}</strong>
            </div>
            <div className="metric">
              <span>Latest ID</span>
              <strong>{latestCheckId || "-"}</strong>
            </div>
            <div className="metric">
              <span>Sources</span>
              <strong>{parsedSources.length}/5</strong>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-[#d7cec1] bg-[#fffdf8] p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#171411]">
                  Studio registry actions
                </p>
                <p className="mt-1 break-all text-xs leading-5 text-[#746b60]">
                  {walletAddress
                    ? shortAddress(walletAddress)
                    : CLAIM_REGISTRY_CONTRACT_ADDRESS}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="action-button"
                  disabled={chainStatus === "connecting"}
                  onClick={connectWallet}
                  type="button"
                >
                  {walletAddress ? "Wallet ready" : "Connect wallet"}
                </button>
                <button
                  className="action-button"
                  disabled={chainStatus === "reading"}
                  onClick={refreshRegistry}
                  type="button"
                >
                  Refresh registry
                </button>
                <button
                  className="action-button primary"
                  disabled={chainStatus === "submitting"}
                  onClick={submitCheck}
                  type="button"
                >
                  Create check
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <input
                aria-label="Check ID"
                className="text-input"
                onChange={(event) => setCheckId(event.target.value)}
                placeholder="Check ID"
                value={checkId}
              />
              <button
                className="action-button"
                disabled={chainStatus === "reading"}
                onClick={() => readCheck()}
                type="button"
              >
                Read check
              </button>
              <button
                className="action-button"
                disabled={chainStatus === "reading"}
                onClick={readLatestCheck}
                type="button"
              >
                Read latest
              </button>
            </div>

            <p className={`mt-3 text-sm leading-6 ${chainStatus === "error" ? "text-[#9b2c2c]" : "text-[#5c554c]"}`}>
              {chainMessage}
            </p>
            {txHash ? (
              <p className="mt-2 break-all text-xs font-semibold text-[#386f5c]">
                Transaction: {txHash}
              </p>
            ) : null}
          </div>
        </div>

        <aside className="tool-surface bg-[#fffaf2]">
          <div className="result-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#386f5c]">
                  Consensus result
                </p>
                <h2 className="mt-2 text-3xl font-semibold capitalize">
                  {result?.verdict ?? "No check loaded"}
                </h2>
              </div>
              <div className="confidence">
                <span>{result?.confidence ?? "-"}</span>
                <small>/100</small>
              </div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-4">
              <div className="metric">
                <span>Reviewed</span>
                <strong>{result?.source_count ?? "-"}</strong>
              </div>
              <div className="metric">
                <span>Hosts</span>
                <strong>{result?.unique_hosts ?? "-"}</strong>
              </div>
              <div className="metric">
                <span>Matched</span>
                <strong>{result?.matched_sources ?? "-"}</strong>
              </div>
              <div className="metric">
                <span>Contradicted</span>
                <strong>{result?.contradicted_sources ?? "-"}</strong>
              </div>
            </div>

            <p className="mt-6 text-sm leading-6 text-[#5c554c]">
              {result?.summary ??
                "Create or read a check to show the consensus-driven registry result stored by the contract."}
            </p>

            {record ? (
              <div className="mt-5 rounded-lg border border-[#ddd4c7] bg-[#f7f4ef] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#386f5c]">
                  Stored registry entry
                </p>
                <p className="mt-2 text-sm font-semibold">
                  Check #{record.check_id}
                </p>
                <p className="mt-2 break-words text-sm leading-6 text-[#5c554c]">
                  {record.claim}
                </p>
                <p className="mt-2 break-all text-xs text-[#746b60]">
                  Submitter: {record.submitted_by}
                </p>
                <p className="mt-2 break-all text-xs text-[#746b60]">
                  Evidence hash:{" "}
                  {record.accepted_write?.evidence_bundle_hash ??
                    result?.evidence_bundle_hash ??
                    "-"}
                </p>
                <p className="mt-2 break-all text-xs text-[#746b60]">
                  Accepted write ID: {record.accepted_write?.check_id ?? "-"}
                </p>
                {record.source_manifest?.length ? (
                  <ul className="mt-3 space-y-1 text-xs text-[#746b60]">
                    {record.source_manifest.map((source) => (
                      <li key={`${source.source_index}-${source.host}`}>
                        {source.source_index}. {source.host} ·{" "}
                        {source.source_type} · {source.url_hash}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {rawRecord ? (
              <pre className="mt-4 max-h-56 overflow-auto rounded-lg bg-[#171411] p-3 text-xs leading-5 text-[#f7f4ef]">
                {rawRecord}
              </pre>
            ) : null}

            <div className="mt-6 grid gap-3">
              <a className="evidence-link" href={explorerUrl} target="_blank">
                GenLayer Explorer Contract
              </a>
              <a className="evidence-link" href={repoUrl} target="_blank">
                Project source and registry app
              </a>
              <a
                className="evidence-link"
                href={contractRepoUrl}
                target="_blank"
              >
                Persistent registry contract
              </a>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="info-tile">
              <span>Storage model</span>
              <strong>TreeMap registry</strong>
            </div>
            <div className="info-tile">
              <span>Source model</span>
              <strong>Provenance manifest</strong>
            </div>
            <div className="info-tile">
              <span>Evidence model</span>
              <strong>Snapshot hashes</strong>
            </div>
            <div className="info-tile">
              <span>Write binding</span>
              <strong>Accepted check ID</strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="border-t border-[#ddd4c7] bg-[#171411] text-[#f7f4ef]">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 md:grid-cols-3 md:px-8">
          <div>
            <h2 className="text-lg font-semibold">Registry, not latest slot</h2>
            <p className="mt-3 text-sm leading-6 text-[#d7cec1]">
              Every check is stored under a durable ID, so previous claims remain
              readable after new submissions.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Consensus result only</h2>
            <p className="mt-3 text-sm leading-6 text-[#d7cec1]">
              The frontend does not score claims locally. It displays contract
              reads and accepted transaction results.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Provenance path</h2>
            <p className="mt-3 text-sm leading-6 text-[#d7cec1]">
              Each stored check includes source hosts, source types, URL hashes,
              evidence bundle hash, and the accepted write ID.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
