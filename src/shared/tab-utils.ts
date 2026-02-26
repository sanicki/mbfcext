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

async function isAndroid(): Promise<boolean> {
  try {
    const info = await browser.runtime.getPlatformInfo()
    return info.os === "android"
  } catch {
    return false
  }
}

export async function getCurrentTab(): Promise<Result<browser.Tabs.Tab, null>> {
  return new Promise((resolve) => {
    ;(async () => {
      if (await isAndroid()) {
        // Android Firefox — the popup opens as a new tab, so querying
        // { active: true, currentWindow: true } returns the popup itself.
        // Query all tabs, filter out extension/browser-internal pages,
        // and return the most recently accessed content tab.
        const allTabs = await browser.tabs.query({})
        const contentTabs = allTabs.filter(
          (tab) =>
            tab.url &&
            !tab.url.startsWith("moz-extension://") &&
            !tab.url.startsWith("about:") &&
            !tab.url.startsWith("chrome:")
        )

        if (!contentTabs.length) return resolve(err(null))

        const sorted = contentTabs.sort((a, b) => (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0))
        return resolve(ok(sorted[0]))
      }

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
    })().catch((e) => {
      console.error(e)
      resolve(err(null))
    })
  })
}
