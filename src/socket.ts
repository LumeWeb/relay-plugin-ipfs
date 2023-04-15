import {
  Callback,
  Duplex,
  DuplexEvents,
  EventName,
  EventListener,
} from "streamx";
import net, { TcpSocketConnectOpts } from "net";
import { PeerEntity, SocketRequest, WriteSocketRequest } from "./types";
import PeerManager from "./peerManager";
import { Socket } from "net";

export class TCPSocket extends Duplex {
  private _options;
  private _id: number;
  private _remoteId: number;
  private _manager: PeerManager;

  private _socket?: Socket;

  constructor(
    id: number,
    remoteId: number,
    manager: PeerManager,
    peer: PeerEntity,
    options: TcpSocketConnectOpts
  ) {
    super();
    this._remoteId = remoteId;
    this._manager = manager;
    this._id = id;
    this._peer = peer;
    this._options = options;

    this._manager.sockets.set(this._id, this);
    this._manager.socketMap.set(this._id, this._remoteId);
    console.log(options);
  }

  private _peer;

  get peer() {
    return this._peer;
  }

  public _write(data: any, cb: any): void {
    this._peer.messages.writeSocket?.send({
      ...this._getSocketRequest(),
      data,
    } as WriteSocketRequest);
    cb();
  }

  public _destroy(cb: Callback) {
    this._manager.sockets.delete(this._id);
    this._manager.socketMap.delete(this._id);
    this._peer.messages.closeSocket?.send(this._getSocketRequest());
  }

  public connect() {
    this.on("error", (err: Error) => {
      this._peer.messages.errorSocket?.send({
        ...this._getSocketRequest(),
        err,
      });
    });

    // @ts-ignore
    this.on("timeout", () => {
      this._peer.messages.timeoutSocket?.send(this._getSocketRequest());
    });
    // @ts-ignore
    this.on("connect", () => {
      this._peer.messages.openSocket?.send(this._getSocketRequest());
    });

    if (![4001, 4002].includes(this._options.port)) {
      this.emit("error", new Error(`port ${this._options.port} not allowed`));
      return;
    }

    this._socket = net.connect(this._options);
    ["timeout", "error", "connect", "end", "destroy", "close"].forEach(
      (event) => {
        this._socket?.on(event, (...args: any) =>
          this.emit(event as any, ...args)
        );
      }
    );

    this._socket.pipe(this as any);
    this.pipe(this._socket);
  }

  private _getSocketRequest(): SocketRequest {
    return {
      id: this._id,
      remoteId: this._remoteId,
    };
  }
}
