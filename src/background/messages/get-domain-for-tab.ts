import type { PlasmoMessaging } from "@plasmohq/messaging"

import type { PopupDetails } from "~popup"
import { logger } from "~shared"

import { SourcesProcessor } from "../sources-processor"

const log = logger("mbfc:background:messages:get-domain-for-tab")

export const GET_DOMAIN_FOR_TAB = "get-domain-for-tab"

export type GetDomainForTabRequestBody = {
  domain: string
  path: string
}

export type GetDomainForTabResponseBody = {
  site: PopupDetails | null
}

const handler: PlasmoMessaging.MessageHandler<GetDomainForTabRequestBody, GetDomainForTabResponseBody> = async (req, res) => {
  log("Received request", GET_DOMAIN_FOR_TAB, req.body)
  const { domain } = req.body
  const sp = SourcesProcessor.getInstance()
  const response: GetDomainForTabResponseBody = { site: null }

  log(`Domain ${domain} requested`)

  // Always await getSourceData() rather than checking sp.loaded directly.
  // On Android, the background service worker is killed between sessions and
  // sp.loaded will be false when the popup opens — causing an immediate
  // null return. getSourceData() handles the "already loaded" case cheaply
  // (it returns immediately if loaded) and correctly awaits the fetch if not.
  const sourceData = await sp.getSourceData()

  if (sourceData) {
    if (domain in sourceData.sites_by_domain) {
      log(`Domain ${domain} found`)
      const details = sourceData.sites_by_domain[domain]
      const bias = sourceData.combined.biases.find((b) => b.bias === details.bias)
      log(`Found bias: `, bias)
      response.site = {
        bias: bias.pretty,
        biasDescription: bias.description,
        mbfcLink: details.url,
        rated: true,
      }
    } else {
      log(`Domain ${domain} not found in source data`)
    }
  } else {
    log(`Failed to load source data`)
  }

  res.send(response)
}

export default handler
