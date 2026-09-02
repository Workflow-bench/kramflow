// Vitest-only stub for the "server-only" package. The real package
// unconditionally throws — Next's bundler aliases it away at build time
// so the throw never actually executes; it exists purely as a lint-time
// guard against importing server code from a Client Component. Vitest
// runs modules directly in Node with no such bundler step, so
// vitest.config.ts aliases "server-only" to this empty module instead.
export {};
