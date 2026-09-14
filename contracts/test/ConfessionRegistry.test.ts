// TESTING §4: sukses, duplikat, input invalid, event, exists, tanpa fungsi hapus histori.
import { expect } from 'chai';
import { ethers } from 'hardhat';

const ID = ethers.keccak256(ethers.toUtf8Bytes('c_test1'));
const HASH = ethers.keccak256(ethers.toUtf8Bytes('konten kanonis'));

describe('ConfessionRegistry (T1-020)', () => {
  async function deploy() {
    const Registry = await ethers.getContractFactory('ConfessionRegistry');
    const registry = await Registry.deploy();
    await registry.waitForDeployment();
    return registry;
  }

  it('publish sukses + exists + event berisi commitment', async () => {
    const registry = await deploy();
    const tx = await registry.publish(ID, HASH, '', 1);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);
    const events = await registry.queryFilter(
      registry.filters.ConfessionPublished(ID),
      receipt!.blockNumber,
      receipt!.blockNumber,
    );
    expect(events.length).to.equal(1);
    const ev = events[0] as unknown as { args: { contentHash: string; contentCID: string; timestamp: bigint; version: number } };
    expect(ev.args.contentHash).to.equal(HASH);
    expect(ev.args.contentCID).to.equal('');
    expect(ev.args.timestamp).to.equal(block!.timestamp);
    expect(ev.args.version).to.equal(1);
    expect(await registry.exists(ID)).to.equal(true);
    expect(await registry.exists(ethers.keccak256(ethers.toUtf8Bytes('lain')))).to.equal(false);
  });

  it('duplikat ID revert DuplicateConfession', async () => {
    const registry = await deploy();
    await registry.publish(ID, HASH, '', 1);
    await expect(registry.publish(ID, HASH, '', 1))
      .to.be.revertedWithCustomError(registry, 'DuplicateConfession')
      .withArgs(ID);
  });

  it('input invalid revert', async () => {
    const registry = await deploy();
    const zero = '0x0000000000000000000000000000000000000000000000000000000000000000';
    await expect(registry.publish(zero, HASH, '', 1)).to.be.revertedWithCustomError(registry, 'EmptyConfessionId');
    await expect(registry.publish(ID, zero, '', 1)).to.be.revertedWithCustomError(registry, 'EmptyContentHash');
    await expect(registry.publish(ID, HASH, `x`.repeat(129), 1)).to.be.revertedWithCustomError(registry, 'CidTooLong');
  });

  it('CID 128 char diterima (batas gas wajar)', async () => {
    const registry = await deploy();
    const id2 = ethers.keccak256(ethers.toUtf8Bytes('c_test2'));
    await expect(registry.publish(id2, HASH, 'b'.repeat(128), 1)).to.emit(registry, 'ConfessionPublished');
  });

  it('tidak ada fungsi hapus/ubah histori', async () => {
    const registry = await deploy();
    for (const fn of ['remove', 'delete', 'update', 'rewrite', 'hide']) {
      expect((registry as unknown as Record<string, unknown>)[fn]).to.equal(undefined);
    }
  });
});
