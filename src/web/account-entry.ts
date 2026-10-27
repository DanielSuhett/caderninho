const { mountAccount } = await import("./mount-account");
mountAccount();

// Module scope for top-level await; the entry has no static imports.
export {};
