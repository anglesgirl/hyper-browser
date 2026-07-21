package com.dadigua.hyperbrowser

import android.app.Application
import com.dadigua.hyperbrowser.extensions.ExtensionRepository
import com.dadigua.hyperbrowser.preset.PresetManager
import com.dadigua.hyperbrowser.webapp.WebAppRepository

class HyperBrowserApp : Application() {
    val webApps: WebAppRepository by lazy { WebAppRepository(this) }
    val extensions: ExtensionRepository by lazy { ExtensionRepository(this) }

    override fun onCreate() {
        super.onCreate()
        // Seed a fresh install from a bundled preset (assets/preset/preset-backup.json)
        // before any repository is instantiated. No-op on upgrades or when no preset
        // is bundled. Extensions are stashed for deferred install by BrowserActivity.
        PresetManager(this).maybeImportBundledPreset()
    }
}
