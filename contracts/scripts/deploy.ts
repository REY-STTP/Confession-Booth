import { ethers, network } from 'hardhat';

// Deploy ConfessionRegistry. Tulis alamat ke stdout + deployed/<network>.json.
// - localhost: npx hardhat run scripts/deploy.ts --network localhost (butuh node jalan)
// - sepolia: DEPLOYER_KEY + RPC_URL wajib (kunci HANYA via env/secret manager).
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`deployer: ${deployer.address}`);
  const Registry = await ethers.getContractFactory('ConfessionRegistry');
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log(`ConfessionRegistry: ${address}`);

  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync('deployed', { recursive: true });
  writeFileSync(`deployed/${network.name}.json`, JSON.stringify({ address, network: network.name }, null, 2) + '\n');
  console.log(`CONTRACT_ADDRESS=${address}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
