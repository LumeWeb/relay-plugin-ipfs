import type {
  Plugin,
  PluginAPI,
  RPCRequest,
  RPCResponse,
} from "@lumeweb/relay-types";

import { CID } from "multiformats/cid";
// @ts-ignore
import toStream from "it-to-stream";
import type { StatResult } from "ipfs-core/dist/src/components/files/stat";
import * as IPFS from "ipfs-core";

interface StatFileResponse {
  exists: boolean;
  contentType: string | null;
  error: any;
  directory: boolean;
  files: StatFileSubfile[];
  timeout: boolean;
  size: number;
}

interface StatFileSubfile {
  name: string;
  size: number;
}

let client: IPFS.IPFS;

import { utils } from "ipfs-http-response";

const { detectContentType } = utils;

function normalizeCidPath(path: any) {
  if (path instanceof Uint8Array) {
    return CID.decode(path).toString();
  }

  path = path.toString();

  if (path.indexOf("/ipfs/") === 0) {
    path = path.substring("/ipfs/".length);
  }

  if (path.charAt(path.length - 1) === "/") {
    path = path.substring(0, path.length - 1);
  }

  return path;
}

function normalizePath(
  hash?: string,
  path?: string,
  fullPath?: string
): string {
  if (!fullPath) {
    if (!path) {
      path = "/";
    }

    fullPath = `${hash}/${path}`;
  }

  fullPath = fullPath.replace(/\/{2,}/, "/");
  return normalizeCidPath(fullPath);
}

async function fetchFile(
  hash?: string,
  path?: string,
  fullPath?: string
): Promise<Error | AsyncIterable<Uint8Array>> {
  let data = await fileExists(hash, path, fullPath);

  if (data instanceof Error) {
    return data;
  }

  if (data?.type === "directory") {
    return new Error("ERR_HASH_IS_DIRECTORY");
  }

  return client.cat(data.cid);
}

async function statFile(hash?: string, path?: string, fullPath?: string) {
  let stats: StatFileResponse = {
    exists: false,
    contentType: null,
    error: null,
    directory: false,
    files: [],
    timeout: false,
    size: 0,
  };

  let exists = await fileExists(hash, path, fullPath);
  fullPath = normalizePath(hash, path, fullPath);

  if (exists instanceof Error) {
    stats.error = exists.toString();

    if (exists.message.includes("aborted")) {
      stats.timeout = true;
    }

    return stats;
  }
  stats.exists = true;

  if (exists?.type === "directory") {
    stats.directory = true;
    for await (const item of client.ls(exists.cid)) {
      stats.files.push({
        name: item.name,
        size: item.size,
      } as StatFileSubfile);
    }
    return stats;
  }

  const { size } = await client.files.stat(`/ipfs/${exists.cid}`);
  stats.size = size;

  const { contentType } = await detectContentType(
    fullPath,
    client.cat(exists.cid)
  );
  stats.contentType = contentType ?? null;

  return stats;
}

async function fileExists(
  hash?: string,
  path?: string,
  fullPath?: string
): Promise<Error | StatResult> {
  client = client as IPFS.IPFS;
  let ipfsPath = normalizePath(hash, path, fullPath);
  try {
    const ret = await client.files.stat(`/ipfs/${ipfsPath}`);
    return ret;
  } catch (err: any) {
    return err;
  }
}

async function resolveIpns(
  hash: string,
  path: string
): Promise<string | boolean> {
  for await (const result of client.name.resolve(hash)) {
    return normalizePath(undefined, undefined, `${result}/${path}`);
  }

  return false;
}

const plugin: Plugin = {
  name: "ipfs",
  async plugin(api: PluginAPI): Promise<void> {
    client = await IPFS.create();
    api.registerMethod("stat_ipfs", {
      cacheable: false,
      async handler(request: RPCRequest): Promise<RPCResponse | null> {
        return await statFile(request.data?.hash, request.data?.path);
      },
    });
    api.registerMethod("stat_ipns", {
      cacheable: false,
      async handler(request: RPCRequest): Promise<RPCResponse | null> {
        let ipfsPath = await resolveIpns(
          request.data?.hash,
          request.data?.path
        );
        if (!ipfsPath) {
          throw new Error("ipns lookup failed");
        }
        return statFile(undefined, undefined, ipfsPath as string);
      },
    });
    api.registerMethod("fetch_ipfs", {
      cacheable: false,
      async handler(
        request: RPCRequest,
        sendStream: (stream: AsyncIterable<Uint8Array>) => void
      ): Promise<RPCResponse | null> {
        const ret = await fetchFile(request.data?.hash, request.data?.path);
        if (ret instanceof Error) {
          throw ret;
        }

        sendStream(ret);

        return null;
      },
    });
    api.registerMethod("fetch_ipns", {
      cacheable: false,
      async handler(
        request: RPCRequest,
        sendStream: (stream: AsyncIterable<Uint8Array>) => void
      ): Promise<RPCResponse | null> {
        let ipfsPath = await resolveIpns(
          request.data?.hash,
          request.data?.path
        );
        if (!ipfsPath) {
          throw new Error("ipns lookup failed");
        }
        const ret = await fetchFile(undefined, undefined, ipfsPath as string);
        if (ret instanceof Error) {
          throw ret;
        }

        sendStream(ret);

        return null;
      },
    });
  },
};

export default plugin;
