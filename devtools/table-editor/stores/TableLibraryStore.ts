import type { PhysicsJson } from '../utils/JsonLoader';
import { openEditorDb, STORE_TABLES } from './EditorDb';

export interface TableDocument {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  linkedSkinId?: string | null;
  physicsJson: PhysicsJson;
}

export type TableCreateInput = Omit<TableDocument, 'id' | 'createdAt' | 'updatedAt'>;

export class TableLibraryStore {
  private db: IDBDatabase | null = null;
  private tables: Map<string, TableDocument> = new Map();
  private listeners: Set<() => void> = new Set();

  private activeTableId: string | null = null;

  async init(): Promise<void> {
    this.db = await openEditorDb();
    await this.loadAll();
  }

  private async loadAll(): Promise<void> {
    if (!this.db) return;

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_TABLES, 'readonly');
      const store = tx.objectStore(STORE_TABLES);
      const request = store.getAll();

      request.onsuccess = () => {
        this.tables.clear();
        for (const table of request.result as TableDocument[]) {
          this.tables.set(table.id, table);
        }
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  setActiveTableId(id: string | null): void {
    this.activeTableId = id;
    try {
      if (id) localStorage.setItem('table-editor-active-table', id);
      else localStorage.removeItem('table-editor-active-table');
    } catch {
      // ignore
    }
  }

  getActiveTableId(): string | null {
    if (this.activeTableId) return this.activeTableId;
    try {
      this.activeTableId = localStorage.getItem('table-editor-active-table');
    } catch {
      // ignore
    }
    return this.activeTableId;
  }

  getActiveTable(): TableDocument | undefined {
    const id = this.getActiveTableId();
    return id ? this.get(id) : undefined;
  }

  get(id: string): TableDocument | undefined {
    return this.tables.get(id);
  }

  getAll(): TableDocument[] {
    return Array.from(this.tables.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  }

  async create(input: TableCreateInput): Promise<TableDocument> {
    const table: TableDocument = {
      ...input,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.save(table);
    return table;
  }

  async save(table: TableDocument): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    table.updatedAt = new Date();

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_TABLES, 'readwrite');
      const store = tx.objectStore(STORE_TABLES);
      const request = store.put(table);

      request.onsuccess = () => {
        this.tables.set(table.id, table);
        this.notify();
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  async delete(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(STORE_TABLES, 'readwrite');
      const store = tx.objectStore(STORE_TABLES);
      const request = store.delete(id);

      request.onsuccess = () => {
        this.tables.delete(id);
        this.notify();
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  async duplicate(id: string): Promise<TableDocument | null> {
    const original = this.get(id);
    if (!original) return null;

    const copy: TableCreateInput = {
      name: `${original.name} (Copy)`,
      linkedSkinId: original.linkedSkinId ?? null,
      physicsJson: structuredClone(original.physicsJson),
    };

    return this.create(copy);
  }

  async clearAll(): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    await new Promise<void>((resolve, reject) => {
      const tx = this.db!.transaction(STORE_TABLES, 'readwrite');
      const store = tx.objectStore(STORE_TABLES);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    this.tables.clear();
    this.activeTableId = null;
    this.setActiveTableId(null);
    this.notify();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach((l) => l());
  }

  private generateId(): string {
    return `table_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
