import { ethers, network } from 'hardhat';

// Deployment procedure of nft_context.md §8.6. On Fuji, run it only after a
// human has approved the deployment.

const EXPLORERS: Partial<Record<string, string>> = {
  '43113': 'https://testnet.snowtrace.io',
};

function print(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function main(): Promise<void> {
  const deployer = (await ethers.getSigners())[0];
  if (deployer === undefined) {
    throw new Error(
      `No deployer account for network "${network.name}". ` +
        'Set MINTER_PRIVATE_KEY in apps/backend/nft/.env.',
    );
  }

  // 1. Deployer address, chain ID and balance.
  const chainId = (await ethers.provider.getNetwork()).chainId.toString();
  const balance = await ethers.provider.getBalance(deployer.address);
  const symbol = chainId === '43113' ? 'AVAX' : 'ETH';
  print(`Network:  ${network.name} (chainId ${chainId})`);
  print(`Deployer: ${deployer.address}`);
  print(`Balance:  ${ethers.formatEther(balance)} ${symbol}`);

  // 2. Refuse to continue with an empty balance.
  if (balance === 0n) {
    throw new Error('The deployer balance is zero. Fund the wallet first.');
  }

  // 3. and 4. Deploy with the deployer as owner, then wait for confirmation.
  const contract = await ethers.deployContract(
    'PreservingArt',
    [deployer.address],
    deployer,
  );
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  // 5. Contract address and explorer link.
  print(`PreservingArt deployed at ${address}`);
  const explorer = EXPLORERS[chainId];
  if (explorer !== undefined) {
    print(`Explorer: ${explorer}/address/${address}`);
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
