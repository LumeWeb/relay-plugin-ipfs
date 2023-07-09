import type { Plugin, PluginAPI } from "@lumeweb/interface-relay";
import { MultiSocketProxy } from "@lumeweb/libhyperproxy";

const PROTOCOL = "lumeweb.proxy.ipfs";

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
