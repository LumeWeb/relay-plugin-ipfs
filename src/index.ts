import type { Plugin, PluginAPI } from "@lumeweb/relay-types";
import { Peer, Proxy, Socket } from "@lumeweb/libhyperproxy";
// @ts-ignore
import debugStream from "debug-stream";
// @ts-ignore
import toIterable from "stream-to-it";
// @ts-ignore
import { fixed32, raw } from "compact-encoding";
import PeerManager from "./peerManager";

const PROTOCOL = "lumeweb.proxy.ipfs";

interface PeerInfoResult {
  publicKey: Uint8Array;
  libp2pPublicKey: Uint8Array;
}

const plugin: Plugin = {
  name: "ipfs",
  async plugin(api: PluginAPI): Promise<void> {
    api.swarm.join(api.util.crypto.createHash(PROTOCOL));
    const proxy = new Proxy({
      swarm: api.swarm,
      protocol: PROTOCOL,
    });
    api.protocols.register(PROTOCOL, (peer: any, muxer: any) => {
      proxy.handlePeer({
        peer,
        muxer,
        createDefaultMessage: false,
        onchannel(peer: Peer, channel: any) {
          PeerManager.instance(api).handleNewPeerChannel(peer, channel);
        },
        onclose(peer: Peer) {
          PeerManager.instance(api).handleClosePeer(peer);
        },
      });
    });
  },
};

export default plugin;
