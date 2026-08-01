import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";

export const CLAIM_REGISTRY_CONTRACT_ADDRESS =
  "0xCdBD7da09eBB093d0C925510A24EeeB6BBfeF365" as const;

export type WalletAddress = `0x${string}`;

export type ClaimRegistryInput = {
  walletAddress: WalletAddress;
  claim: string;
  sourceUrls: string[];
};

export type ChainReadOptions = {
  walletAddress?: WalletAddress;
  contractAddress?: `0x${string}`;
};

export function createClaimRegistryClient(walletAddress?: WalletAddress) {
  return createClient({
    chain: studionet,
    account: walletAddress,
  });
}

function registryAddress(contractAddress?: `0x${string}`) {
  return contractAddress ?? CLAIM_REGISTRY_CONTRACT_ADDRESS;
}

export async function readCheckCount(options: ChainReadOptions = {}) {
  const client = createClaimRegistryClient(options.walletAddress);

  return client.readContract({
    address: registryAddress(options.contractAddress),
    functionName: "get_check_count",
    args: [],
    jsonSafeReturn: true,
    leaderOnly: true,
  });
}

export async function readLatestCheckId(options: ChainReadOptions = {}) {
  const client = createClaimRegistryClient(options.walletAddress);

  return client.readContract({
    address: registryAddress(options.contractAddress),
    functionName: "get_latest_check_id",
    args: [],
    jsonSafeReturn: true,
    leaderOnly: true,
  });
}

export async function readRegistryCheck(
  checkId: string,
  options: ChainReadOptions = {},
) {
  const client = createClaimRegistryClient(options.walletAddress);

  return client.readContract({
    address: registryAddress(options.contractAddress),
    functionName: "get_check",
    args: [checkId],
    jsonSafeReturn: true,
    leaderOnly: true,
  });
}

export async function submitRegistryCheck({
  walletAddress,
  claim,
  sourceUrls,
}: ClaimRegistryInput) {
  const client = createClaimRegistryClient(walletAddress);
  await client.connect("studionet");

  const hash = await client.writeContract({
    address: CLAIM_REGISTRY_CONTRACT_ADDRESS,
    functionName: "create_check",
    args: [claim, sourceUrls],
    value: BigInt(0),
    leaderOnly: false,
  });

  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: TransactionStatus.ACCEPTED,
  });

  const latestCheckId = await readLatestCheckId({ walletAddress });
  const check = await readRegistryCheck(String(latestCheckId), {
    walletAddress,
  });

  return { hash, receipt, latestCheckId: String(latestCheckId), check };
}
