import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Standard, StandardCategory, StandardType } from "../engine/types";

const KEY = "standards";

export const StandardService = {
  async getAll(): Promise<Standard[]> {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const parsed: any[] = JSON.parse(raw);
    let dirty = false;
    const migrated: Standard[] = parsed.map((s) => {
      let record = s;
      if ("baseline" in record && !("start" in record)) {
        dirty = true;
        const { baseline, ...rest } = record;
        record = { ...rest, start: baseline };
      }
      if (!("category" in record)) {
        dirty = true;
        record = { ...record, category: "lifts" };
      }
      return record as Standard;
    });
    if (dirty) await AsyncStorage.setItem(KEY, JSON.stringify(migrated));
    return migrated;
  },

  async getById(id: string): Promise<Standard | null> {
    const all = await StandardService.getAll();
    return all.find((s) => s.id === id) ?? null;
  },

  async save(standard: Standard): Promise<void> {
    const all = await StandardService.getAll();
    const idx = all.findIndex((s) => s.id === standard.id);
    if (idx >= 0) {
      all[idx] = standard;
    } else {
      all.push(standard);
    }
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
  },

  async remove(id: string): Promise<void> {
    const all = await StandardService.getAll();
    await AsyncStorage.setItem(KEY, JSON.stringify(all.filter((s) => s.id !== id)));
  },

  async create(
    type: StandardType,
    start: number,
    target: number,
    desiredCompletionDate: string,
    name?: string,
    category: StandardCategory = "lifts"
  ): Promise<Standard> {
    const standard: Standard = {
      id: `${type}-${Date.now()}`,
      type,
      ...(name ? { name } : {}),
      category,
      start,
      target,
      desiredCompletionDate,
      createdAt: new Date().toISOString(),
      status: "active",
    };
    await StandardService.save(standard);
    return standard;
  },
};
