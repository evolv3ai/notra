import { type ComponentType, type LazyExoticComponent, lazy } from "react";

/**
 * `React.lazy` with a `preload()` the router can call. TanStack Router warms
 * a route's code by calling `.preload()` on its component and pending
 * component when the route is preloaded (link hover) or loaded, so the chunk
 * downloads alongside the loader instead of after it.
 *
 * Once the chunk is in, `lazy` gets a thenable that resolves synchronously:
 * React only skips suspending when `.then` calls back inside the same call,
 * so a preloaded page renders straight away instead of flashing its fallback.
 */
export function lazyPage<T extends ComponentType<any>>(
  load: () => Promise<{ default: T }>
): LazyExoticComponent<T> & { preload: () => Promise<void> } {
  let pending: Promise<{ default: T }> | undefined;
  let loaded: { default: T } | undefined;
  const loadOnce = () => {
    pending ??= load().then(
      (module) => {
        loaded = module;
        return module;
      },
      (error: unknown) => {
        pending = undefined;
        throw error;
      }
    );
    return pending;
  };
  const resolve = () => {
    const module = loaded;
    if (!module) {
      return loadOnce();
    }
    const settled = {
      then: (onFulfilled: (value: { default: T }) => unknown) => {
        onFulfilled(module);
      },
    };
    return settled as unknown as Promise<{ default: T }>;
  };
  return Object.assign(lazy(resolve), {
    preload: () => loadOnce().then(() => undefined),
  });
}
