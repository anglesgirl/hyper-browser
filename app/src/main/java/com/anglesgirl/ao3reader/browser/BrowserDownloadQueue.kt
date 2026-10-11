package com.anglesgirl.ao3reader.browser

import com.anglesgirl.ao3reader.gecko.GeckoDownloadRequest
import java.util.concurrent.ConcurrentHashMap

object BrowserDownloadQueue {
    private val geckoRequests = ConcurrentHashMap<String, GeckoDownloadRequest>()

    fun putGeckoRequest(id: String, request: GeckoDownloadRequest) {
        geckoRequests[id] = request
    }

    fun takeGeckoRequest(id: String): GeckoDownloadRequest? =
        geckoRequests.remove(id)
}
