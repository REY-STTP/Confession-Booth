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

  it('publish sukses + exists + event berisi commitment + publisher', async () => {
    const registry = await deploy();
    const [owner] = await ethers.getSigners();
    const tx = await registry.publish(ID, HASH, '', 1);
    const receipt = await tx.wait();
    const block = await ethers.provider.getBlock(receipt!.blockNumber);
    const events = await registry.queryFilter(
      registry.filters.ConfessionPublished(ID),
      receipt!.blockNumber,
      receipt!.blockNumber,
    );
    expect(events.length).to.equal(1);
    const ev = events[0] as unknown as {
      args: {
        contentHash: string;
        publisher: string;
        contentCID: string;
        timestamp: bigint;
        version: number;
      };
    };
    expect(ev.args.contentHash).to.equal(HASH);
    expect(ev.args.publisher).to.equal(owner.address);
    expect(ev.args.contentCID).to.equal('');
    expect(ev.args.timestamp).to.equal(block!.timestamp);
    expect(ev.args.version).to.equal(1);
    expect(await registry.exists(ID)).to.equal(true);
    expect(await registry.exists(ethers.keccak256(ethers.toUtf8Bytes('lain')))).to.equal(false);
  });

  it('P0 #5: non-publisher tidak bisa publish / front-run ID (NotPublisher)', async () => {
    const registry = await deploy();
    const [, alice] = await ethers.getSigners();
    const asAlice = registry.connect(alice) as unknown as typeof registry;
    await expect(asAlice.publish(ID, HASH, '', 1))
      .to.be.revertedWithCustomError(registry, 'NotPublisher')
      .withArgs(alice.address);
    expect(await registry.exists(ID)).to.equal(false);
  });

  it('P0 #5: setPublisher grant/revoke + guard owner & zero address', async () => {
    const registry = await deploy();
    const [owner, alice] = await ethers.getSigners();
    const asAlice = registry.connect(alice) as unknown as typeof registry;
    expect(await registry.owner()).to.equal(owner.address);
    expect(await registry.publishers(owner.address)).to.equal(true);
    // Bukan owner tidak bisa kelola allowlist.
    await expect(asAlice.setPublisher(alice.address, true))
      .to.be.revertedWithCustomError(registry, 'NotOwner')
      .withArgs(alice.address);
    // Zero address ditolak.
    await expect(registry.setPublisher(ethers.ZeroAddress, true)).to.be.revertedWithCustomError(
      registry,
      'ZeroAddress',
    );
    // Grant → alice bisa publish; revoke → revert lagi.
    await expect(registry.setPublisher(alice.address, true))
      .to.emit(registry, 'PublisherUpdated')
      .withArgs(alice.address, true);
    await asAlice.publish(ID, HASH, '', 1);
    expect(await registry.exists(ID)).to.equal(true);
    await registry.setPublisher(alice.address, false);
    const id2 = ethers.keccak256(ethers.toUtf8Bytes('c_p0_revoke'));
    await expect(asAlice.publish(id2, HASH, '', 1))
      .to.be.revertedWithCustomError(registry, 'NotPublisher')
      .withArgs(alice.address);
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
    await expect(registry.publish(zero, HASH, '', 1)).to.be.revertedWithCustomError(
      registry,
      'EmptyConfessionId',
    );
    await expect(registry.publish(ID, zero, '', 1)).to.be.revertedWithCustomError(
      registry,
      'EmptyContentHash',
    );
    await expect(registry.publish(ID, HASH, `x`.repeat(129), 1)).to.be.revertedWithCustomError(
      registry,
      'CidTooLong',
    );
  });

  it('CID 128 char diterima (batas gas wajar)', async () => {
    const registry = await deploy();
    const id2 = ethers.keccak256(ethers.toUtf8Bytes('c_test2'));
    await expect(registry.publish(id2, HASH, 'b'.repeat(128), 1)).to.emit(
      registry,
      'ConfessionPublished',
    );
  });

  it('P2 #16: version selain PROTOCOL_VERSION revert InvalidVersion', async () => {
    const registry = await deploy();
    await expect(registry.publish(ID, HASH, '', 0))
      .to.be.revertedWithCustomError(registry, 'InvalidVersion')
      .withArgs(0);
    await expect(registry.publish(ID, HASH, '', 65535))
      .to.be.revertedWithCustomError(registry, 'InvalidVersion')
      .withArgs(65535);
  });

  it('P2 #16: CID charset — spasi/markup ditolak, CID valid diterima', async () => {
    const registry = await deploy();
    await expect(registry.publish(ID, HASH, 'cid with space', 1)).to.be.revertedWithCustomError(
      registry,
      'InvalidCid',
    );
    await expect(registry.publish(ID, HASH, 'cid<script>', 1)).to.be.revertedWithCustomError(
      registry,
      'InvalidCid',
    );
    const id2 = ethers.keccak256(ethers.toUtf8Bytes('c_cid_ok'));
    await expect(
      registry.publish(id2, HASH, 'bafkreihdwdcefgh4dqkjv67uzcmw7ojee6xedzdetojuzjevtenxquvyku', 1),
    ).to.emit(registry, 'ConfessionPublished');
  });

  it('P2 #16: publishBatch — 2 item + event, mismatch revert, duplikat revert', async () => {
    const registry = await deploy();
    const idA = ethers.keccak256(ethers.toUtf8Bytes('c_batch_a'));
    const idB = ethers.keccak256(ethers.toUtf8Bytes('c_batch_b'));
    await expect(registry.publishBatch([idA, idB], [HASH, HASH], ['', 'bafkcid'], 1)).to.emit(
      registry,
      'ConfessionPublished',
    );
    expect(await registry.exists(idA)).to.equal(true);
    expect(await registry.exists(idB)).to.equal(true);
    await expect(registry.publishBatch([idA], [HASH, HASH], ['', ''], 1))
      .to.be.revertedWithCustomError(registry, 'LengthMismatch')
      .withArgs();
    const idC = ethers.keccak256(ethers.toUtf8Bytes('c_batch_c'));
    await expect(registry.publishBatch([idC, idC], [HASH, HASH], ['', ''], 1))
      .to.be.revertedWithCustomError(registry, 'DuplicateConfession')
      .withArgs(idC);
    const [, alice] = await ethers.getSigners();
    const asAlice = registry.connect(alice) as unknown as typeof registry;
    await expect(asAlice.publishBatch([idC], [HASH], [''], 1))
      .to.be.revertedWithCustomError(registry, 'NotPublisher')
      .withArgs(alice.address);
  });

  it('P2 #16: front-run squat — attacker kena NotPublisher sebelum Duplicate', async () => {
    const registry = await deploy();
    const [owner, alice] = await ethers.getSigners();
    const target = ethers.keccak256(ethers.toUtf8Bytes('c_squat_target'));
    // Attacker duluan dengan ID yang sama → tetap NotPublisher (bukan Duplicate).
    const asAlice = registry.connect(alice) as unknown as typeof registry;
    await expect(asAlice.publish(target, HASH, '', 1))
      .to.be.revertedWithCustomError(registry, 'NotPublisher')
      .withArgs(alice.address);
    // Publisher sah tetap bisa publish ID itu.
    await registry.publish(target, HASH, '', 1);
    expect(await registry.exists(target)).to.equal(true);
    expect(owner.address).to.not.equal(alice.address);
  });

  it('P2 #16: exists(0x0) false + ABI tepat (tanpa fungsi hapus/ubah)', async () => {
    const registry = await deploy();
    const zero = '0x0000000000000000000000000000000000000000000000000000000000000000';
    expect(await registry.exists(zero)).to.equal(false);
    const fns = new Set(
      registry.interface.fragments
        .filter((f) => f.type === 'function')
        .map((f) => (f as unknown as { name: string }).name),
    );
    const expected = [
      'MAX_CID_LEN',
      'PROTOCOL_VERSION',
      'exists',
      'owner',
      'publish',
      'publishBatch',
      'publishers',
      'setPublisher',
    ].sort();
    expect([...fns].sort()).to.deep.equal(expected);
  });

  it('P2 #16: filter event by contentHash (indexed kedua)', async () => {
    const registry = await deploy();
    const addr = await registry.getAddress();
    const tx = await registry.publish(ID, HASH, '', 1);
    const rc = await tx.wait();
    const logs = await ethers.provider.getLogs({
      address: addr,
      topics: [null, null, HASH],
      fromBlock: rc!.blockNumber,
      toBlock: rc!.blockNumber,
    });
    expect(logs.length).to.equal(1);
  });

  it('tidak ada fungsi hapus/ubah histori', async () => {
    const registry = await deploy();
    for (const fn of ['remove', 'delete', 'update', 'rewrite', 'hide']) {
      expect((registry as unknown as Record<string, unknown>)[fn]).to.equal(undefined);
    }
  });
});
