"use client";

import { useMemo, useState } from "react";
import {
  CLAIMCHECK_CONTRACT_ADDRESS,
  readLatestClaimCheckResult,
  submitClaimCheck,
  type WalletAddress,
} from "@/lib/genlayer";

const repoUrl =
  "https://github.com/klopp78/claimcheck-genlayer";
const contractRepoUrl =
  "https://github.com/klopp78/claimcheck-genlayer/tree/main/contracts";
const explorerUrl =
  `https://explorer-studio.genlayer.com/address/${CLAIMCHECK_CONTRACT_ADDRESS}`;
const xPostUrl = "https://x.com/Galax2u/status/2082509877990260885?s=20";

const starterSources = [
  "https://github.com/klopp78/genlayer-source-credibility-adjudicator",
  "https://explorer-studio.genlayer.com/address/0x8dB841C6958547155283AD48Ff2B9B7be03BB42d",
  "https://x.com/Galax2u/status/2082509877990260885?s=20",
];

type Verdict = "supported" | "mixed" | "insufficient";
type ChainStatus = "idle" | "connecting" | "reading" | "submitting" | "done";

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

function scoreClaim(claim: string, sources: string[]) {
  const usableSources = sources.filter((source) => source.trim().length > 8);
  const normalized = `${claim} ${usableSources.join(" ")}`.toLowerCase();
  const strongSignals = [
    "github",
    "explorer",
    "genlayer",
    "contract",
    "source",
    "validator",
    "consensus",
  ].filter((word) => normalized.includes(word)).length;

  let verdict: Verdict = "insufficient";
  if (usableSources.length >= 3 && strongSignals >= 4) verdict = "supported";
  else if (usableSources.length >= 2 && strongSignals >= 2) verdict = "mixed";

  const confidence = Math.min(
    92,
    Math.max(38, 34 + usableSources.length * 12 + strongSignals * 5),
  );

  return {
    verdict,
    confidence,
    sourceCount: usableSources.length,
    matchedSources:
      verdict === "supported"
        ? Math.max(2, usableSources.length - 1)
        : verdict === "mixed"
          ? Math.max(1, usableSources.length - 1)
          : Math.min(1, usableSources.length),
    contradictedSources: verdict === "mixed" ? 1 : 0,
  };
}

function verdictLabel(verdict: Verdict) {
  if (verdict === "supported") return "Supported";
  if (verdict === "mixed") return "Mixed";
  return "Insufficient";
}

