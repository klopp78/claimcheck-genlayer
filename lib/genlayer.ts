import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

export const CLAIMCHECK_CONTRACT_ADDRESS =
  "0x8dB841C6958547155283AD48Ff2B9B7be03BB42d" as const;

export type WalletAddress = `0x${string}`;

export type ClaimCheckInput = {
  walletAddress: WalletAddress;
  claim: string;
  sourceUrls: string[];
};

export function createClaimCheckClient(walletAddress?: WalletAddress) {
  return createClient({
    chain: studionet,
    account: walletAddress,
  });
}

export async function readLatestClaimCheckResult(
  walletAddress?: WalletAddress,
) {
  const client = createClaimCheckClient(walletAddress);

  return client.readContract({
    address: CLAIMCHECK_CONTRACT_ADDRESS,
    functionName: "get_latest_result",
    args: [],
    jsonSafeReturn: true,
    leaderOnly: true,
  });
}

export async function submitClaimCheck({
  walletAddress,
  claim,
  sourceUrls,
}: ClaimCheckInput) {
  const client = createClaimCheckClient(walletAddress);
  await client.connect("studionet");

  const hash = await client.writeContract({
    address: CLAIMCHECK_CONTRACT_ADDRESS,
    functionName: "adjudicate_claim",
    args: [claim, sourceUrls],
    value: BigInt(0),
    leaderOnly: false,
  });

  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  });

  return { hash, receipt };
}
