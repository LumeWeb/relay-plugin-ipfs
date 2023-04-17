import type { Plugin, PluginAPI } from "@lumeweb/relay-types";
import { MultiSocketProxy } from "@lumeweb/libhyperproxy";

const PROTOCOL = "lumeweb.proxy.ipfs";

interface PeerInfoResult {
  publicKey: Uint8Array;
  libp2pPublicKey: Uint8Array;
}

const plugin: Plugin = {
  name: "ipfs",
  async plugin(api: PluginAPI): Promise<void> {
    const proxy = new MultiSocketProxy({
      swarm: api.swarm,
      protocol: PROTOCOL,
      allowedPorts: [4001, 4002],
      server: true,
    });
    api.swarm.join(api.util.crypto.createHash(PROTOCOL));
    api.protocols.register(PROTOCOL, (peer: any, muxer: any) => {
      proxy.handlePeer({
        peer,
        muxer,
      });
    });
  },
};

export default plugin;
