// Minimal in-memory chrome.storage for unit tests.
function createArea() {
    let data = {};
    const pick = (keys) => {
        if (keys == null) return structuredClone(data);
        const list = typeof keys === 'string' ? [keys] : keys;
        return Object.fromEntries(
            list.filter((k) => k in data).map((k) => [k, structuredClone(data[k])]),
        );
    };
    return {
        get: async (keys) => pick(keys),
        set: async (items) => {
            data = { ...data, ...structuredClone(items) };
        },
        remove: async (keys) => {
            for (const key of typeof keys === 'string' ? [keys] : keys) delete data[key];
        },
        clear: async () => {
            data = {};
        },
        dump: () => structuredClone(data),
    };
}

export function installChromeMock() {
    globalThis.chrome = {
        storage: { sync: createArea(), local: createArea(), session: createArea() },
    };
    return globalThis.chrome;
}
