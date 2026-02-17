/**
 * Safe LocalStorage utility to prevent crashes when parsing invalid JSON.
 */

export const storage = {
    get: <T>(key: string, defaultValue: T): T => {
        try {
            const item = localStorage.getItem(key);
            if (item === null) return defaultValue;

            const parsed = JSON.parse(item);
            // Ensure we don't return null if the default is a non-null object
            if (parsed === null && defaultValue !== null) return defaultValue;

            return parsed as T;
        } catch (err) {
            console.warn(`[Storage] Failed to parse key "${key}":`, err);
            return defaultValue;
        }
    },

    set: (key: string, value: any): void => {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (err) {
            console.error(`[Storage] Failed to save key "${key}":`, err);
        }
    },

    remove: (key: string): void => {
        localStorage.removeItem(key);
    }
};