export default function Home() {
  const [claim, setClaim] = useState(
    "Source Credibility Adjudicator is a reusable GenLayer Intelligent Contract for checking public claims against multiple web sources.",
  );
  const [sources, setSources] = useState(starterSources.join("\n"));
  const [walletAddress, setWalletAddress] = useState<WalletAddress | null>(
    null,
  );
  const [chainStatus, setChainStatus] = useState<ChainStatus>("idle");
  const [chainMessage, setChainMessage] = useState(
    "Connect a wallet on Studio to read or submit contract-backed checks.",
  );
  const [latestResult, setLatestResult] = useState("");
  const [txHash, setTxHash] = useState("");
  const parsedSources = useMemo(
    () =>
      sources
        .split("\n")
        .map((source) => source.trim())
        .filter(Boolean)
        .slice(0, 5),
    [sources],
  );
  const result = useMemo(
    () => scoreClaim(claim, parsedSources),
    [claim, parsedSources],
  );

  async function connectWallet() {
    if (!window.ethereum) {
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
      setChainMessage("Wallet connected. Studio contract calls are ready.");
      setChainStatus("done");
    } catch (error) {
      setChainStatus("idle");
      setChainMessage(error instanceof Error ? error.message : "Wallet failed.");
    }
  }

  async function readOnchainResult() {
    try {
      setChainStatus("reading");
      const resultText = await readLatestClaimCheckResult(
        walletAddress ?? undefined,
      );
      setLatestResult(
        typeof resultText === "string"
          ? resultText
          : JSON.stringify(resultText, null, 2),
      );
      setChainMessage("Latest contract result loaded from GenLayer Studio.");
      setChainStatus("done");
    } catch (error) {
      setChainStatus("idle");
      setChainMessage(
        error instanceof Error ? error.message : "Could not read the contract.",
      );
    }
  }

  async function submitOnchainCheck() {
    if (!walletAddress) {
      setChainMessage("Connect a wallet before submitting a transaction.");
      return;
    }

    try {
      setChainStatus("submitting");
      const submitted = await submitClaimCheck({
        walletAddress,
        claim,
        sourceUrls: parsedSources,
      });
      setTxHash(submitted.hash);
      setChainMessage("Transaction accepted by GenLayer Studio.");
      setChainStatus("done");
    } catch (error) {
      setChainStatus("idle");
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
              GenLayer builder project
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal text-[#171411] md:text-5xl">
              ClaimCheck for GenLayer
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

      <section className="mx-auto grid max-w-7xl gap-0 px-5 py-6 md:grid-cols-[1.05fr_0.95fr] md:px-8 md:py-8">
        <div className="tool-surface border-[#ddd4c7] md:border-r">
          <div className="mb-6 flex flex-col gap-2">
            <h2 className="text-xl font-semibold">Check a public claim</h2>
            <p className="max-w-2xl text-sm leading-6 text-[#5c554c]">
              Paste a claim and two to five public sources. The preview gives an
              instant local estimate, while the Studio actions below use the
              deployed Intelligent Contract for real read and write calls.
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
            Source URLs
          </label>
          <textarea
            id="sources"
            className="input-area min-h-44"
            value={sources}
            onChange={(event) => setSources(event.target.value)}
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="metric">
              <span>Sources</span>
              <strong>{result.sourceCount}/5</strong>
            </div>
            <div className="metric">
              <span>Matched</span>
              <strong>{result.matchedSources}</strong>
            </div>
            <div className="metric">
              <span>Contradicted</span>
              <strong>{result.contradictedSources}</strong>
            </div>
          </div>

          <div className="mt-5 rounded-lg border border-[#d7cec1] bg-[#fffdf8] p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#171411]">
                  Studio contract actions
                </p>
                <p className="mt-1 break-all text-xs leading-5 text-[#746b60]">
                  {walletAddress ?? CLAIMCHECK_CONTRACT_ADDRESS}
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
                  onClick={readOnchainResult}
                  type="button"
                >
                  Read latest
                </button>
                <button
                  className="action-button primary"
                  disabled={chainStatus === "submitting"}
                  onClick={submitOnchainCheck}
                  type="button"
                >
                  Submit on GenLayer
                </button>
              </div>
            </div>
            <p className="mt-3 text-sm leading-6 text-[#5c554c]">
              {chainMessage}
            </p>
            {txHash ? (
              <p className="mt-2 break-all text-xs font-semibold text-[#386f5c]">
                Transaction: {txHash}
              </p>
            ) : null}
            {latestResult ? (
              <pre className="mt-3 max-h-44 overflow-auto rounded-lg bg-[#171411] p-3 text-xs leading-5 text-[#f7f4ef]">
                {latestResult}
              </pre>
            ) : null}
          </div>
        </div>

        <aside className="tool-surface bg-[#fffaf2]">
          <div className="result-card">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#386f5c]">
                  Preview verdict
                </p>
                <h2 className="mt-2 text-3xl font-semibold">
                  {verdictLabel(result.verdict)}
                </h2>
              </div>
              <div className="confidence">
                <span>{result.confidence}</span>
                <small>/100</small>
              </div>
            </div>

            <div className="mt-8 h-3 overflow-hidden rounded-full bg-[#ebe2d3]">
              <div
                className="h-full rounded-full bg-[#25a06a]"
                style={{ width: `${result.confidence}%` }}
              />
            </div>

            <p className="mt-6 text-sm leading-6 text-[#5c554c]">
              The deployed Intelligent Contract uses nondeterministic web
              rendering and LLM extraction. Validators independently re-run the
              adjudication and compare stable fields instead of accepting a
              single generated answer.
            </p>

            <div className="mt-6 grid gap-3">
              <a className="evidence-link" href={explorerUrl} target="_blank">
                GenLayer Explorer Contract
              </a>
              <a className="evidence-link" href={repoUrl} target="_blank">
                Project source and SDK wiring
              </a>
              <a
                className="evidence-link"
                href={contractRepoUrl}
                target="_blank"
              >
                Contract source in this repo
              </a>
              <a className="evidence-link" href={xPostUrl} target="_blank">
                Public launch announcement
              </a>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <div className="info-tile">
              <span>Contract primitive</span>
              <strong>Claim adjudication</strong>
            </div>
            <div className="info-tile">
              <span>Consensus pattern</span>
              <strong>Independent rerun</strong>
            </div>
            <div className="info-tile">
              <span>Project status</span>
              <strong>Deployed on Studio</strong>
            </div>
            <div className="info-tile">
              <span>Submission path</span>
              <strong>Builder project</strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="border-t border-[#ddd4c7] bg-[#171411] text-[#f7f4ef]">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 md:grid-cols-3 md:px-8">
          <div>
            <h2 className="text-lg font-semibold">Why it exists</h2>
            <p className="mt-3 text-sm leading-6 text-[#d7cec1]">
              Airdrop research, ecosystem announcements, and funding claims
              often move faster than verification. ClaimCheck packages a
              reusable GenLayer contract into a product workflow.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">What reviewers get</h2>
            <p className="mt-3 text-sm leading-6 text-[#d7cec1]">
              Readable source, deployed Explorer evidence, a live product
              surface, and a GenLayer SDK path for reading results and
              submitting adjudication transactions.
            </p>
          </div>
          <div>
            <h2 className="text-lg font-semibold">Next integration</h2>
            <p className="mt-3 text-sm leading-6 text-[#d7cec1]">
              Wallet users can submit new adjudications to the deployed Studio
              contract and read the latest accepted result from the app.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
