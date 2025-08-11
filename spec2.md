# Post-MVP Spec: WebContainers Integration for **Convexa**

## Executive Summary

Introduce WebContainers—StackBlitz’s browser-native micro-OS that runs Node.js entirely inside the user’s tab—to deliver live, isolated previews of generated applications with  **zero new server infrastructure** . Startup time is sub-2 seconds, and everything happens client-side, so the Convex backend and existing agent pipeline remain unchanged.**youtube**[webcontainers](https://webcontainers.io/)

---

## 1. Objectives

1. Let users run and hot-reload their generated Next.js apps instantly in the browser.
2. Avoid provisioning or managing Docker/VM servers in this phase.
3. Preserve current Convex data model; add only minimal tables for environment metadata.
4. Provide graceful fallback for non-Chromium browsers.

---

## 2. Architecture Overview

| Layer              | Change                                   | Details                                                                             |
| ------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| Frontend (Next.js) | **New `/play/[projectId]`route** | Mounts a `<WebContainerPlayground>`component embedding the WebContainer instance. |
| Agent & Artifacts  | **No change**                      | Still output Next.js project files; WebContainer reads them via virtual FS.         |
| Convex Backend     | **New table `envs`**             | Stores per-project WebContainer config (Node version, preview port).                |
| Hosting / Infra    | **None**                           | All execution happens in the user’s browser; no new servers.                       |

Diagram:

<pre class="not-prose w-full rounded font-mono text-sm font-extralight"><div class="codeWrapper text-light selection:text-super selection:bg-super/10 bg-offset my-md relative flex flex-col rounded font-mono text-sm font-normal"><div class="translate-y-xs -translate-x-xs bottom-xl mb-xl sticky top-0 flex h-0 items-start justify-end"><button data-testid="copy-code-button" type="button" class="focus-visible:bg-offsetPlus hover:bg-offsetPlus text-quiet  hover:text-foreground dark:hover:bg-offsetPlus font-sans focus:outline-none outline-none outline-transparent transition duration-300 ease-out font-sans  select-none items-center relative group/button  justify-center text-center items-center rounded-full cursor-pointer active:scale-[0.97] active:duration-150 active:ease-outExpo origin-center whitespace-nowrap inline-flex text-sm h-8 aspect-square"><div class="flex items-center min-w-0 font-medium gap-1.5 justify-center"><div class="flex shrink-0 items-center justify-center size-4"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7999999999999998" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-copy "><path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z"></path><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"></path></svg></div></div></button></div><div class="-mt-xl"><div><div data-testid="code-language-indicator" class="text-quiet bg-offsetPlus py-xs px-sm inline-block rounded-br rounded-tl-[3px] font-thin">text</div></div><div class="pr-lg"><span><code><span><span>Browser ──▶ WebContainer (WASM, SW)
</span></span><span>          │   ├─ Node.js runtime
</span><span>          │   └─ Virtual FS (project files pulled from Convex)
</span><span>          ▼
</span><span>Generated App (Next.js dev server on port 3000)
</span><span></span></code></span></div></div></div></pre>

---

## 3. Key Concepts

| Term                        | Meaning                                                                                                                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **WebContainer**      | WASM-powered micro-OS running Node.js, npm & dev servers directly in the tab.                                                                                                |
| **Virtual FS Sync**   | Artifacts fetched from Convex and written into the WebContainer file system before boot.                                                                                     |
| **Preview Proxy**     | Service-worker proxy that forwards the internal port (3000) to an iframe origin[developer.stackblitz](https://developer.stackblitz.com/platform/webcontainers/browser-support). |
| **COOP/COEP Headers** | Cross-Origin Isolation headers required for WebContainers to access shared-memory APIs[webcontainers**+1**](https://webcontainers.io/guides/browser-support).                   |

---

## 4. Implementation Plan

## 4.1 Dependencies

<pre class="not-prose w-full rounded font-mono text-sm font-extralight"><div class="codeWrapper text-light selection:text-super selection:bg-super/10 bg-offset my-md relative flex flex-col rounded font-mono text-sm font-normal"><div class="translate-y-xs -translate-x-xs bottom-xl mb-xl sticky top-0 flex h-0 items-start justify-end"><button data-testid="copy-code-button" type="button" class="focus-visible:bg-offsetPlus hover:bg-offsetPlus text-quiet  hover:text-foreground dark:hover:bg-offsetPlus font-sans focus:outline-none outline-none outline-transparent transition duration-300 ease-out font-sans  select-none items-center relative group/button  justify-center text-center items-center rounded-full cursor-pointer active:scale-[0.97] active:duration-150 active:ease-outExpo origin-center whitespace-nowrap inline-flex text-sm h-8 aspect-square"><div class="flex items-center min-w-0 font-medium gap-1.5 justify-center"><div class="flex shrink-0 items-center justify-center size-4"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7999999999999998" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-copy "><path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z"></path><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"></path></svg></div></div></button></div><div class="-mt-xl"><div><div data-testid="code-language-indicator" class="text-quiet bg-offsetPlus py-xs px-sm inline-block rounded-br rounded-tl-[3px] font-thin">text</div></div><div class="pr-lg"><span><code><span><span>bun i @stackblitz/webcontainer-api
</span></span><span></span></code></span></div></div></div></pre>

## 4.2 Next.js Frontend

1. **`/play/[projectId]/page.tsx`**

   <pre class="not-prose w-full rounded font-mono text-sm font-extralight"><div class="codeWrapper text-light selection:text-super selection:bg-super/10 bg-offset my-md relative flex flex-col rounded font-mono text-sm font-normal"><div class="translate-y-xs -translate-x-xs bottom-xl mb-xl sticky top-0 flex h-0 items-start justify-end"><button data-testid="copy-code-button" type="button" class="focus-visible:bg-offsetPlus hover:bg-offsetPlus text-quiet  hover:text-foreground dark:hover:bg-offsetPlus font-sans focus:outline-none outline-none outline-transparent transition duration-300 ease-out font-sans  select-none items-center relative group/button  justify-center text-center items-center rounded-full cursor-pointer active:scale-[0.97] active:duration-150 active:ease-outExpo origin-center whitespace-nowrap inline-flex text-sm h-8 aspect-square"><div class="flex items-center min-w-0 font-medium gap-1.5 justify-center"><div class="flex shrink-0 items-center justify-center size-4"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7999999999999998" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-copy "><path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z"></path><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"></path></svg></div></div></button></div><div class="-mt-xl"><div><div data-testid="code-language-indicator" class="text-quiet bg-offsetPlus py-xs px-sm inline-block rounded-br rounded-tl-[3px] font-thin">tsx</div></div><div class="pr-lg"><span><code><span><span class="token token">export</span><span></span><span class="token token">default</span><span></span><span class="token token">async</span><span></span><span class="token token">function</span><span></span><span class="token token">Play</span><span class="token token punctuation">(</span><span class="token token punctuation">{</span><span> params </span><span class="token token punctuation">}</span><span class="token token punctuation">)</span><span></span><span class="token token punctuation">{</span><span>
   </span></span><span><span></span><span class="token token">const</span><span> project </span><span class="token token operator">=</span><span></span><span class="token token">await</span><span></span><span class="token token">getProject</span><span class="token token punctuation">(</span><span>params</span><span class="token token punctuation">.</span><span>projectId</span><span class="token token punctuation">)</span><span class="token token punctuation">;</span><span>
   </span></span><span><span></span><span class="token token">return</span><span></span><span class="token token operator"><</span><span>WebContainerPlayground project</span><span class="token token operator">=</span><span class="token token punctuation">{</span><span>project</span><span class="token token punctuation">}</span><span></span><span class="token token operator">/</span><span class="token token operator">></span><span class="token token punctuation">;</span><span>
   </span></span><span><span></span><span class="token token punctuation">}</span><span>
   </span></span><span></span></code></span></div></div></div></pre>
2. **`WebContainerPlayground.tsx`**

   1. Load WebContainer via dynamic `import('@stackblitz/webcontainer-api')`.
   2. Pull artifacts (`/api/artifacts?projectId=X`) → write each `{path, content}` into virtual FS.
   3. `webcontainer.spawn('npm', ['run', 'dev'])`.
   4. Expose `server.on('port', p => iframe.src = \`/preview.html?port=${p}`)`.
3. **`/public/preview.html`**

   Tiny page with `<iframe>` that rewrites requests to the internal port via the service-worker proxy.

## 4.3 Convex Backend

<pre class="not-prose w-full rounded font-mono text-sm font-extralight"><div class="codeWrapper text-light selection:text-super selection:bg-super/10 bg-offset my-md relative flex flex-col rounded font-mono text-sm font-normal"><div class="translate-y-xs -translate-x-xs bottom-xl mb-xl sticky top-0 flex h-0 items-start justify-end"><button data-testid="copy-code-button" type="button" class="focus-visible:bg-offsetPlus hover:bg-offsetPlus text-quiet  hover:text-foreground dark:hover:bg-offsetPlus font-sans focus:outline-none outline-none outline-transparent transition duration-300 ease-out font-sans  select-none items-center relative group/button  justify-center text-center items-center rounded-full cursor-pointer active:scale-[0.97] active:duration-150 active:ease-outExpo origin-center whitespace-nowrap inline-flex text-sm h-8 aspect-square"><div class="flex items-center min-w-0 font-medium gap-1.5 justify-center"><div class="flex shrink-0 items-center justify-center size-4"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7999999999999998" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-copy "><path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z"></path><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"></path></svg></div></div></button></div><div class="-mt-xl"><div><div data-testid="code-language-indicator" class="text-quiet bg-offsetPlus py-xs px-sm inline-block rounded-br rounded-tl-[3px] font-thin">ts</div></div><div class="pr-lg"><span><code><span><span class="token token">// schema.ts</span><span>
</span></span><span><span></span><span class="token token">table</span><span class="token token punctuation">(</span><span class="token token">"envs"</span><span class="token token punctuation">,</span><span></span><span class="token token punctuation">{</span><span>
</span></span><span><span>  projectId</span><span class="token token operator">:</span><span> v</span><span class="token token punctuation">.</span><span class="token token">id</span><span class="token token punctuation">(</span><span class="token token">"projects"</span><span class="token token punctuation">)</span><span class="token token punctuation">,</span><span>
</span></span><span><span>  nodeVersion</span><span class="token token operator">:</span><span> v</span><span class="token token punctuation">.</span><span class="token token">string</span><span class="token token punctuation">(</span><span class="token token punctuation">)</span><span class="token token punctuation">,</span><span></span><span class="token token">// e.g., "18"</span><span>
</span></span><span><span>  startCommand</span><span class="token token operator">:</span><span> v</span><span class="token token punctuation">.</span><span class="token token">string</span><span class="token token punctuation">(</span><span class="token token punctuation">)</span><span class="token token punctuation">,</span><span></span><span class="token token">// default "npm run dev"</span><span>
</span></span><span><span>  createdAt</span><span class="token token operator">:</span><span> v</span><span class="token token punctuation">.</span><span class="token token">number</span><span class="token token punctuation">(</span><span class="token token punctuation">)</span><span class="token token punctuation">,</span><span>
</span></span><span><span></span><span class="token token punctuation">}</span><span class="token token punctuation">)</span><span class="token token punctuation">;</span><span>
</span></span><span></span></code></span></div></div></div></pre>

## 4.4 Cross-Origin Isolation

Add in `next.config.mjs`:

<pre class="not-prose w-full rounded font-mono text-sm font-extralight"><div class="codeWrapper text-light selection:text-super selection:bg-super/10 bg-offset my-md relative flex flex-col rounded font-mono text-sm font-normal"><div class="translate-y-xs -translate-x-xs bottom-xl mb-xl sticky top-0 flex h-0 items-start justify-end"><button data-testid="copy-code-button" type="button" class="focus-visible:bg-offsetPlus hover:bg-offsetPlus text-quiet  hover:text-foreground dark:hover:bg-offsetPlus font-sans focus:outline-none outline-none outline-transparent transition duration-300 ease-out font-sans  select-none items-center relative group/button  justify-center text-center items-center rounded-full cursor-pointer active:scale-[0.97] active:duration-150 active:ease-outExpo origin-center whitespace-nowrap inline-flex text-sm h-8 aspect-square"><div class="flex items-center min-w-0 font-medium gap-1.5 justify-center"><div class="flex shrink-0 items-center justify-center size-4"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7999999999999998" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-copy "><path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z"></path><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"></path></svg></div></div></button></div><div class="-mt-xl"><div><div data-testid="code-language-indicator" class="text-quiet bg-offsetPlus py-xs px-sm inline-block rounded-br rounded-tl-[3px] font-thin">js</div></div><div class="pr-lg"><span><code><span><span class="token token">headers</span><span class="token token punctuation">(</span><span class="token token punctuation">)</span><span></span><span class="token token punctuation">{</span><span>
</span></span><span><span></span><span class="token token">return</span><span></span><span class="token token punctuation">[</span><span>
</span></span><span><span></span><span class="token token punctuation">{</span><span>
</span></span><span><span></span><span class="token token literal-property property">source</span><span class="token token operator">:</span><span></span><span class="token token">'/(.*)'</span><span class="token token punctuation">,</span><span>
</span></span><span><span></span><span class="token token literal-property property">headers</span><span class="token token operator">:</span><span></span><span class="token token punctuation">[</span><span>
</span></span><span><span></span><span class="token token punctuation">{</span><span></span><span class="token token literal-property property">key</span><span class="token token operator">:</span><span></span><span class="token token">'Cross-Origin-Opener-Policy'</span><span class="token token punctuation">,</span><span></span><span class="token token literal-property property">value</span><span class="token token operator">:</span><span></span><span class="token token">'same-origin'</span><span></span><span class="token token punctuation">}</span><span class="token token punctuation">,</span><span>
</span></span><span><span></span><span class="token token punctuation">{</span><span></span><span class="token token literal-property property">key</span><span class="token token operator">:</span><span></span><span class="token token">'Cross-Origin-Embedder-Policy'</span><span class="token token punctuation">,</span><span></span><span class="token token literal-property property">value</span><span class="token token operator">:</span><span></span><span class="token token">'require-corp'</span><span></span><span class="token token punctuation">}</span><span class="token token punctuation">,</span><span>
</span></span><span><span></span><span class="token token punctuation">]</span><span class="token token punctuation">,</span><span>
</span></span><span><span></span><span class="token token punctuation">}</span><span class="token token punctuation">,</span><span>
</span></span><span><span></span><span class="token token punctuation">]</span><span class="token token punctuation">;</span><span>
</span></span><span><span></span><span class="token token punctuation">}</span><span>
</span></span><span></span></code></span></div></div></div></pre>

Required for SharedArrayBuffer used by WebContainers.[developer.stackblitz](https://developer.stackblitz.com/platform/webcontainers/browser-config)

## 4.5 Browser Compatibility Check

<pre class="not-prose w-full rounded font-mono text-sm font-extralight"><div class="codeWrapper text-light selection:text-super selection:bg-super/10 bg-offset my-md relative flex flex-col rounded font-mono text-sm font-normal"><div class="translate-y-xs -translate-x-xs bottom-xl mb-xl sticky top-0 flex h-0 items-start justify-end"><button data-testid="copy-code-button" type="button" class="focus-visible:bg-offsetPlus hover:bg-offsetPlus text-quiet  hover:text-foreground dark:hover:bg-offsetPlus font-sans focus:outline-none outline-none outline-transparent transition duration-300 ease-out font-sans  select-none items-center relative group/button  justify-center text-center items-center rounded-full cursor-pointer active:scale-[0.97] active:duration-150 active:ease-outExpo origin-center whitespace-nowrap inline-flex text-sm h-8 aspect-square"><div class="flex items-center min-w-0 font-medium gap-1.5 justify-center"><div class="flex shrink-0 items-center justify-center size-4"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7999999999999998" stroke-linecap="round" stroke-linejoin="round" class="tabler-icon tabler-icon-copy "><path d="M7 7m0 2.667a2.667 2.667 0 0 1 2.667 -2.667h8.666a2.667 2.667 0 0 1 2.667 2.667v8.666a2.667 2.667 0 0 1 -2.667 2.667h-8.666a2.667 2.667 0 0 1 -2.667 -2.667z"></path><path d="M4.012 16.737a2.005 2.005 0 0 1 -1.012 -1.737v-10c0 -1.1 .9 -2 2 -2h10c.75 0 1.158 .385 1.5 1"></path></svg></div></div></button></div><div class="-mt-xl"><div><div data-testid="code-language-indicator" class="text-quiet bg-offsetPlus py-xs px-sm inline-block rounded-br rounded-tl-[3px] font-thin">ts</div></div><div class="pr-lg"><span><code><span><span class="token token">if</span><span></span><span class="token token punctuation">(</span><span class="token token operator">!</span><span>WebContainer</span><span class="token token punctuation">.</span><span>boot</span><span class="token token punctuation">)</span><span></span><span class="token token punctuation">{</span><span>
</span></span><span><span></span><span class="token token">return</span><span></span><span class="token token operator"><</span><span>FallbackNotice </span><span class="token token operator">/</span><span class="token token operator">></span><span class="token token punctuation">;</span><span>
</span></span><span><span></span><span class="token token punctuation">}</span><span>
</span></span><span></span></code></span></div></div></div></pre>

Serve GIF demo or cloud build link when unsupported (Safari/Firefox).

## 4.6 Security Considerations

1. WebContainers cannot access host FS or network beyond the page origin; risk surface is minimal.**youtube**
2. Limit CPU via `window.navigator.hardwareConcurrency`.
3. Sanitize artifacts to prevent `<script>` injection in static HTML files.

## 4.7 Telemetry & Metrics

* Store boot time, memory usage, and syntax-error counts in new Convex `metrics` table.
* Emit `wc_boot_ms`, `wc_ready_ms`, `wc_error` fields.

## 4.8 Testing

1. Unit: mock WebContainer API with Jest.
2. E2E: Playwright script that loads `/play/:id`, waits for “Server ready”.
3. Manual: verify hot-reload edits inside WebContainer propagate.

---

## 5. Timeline & Milestones

| Day | Task                                                       |
| --- | ---------------------------------------------------------- |
| 1-2 | Install lib, add COOP/COEP headers, create `/play`route. |
| 3-4 | Write virtual FS sync + spawn logic.                       |
| 5   | Proxy & iframe preview plumbing.                           |
| 6   | Convex `envs`+ metrics, telemetry hooks.                 |
| 7   | Browser-compat fallback, basic E2E tests.                  |
| 8   | Demo recording, docs update, internal alpha.               |

---

## 6. Acceptance Criteria

* Users on Chrome/Edge load `/play/:id` and see their app running in < 3 s.
* Hot-reload works on file edits made in the embedded editor.
* No server-side resources beyond existing Convex are added.
* Fallback notice renders on Safari/Firefox without breaking the site.
* Telemetry logs `wc_boot_ms` for > 90% of sessions.

---

## 7. Risks & Mitigations

| Risk                                    | Mitigation                                                  |
| --------------------------------------- | ----------------------------------------------------------- |
| Browser incompatibility                 | Detect feature; provide cloud build fallback.               |
| Large project size slows boot           | Stream artifacts in chunks; compress content.               |
| SharedArrayBuffer blocked by extensions | Add try/catch; advise users to disable blocking extensions. |

---

## 8. Future Extensions

1. **Code Editor Collaboration** : Embed Monaco + CRDT to live-edit files within WebContainer.
2. **Deploy Button** : One-click Vercel deployment using project artifacts.
3. **Persistent Snapshots** : Save WebContainer FS state back to Convex for resumed sessions.
4. **Multi-runtime Support** : Route non-JS stacks to Docker provider phase-2.

---

## 9. References

* StackBlitz WebContainers introduction video (bolt.new launch)**youtube**
* WebContainers technical docs: browser support & API[developer.stackblitz**+1**](https://developer.stackblitz.com/platform/webcontainers/browser-support)
* “Node.js in the Browser with WebContainers” deep dive[monogram](https://monogram.io/blog/node.js-in-the-browser-with-webcontainers)
* Cross-Origin isolation requirements for SharedArrayBuffer[webcontainers](https://webcontainers.io/guides/browser-support)
* WebContainers startup benchmarks (< 2 s)[webcontainers](https://webcontainers.io/)

---

This spec delivers isolated, full-stack previews with  **minimal operational overhead** , setting the stage for later Docker-based expansion.

1. [https://www.youtube.com/watch?v=knLe8zzwNRA](https://www.youtube.com/watch?v=knLe8zzwNRA)
2. [https://webcontainers.io](https://webcontainers.io/)
3. [https://developer.stackblitz.com/platform/webcontainers/browser-support](https://developer.stackblitz.com/platform/webcontainers/browser-support)
4. [https://webcontainers.io/guides/browser-support](https://webcontainers.io/guides/browser-support)
5. [https://developer.stackblitz.com/platform/webcontainers/browser-config](https://developer.stackblitz.com/platform/webcontainers/browser-config)
6. [https://monogram.io/blog/node.js-in-the-browser-with-webcontainers](https://monogram.io/blog/node.js-in-the-browser-with-webcontainers)
