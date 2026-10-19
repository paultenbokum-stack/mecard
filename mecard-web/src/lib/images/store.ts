import { promises as fs } from "node:fs";
import path from "node:path";

// Where image bytes live. Production uses two Cloud Storage buckets (media,
// and the Archive-class bucket holding every original WordPress upload);
// local development reads wp-content/uploads from the checkout.
export interface BlobStore {
  /** The object's bytes, or null if it doesn't exist. */
  read(key: string): Promise<Buffer | null>;
  write(key: string, data: Buffer, contentType: string): Promise<void>;
}

export class LocalStore implements BlobStore {
  constructor(private readonly root: string) {}

  private file(key: string) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error(`Key escapes store: ${key}`);
    return full;
  }

  async read(key: string) {
    try {
      return await fs.readFile(this.file(key));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT" || (e as NodeJS.ErrnoException).code === "EISDIR") return null;
      throw e;
    }
  }

  async write(key: string, data: Buffer) {
    const f = this.file(key);
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, data);
  }
}

type Fetch = typeof fetch;
type TokenSource = () => Promise<string>;

const METADATA_TOKEN_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

/** Access token for the Cloud Run service account, cached until shortly before expiry. */
export function metadataToken(fetchImpl: Fetch = fetch, now: () => number = Date.now): TokenSource {
  let cached: { token: string; until: number } | null = null;
  return async () => {
    if (cached && cached.until > now()) return cached.token;
    const res = await fetchImpl(METADATA_TOKEN_URL, { headers: { "Metadata-Flavor": "Google" } });
    if (!res.ok) throw new Error(`Metadata token request failed: ${res.status}`);
    const body = (await res.json()) as { access_token: string; expires_in: number };
    cached = { token: body.access_token, until: now() + (body.expires_in - 60) * 1000 };
    return cached.token;
  };
}

/** Cloud Storage over its JSON API: no client library needed for two calls. */
export class GcsStore implements BlobStore {
  constructor(
    private readonly bucket: string,
    private readonly token: TokenSource = metadataToken(),
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  async read(key: string) {
    const url = `https://storage.googleapis.com/storage/v1/b/${this.bucket}/o/${encodeURIComponent(key)}?alt=media`;
    const res = await this.fetchImpl(url, { headers: { Authorization: `Bearer ${await this.token()}` } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`GCS read ${this.bucket}/${key} failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  async write(key: string, data: Buffer, contentType: string) {
    const url = `https://storage.googleapis.com/upload/storage/v1/b/${this.bucket}/o?uploadType=media&name=${encodeURIComponent(key)}`;
    const res = await this.fetchImpl(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${await this.token()}`, "Content-Type": contentType },
      body: new Uint8Array(data),
    });
    if (!res.ok) throw new Error(`GCS write ${this.bucket}/${key} failed: ${res.status}`);
  }
}
