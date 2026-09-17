import { ethers, network } from 'hardhat';

// Deploy ConfessionRegistry. Tulis alamat ke stdout + deployed/<network>.json.
// - localhost: npx hardhat run scripts/deploy.ts --network localhost (butuh node jalan)
// - sepolia: DEPLOYER_KEY + RPC_URL wajib (kunci HANYA via env/secret manager).
// P0 #5: pisahkan DEPLOYER_KEY vs PUBLISHER_KEY. Bila PUBLISHER_KEY di-set dan
// berbeda dari deployer, deploy script memberi otorisasi publisher tersebut
// (revoke/rotasi berikutnya via setPublisher oleh owner — lihat runbook redeploy).
async function main() {
  if (!process.env.RPC_URL && network.name !== 'hardhat' && network.name !== 'localhost') {
    throw new Error('RPC_URL belum di-set');
  }
  const [deployer] = await ethers.getSigners();
  console.log(`deployer: ${deployer.address}`);
  const Registry = await ethers.getContractFactory('ConfessionRegistry');
  const registry = await Registry.deploy();
  await registry.waitForDeployment();
  const address = await registry.getAddress();
  console.log(`ConfessionRegistry: ${address}`);
  const deploymentBlock = await ethers.provider.getBlockNumber();

  let publisher = deployer.address;
  const extraKey = process.env.PUBLISHER_KEY;
  if (extraKey && extraKey !== '0x') {
    const { Wallet } = await import('ethers');
    const pub = new Wallet(extraKey.startsWith('0x') ? extraKey : `0x${extraKey}`).address;
    if (pub.toLowerCase() !== deployer.address.toLowerCase()) {
      const tx = await registry.setPublisher(pub, true);
      await tx.wait();
      publisher = pub;
      console.log(`publisher authorized: ${pub}`);
    }
  }

  const { writeFileSync, mkdirSync } = await import('node:fs');
  mkdirSync('deployed', { recursive: true });
  const artefact = {
    address,
    network: network.name,
    chainId: network.config.chainId ?? null,
    deployer: deployer.address,
    publisher,
    block: deploymentBlock,
  };
  writeFileSync(`deployed/${network.name}.json`, JSON.stringify(artefact, null, 2) + '\n');
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
