import { PluginAPI } from "@lumeweb/relay-types";
import { Peer, Socket } from "@lumeweb/libhyperproxy";
import net from "net";
// @ts-ignore
import { fixed32, json, raw, uint } from "compact-encoding";
import b4a from "b4a";
import {
  CloseSocketRequest,
  ErrorSocketRequest,
  PeerEntity,
  PeerInfoResult,
  SocketRequest,
  WriteSocketRequest,
} from "./types";
import { TCPSocket } from "./socket";
import { serializeError } from "serialize-error";

const socketEncoding = {
  preencode(state: any, m: SocketRequest) {
    uint.preencode(state, m.id);
    uint.preencode(state, m.remoteId);
  },
  encode(state: any, m: SocketRequest) {
    uint.encode(state, m.id);
    uint.encode(state, m.remoteId);
  },
  decode(state: any, m: any): SocketRequest {
    return {
      remoteId: uint.decode(state, m),
      id: uint.decode(state, m),
    };
  },
};

const writeSocketEncoding = {
  preencode(state: any, m: WriteSocketRequest) {
    socketEncoding.preencode(state, m);
    raw.preencode(state, m.data);
  },
  encode(state: any, m: WriteSocketRequest) {
    socketEncoding.encode(state, m);
    raw.encode(state, m.data);
  },
  decode(state: any, m: any): WriteSocketRequest {
    const socket = socketEncoding.decode(state, m);
    return {
      ...socket,
      data: raw.decode(state, m),
    };
  },
};

const errorSocketEncoding = {
  preencode(state: any, m: ErrorSocketRequest) {
    socketEncoding.preencode(state, m);
    json.preencode(state, serializeError(m.err));
  },
  encode(state: any, m: ErrorSocketRequest) {
    socketEncoding.encode(state, m);
    json.encode(state, serializeError(m.err));
  },
};

function idFactory(start: number, step = 1, limit = 2 ** 32) {
  let id = start;

  return function nextId() {
    const nextId = id;
    id += step;
    if (id >= limit) id = start;
    return nextId;
  };
}

const nextSocketId = idFactory(1);

export default class PeerManager {
  private static _instance: PeerManager;
  private _api: PluginAPI;
  private _peers: Map<string, PeerEntity> = new Map<string, PeerEntity>();

  constructor(api: PluginAPI) {
    this._api = api;
  }

  private _sockets = new Map<number, TCPSocket>();

  get sockets(): Map<number, TCPSocket> {
    return this._sockets;
  }

  private _socketMap = new Map<number, number>();

  get socketMap(): Map<number, number> {
    return this._socketMap;
  }

  public static instance(api?: PluginAPI): PeerManager {
    if (!PeerManager._instance) {
      if (!api) {
        throw new Error("api argument required");
      }
      PeerManager._instance = new PeerManager(api as PluginAPI);
    }

    return PeerManager._instance;
  }

  handleNewPeerChannel(peer: Peer, channel: any) {
    this._registerOpenSocketMessage(peer, channel);
    this._registerWriteSocketMessage(peer, channel);
    this._registerCloseSocketMessage(peer, channel);
    this._registerTimeoutSocketMessage(peer, channel);
    this._registerErrorSocketMessage(peer, channel);
  }

  public get(pubkey: Uint8Array): PeerEntity | undefined {
    if (this._peers.has(this._toString(pubkey))) {
      return this._peers.get(this._toString(pubkey)) as PeerEntity;
    }

    return undefined;
  }

  public update(pubkey: Uint8Array, data: Partial<PeerEntity>): void {
    const peer = this.get(pubkey) ?? ({} as PeerEntity);

    this._peers.set(this._toString(pubkey), {
      ...peer,
      ...data,
      ...{
        messages: {
          ...peer?.messages,
          ...data?.messages,
        },
      },
    } as PeerEntity);
  }
  async handleClosePeer(peer: Peer) {
    for (const item of this._sockets) {
      if (item[1].peer.peer === peer) {
        item[1].end();
      }
    }

    const pubkey = this._toString(peer.socket.remotePublicKey);

    if (this._peers.has(pubkey)) {
      this._peers.delete(pubkey);
    }
  }

  private _registerOpenSocketMessage(peer: Peer, channel: any) {
    const self = this;
    const message = channel.addMessage({
      encoding: {
        ...socketEncoding,
        decode: json.decode,
      },
      async onmessage(m: any) {
        // @ts-ignore
        new TCPSocket(
          nextSocketId(),
          m.id,
          self,
          self.get(peer.socket.remotePublicKey) as PeerEntity,
          m
        ).connect();
      },
    });
    this.update(peer.socket.remotePublicKey, {
      messages: { openSocket: message },
    });
  }

  private _registerWriteSocketMessage(peer: Peer, channel: any) {
    const self = this;
    const message = channel.addMessage({
      encoding: writeSocketEncoding,
      onmessage(m: WriteSocketRequest) {
        self._sockets.get(m.id)?.push(m.data);
      },
    });
    this.update(peer.socket.remotePublicKey, {
      messages: { writeSocket: message },
    });
  }
  private _registerCloseSocketMessage(peer: Peer, channel: any) {
    const self = this;
    const message = channel.addMessage({
      encoding: socketEncoding,
      async onmessage(m: CloseSocketRequest) {
        self._sockets.get(m.id)?.end();
      },
    });
    this.update(peer.socket.remotePublicKey, {
      messages: { closeSocket: message },
    });
  }
  private _registerTimeoutSocketMessage(peer: Peer, channel: any) {
    const message = channel.addMessage({
      encoding: socketEncoding,
    });
    this.update(peer.socket.remotePublicKey, {
      messages: { timeoutSocket: message },
    });
  }
  private _registerErrorSocketMessage(peer: Peer, channel: any) {
    const message = channel.addMessage({
      encoding: errorSocketEncoding,
    });
    this.update(peer.socket.remotePublicKey, {
      messages: { errorSocket: message },
    });
  }

  private _toString(pubkey: Uint8Array) {
    return b4a.from(pubkey).toString("hex");
  }
}
