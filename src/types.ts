import { Peer } from "@lumeweb/libhyperproxy";

export interface PeerInfoResult {
  publicKey: Uint8Array;
  libp2pPublicKey: Uint8Array;
}

export type Message = {
  send: (pubkey: Uint8Array | any) => void;
};

export interface PeerEntityMessages {
  keyExchange: Message;
  openSocket: Message;
  writeSocket: Message;
  closeSocket: Message;
  timeoutSocket: Message;
  errorSocket: Message;
}

export interface PeerEntity {
  messages: PeerEntityMessages | Partial<PeerEntityMessages>;
  peer: Peer;
}
export interface SocketRequest {
  remoteId: number;
  id: number;
}
export type CloseSocketRequest = SocketRequest;

export interface WriteSocketRequest extends SocketRequest {
  data: Uint8Array;
}
export interface ErrorSocketRequest extends SocketRequest {
  err: Error;
}
