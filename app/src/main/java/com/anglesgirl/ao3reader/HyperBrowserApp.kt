package com.anglesgirl.ao3reader

import android.app.Application
import com.anglesgirl.ao3reader.browser.BrowserProfileStore
import com.anglesgirl.ao3reader.browser.DownloadStore
import com.anglesgirl.ao3reader.extensions.ExtensionRepository
import com.anglesgirl.ao3reader.webapp.WebAppRepository

class HyperBrowserApp : Application() {
    val profileStore: BrowserProfileStore by lazy { BrowserProfileStore(this) }
    val downloads: DownloadStore by lazy { DownloadStore(this) }
    val webApps: WebAppRepository by lazy { WebAppRepository(this) }
    val extensions: ExtensionRepository by lazy { ExtensionRepository(this) }
}
