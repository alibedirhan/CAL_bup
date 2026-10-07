// Yalnızca kullanılan MV3 portları. İş kuralları chrome nesnesini bilmez.
type Gonderen = { url?: string; tab?: { id?: number }; frameId?: number; id?: string };
type Dinleyici = (m: unknown, s: Gonderen, yanit: (r: unknown) => void) => boolean | undefined;
interface Depo {
  get(k: string | string[]): Promise<Record<string, unknown>>;
  set(d: Record<string, unknown>): Promise<void>;
  remove(k: string | string[]): Promise<void>;
  setAccessLevel(d: { accessLevel: 'TRUSTED_CONTEXTS' }): Promise<void>;
}
export interface EklentiApi {
  runtime: {
    id: string;
    getManifest(): { version: string };
    sendMessage(m: unknown): Promise<unknown>;
    onMessage: { addListener(f: Dinleyici): void };
  };
  storage: { session: Depo; local: Depo };
  tabs: {
    create(d: { url: string }): Promise<{ id?: number }>;
    /** İçerik betiğine mesaj; `tabs` izni gerektirmez. */
    sendMessage(id: number, m: unknown): Promise<unknown>;
    onRemoved: { addListener(f: (id: number) => void): void };
    onUpdated: { addListener(f: (id: number, d: { url?: string }) => void): void };
  };
  alarms: {
    create(ad: string, d: { when: number }): Promise<void>;
    onAlarm: { addListener(f: () => void): void };
  };
}
export const eklenti = (globalThis as unknown as { chrome: EklentiApi }).chrome;
