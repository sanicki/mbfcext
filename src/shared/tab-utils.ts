import { Result, err, ok } from "neverthrow"
import browser from "webextension-polyfill"

import { isDevMode } from "./logger"

export async function getTabById(tabId: number): Promise<Result<browser.Tabs.Tab, null>> {
  try {
    const tabInfo = await browser.tabs.get(tabId)
    return ok(tabInfo)
  } catch (error) {
    console.error(error)
  }
  return err(null)
}

export async function getCurrentTab(): Promise<Result<browser.Tabs.Tab, null>> {
  return new Promise((resolve) => {
    ;(async () => {
      const hasWindows = typeof browser.windows !== "undefined"

      if (hasWindows) {
        // Desktop path — use window focus to find the right active tab
        const [tabs, wind] = await Promise.all([
          browser.tabs.query({ active: true, currentWindow: true }),
          browser.windows.getLastFocused(),
        ])
        let t: browser.Tabs.Tab | undefined
        tabs.forEach((tab) => {
          if (tab.windowId === wind.id) t = tab
        })
        if (t) return resolve(ok(t))
        if (isDevMode() && tabs.length) return resolve(ok(tabs[0]))
        return resolve(err(null))
      }

      // Android Firefox path — the popup opens as a new tab, so querying
      // { active: true, currentWindow: true } returns the popup itself.
      // Instead, query all tabs and find the most recently accessed one
      // that isn't a browser-internal or extension page.
      const allTabs = await browser.tabs.query({})
      const contentTabs = allTabs.filter(
        (tab) =>
          tab.url &&
          !tab.url.startsWith("moz-extension://") &&
          !tab.url.startsWith("about:") &&
          !tab.url.startsWith("chrome:")
      )

      if (!contentTabs.length) return resolve(err(null))

      // Pick the most recently accessed content tab
      const sorted = contentTabs.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))
      return resolve(ok(sorted[0]))
    })().catch((e) => {
      console.error(e)
      resolve(err(null))
    })
  })
}
