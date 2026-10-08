import { EventEmitter } from "node:events";

export interface CoreEvents {
  "menu.replaced": { storeId: number; storeName: string; menuVersion: number };
  "submission.created": { submissionId: number; submittedBy: number; storeName: string };
  "submission.reviewed": { submissionId: number; status: "approved" | "rejected"; storeId?: number };
}

export type CoreEventName = keyof CoreEvents;

export class CoreEventBus {
  private emitter = new EventEmitter();

  emit<K extends CoreEventName>(name: K, payload: CoreEvents[K]): void {
    this.emitter.emit(name, payload);
    this.emitter.emit("*", { name, payload });
  }

  on<K extends CoreEventName>(name: K, handler: (payload: CoreEvents[K]) => void): () => void {
    this.emitter.on(name, handler);
    return () => this.emitter.off(name, handler);
  }

  onAny(handler: (e: { name: CoreEventName; payload: unknown }) => void): () => void {
    this.emitter.on("*", handler);
    return () => this.emitter.off("*", handler);
  }
}
