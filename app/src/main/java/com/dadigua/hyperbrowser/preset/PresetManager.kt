package com.dadigua.hyperbrowser.preset

import android.content.Context
import android.util.Log
import com.dadigua.hyperbrowser.browser.BrowserProfileStore
import com.dadigua.hyperbrowser.extensions.ExtensionRepository
import com.dadigua.hyperbrowser.webapp.WebAppRepository
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Preset manager: bakes a fully customized browser state (bookmarks, WebApps,
 * launcher layout, browser settings, initial tabs, and the list of extensions
 * to re-install from AMO) into a single JSON file that can be dropped into
 * `app/src/main/assets/preset/preset-backup.json` and auto-imported on first
 * launch of a fresh install.
 *
 * The preset format is intentionally separate from the user-driven backup
 * format in [com.dadigua.hyperbrowser.backup.BrowserBackupManager]: presets
 * are for distribution (seed a new device), backups are for personal
 * cross-device sync. Preset data is written verbatim without rev bumping
 * because it is fresh seed data, not a merge participant.
 */
class PresetManager(private val context: Context) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /**
     * Collect the current browser state into a preset JSON string. The WebDAV
     * sync password is intentionally stripped because preset APKs may be
     * distributed and a baked-in credential is a security risk; the user can
     * re-enter it on each device.
     */
    fun exportPresetJson(
        profileStore: BrowserProfileStore,
        webAppRepository: WebAppRepository,
        extensionRepository: ExtensionRepository
    ): String {
        val settingsJson = readSettingsForExport()
        val tabsJson = readTabsForExport()
        val extensions = JSONArray()
        extensionRepository.observeInstalled().value
            .filterNot { it.guid == INTERNAL_EXTENSION_ID }
            .forEach { ext ->
                extensions.put(
                    JSONObject()
                        .put("guid", ext.guid)
                        .put("name", ext.name)
                )
            }

        val files = JSONObject()
            .put(BOOKMARKS_FILE, profileStore.bookmarksSyncJson())
            .put(WEBAPPS_FILE, webAppRepository.syncJson())
            .put(LAUNCHER_FILE, profileStore.launcherSyncJson() ?: emptyLauncherJson())
        if (settingsJson != null) files.put(SETTINGS_FILE, settingsJson)
        if (tabsJson != null) files.put(TABS_FILE, tabsJson)

        return JSONObject()
            .put("type", PRESET_TYPE)
            .put("version", PRESET_VERSION)
            .put("createdAt", System.currentTimeMillis())
            .put("files", files)
            .put("extensions", extensions)
            .toString(2)
    }

    /**
     * On a fresh install (no `bookmarks.json` in filesDir), if a bundled
     * `assets/preset/preset-backup.json` exists, write every embedded file
     * to filesDir and stash the extension list in shared prefs for deferred
     * install (extensions need GeckoRuntime, which is not ready yet at
     * Application.onCreate). No-op on upgrades or when no preset is bundled.
     */
    fun maybeImportBundledPreset(): BundledPresetImportResult? {
        if (File(context.filesDir, BOOKMARKS_FILE).exists()) return null
        val raw = runCatching {
            context.assets.open("$PRESET_ASSET_DIR/$PRESET_ASSET_NAME").bufferedReader()
                .use { it.readText() }
        }.getOrNull() ?: return null

        return runCatching { importPresetJson(raw) }
            .onFailure { Log.e(TAG, "Bundled preset import failed", it) }
            .getOrNull()
    }

    /**
     * Restore a preset JSON: write bookmarks/webapps/launcher/settings/tabs
     * to filesDir, and stash the extension list for deferred install.
     */
    fun importPresetJson(raw: String): BundledPresetImportResult {
        val root = JSONObject(raw)
        if (root.optString("type") != PRESET_TYPE) {
            error("Not a Hyper Browser preset.")
        }
        if (root.optInt("version") != PRESET_VERSION) {
            error("Unsupported preset version.")
        }
        val files = root.optJSONObject("files") ?: error("Preset is missing files.")

        var bookmarksCount = 0
        var webAppsCount = 0
        var tabsCount = 0

        files.optJSONObject(BOOKMARKS_FILE)?.let { json ->
            writeFilesDirJson(BOOKMARKS_FILE, json)
            bookmarksCount = json.optJSONObject("bookmarks")?.length() ?: 0
        }
        files.optJSONObject(WEBAPPS_FILE)?.let { json ->
            writeFilesDirJson(WEBAPPS_FILE, json)
            webAppsCount = json.optJSONObject("apps")?.length() ?: 0
        }
        files.optJSONObject(LAUNCHER_FILE)?.let { json ->
            writeFilesDirJson(LAUNCHER_FILE, json)
        }
        files.optJSONObject(SETTINGS_FILE)?.let { json ->
            writeFilesDirJson(SETTINGS_FILE, stripWebDavPassword(json))
        }
        files.optJSONObject(TABS_FILE)?.let { json ->
            writeFilesDirJson(TABS_FILE, json)
            tabsCount = json.optJSONArray("tabs")?.length() ?: 0
        }

        val extensions = root.optJSONArray("extensions") ?: JSONArray()
        val pending = JSONArray()
        for (index in 0 until extensions.length()) {
            val item = extensions.optJSONObject(index) ?: continue
            val guid = item.optString("guid").trim()
            if (guid.isBlank() || guid == INTERNAL_EXTENSION_ID) continue
            pending.put(
                JSONObject()
                    .put("guid", guid)
                    .put("name", item.optString("name").ifBlank { guid })
            )
        }
        if (pending.length() > 0) {
            prefs.edit().putString(KEY_PENDING_EXTENSIONS, pending.toString()).apply()
        }

        return BundledPresetImportResult(
            bookmarks = bookmarksCount,
            webApps = webAppsCount,
            tabs = tabsCount,
            extensions = pending.length()
        )
    }

    /**
     * Pop the stashed extension list (if any) for deferred install by
     * BrowserActivity once GeckoRuntime is ready. Returns an empty list when
     * there is nothing to install, in which case the caller does nothing.
     */
    fun consumePendingExtensions(): List<PendingPresetExtension> {
        val raw = prefs.getString(KEY_PENDING_EXTENSIONS, null) ?: return emptyList()
        prefs.edit().remove(KEY_PENDING_EXTENSIONS).apply()
        return runCatching {
            val array = JSONArray(raw)
            buildList {
                for (index in 0 until array.length()) {
                    val item = array.optJSONObject(index) ?: continue
                    val guid = item.optString("guid").trim()
                    if (guid.isBlank()) continue
                    add(PendingPresetExtension(guid = guid, name = item.optString("name").ifBlank { guid }))
                }
            }
        }.getOrDefault(emptyList())
    }

    private fun readSettingsForExport(): JSONObject? {
        val file = File(context.filesDir, SETTINGS_FILE)
        if (!file.exists()) return null
        return runCatching {
            stripWebDavPassword(JSONObject(file.readText()))
        }.getOrNull()
    }

    private fun readTabsForExport(): JSONObject? {
        val file = File(context.filesDir, TABS_FILE)
        if (!file.exists()) return null
        return runCatching { JSONObject(file.readText()) }.getOrNull()
    }

    private fun writeFilesDirJson(name: String, json: JSONObject) {
        File(context.filesDir, name).writeText(json.toString())
    }

    private fun stripWebDavPassword(json: JSONObject): JSONObject {
        if (json.has("webDavSyncPassword")) {
            json.put("webDavSyncPassword", "")
        }
        return json
    }

    private fun emptyLauncherJson(): JSONObject =
        JSONObject().put("rev", JSONObject().put("updatedAt", 0L).put("deviceId", ""))

    companion object {
        private const val TAG = "PresetManager"
        private const val PREFS_NAME = "hyper-browser-preset"
        private const val KEY_PENDING_EXTENSIONS = "pendingExtensions"
        private const val PRESET_TYPE = "hyper-browser-preset"
        private const val PRESET_VERSION = 1
        private const val PRESET_ASSET_DIR = "preset"
        private const val PRESET_ASSET_NAME = "preset-backup.json"
        private const val BOOKMARKS_FILE = "bookmarks.json"
        private const val WEBAPPS_FILE = "webapps.json"
        private const val LAUNCHER_FILE = "launcher.json"
        private const val SETTINGS_FILE = "browser_settings.json"
        private const val TABS_FILE = "browser_tabs.json"
        // Mirrors ExtensionRepository.INTERNAL_EXTENSION_ID (private companion val).
        // Duplicated here so PresetManager keeps compiling when ExtensionRepository
        // is at baseline (no top-level const).
        private const val INTERNAL_EXTENSION_ID = "hyper-browser-internal@dadigua.com"
    }
}

data class BundledPresetImportResult(
    val bookmarks: Int,
    val webApps: Int,
    val tabs: Int,
    val extensions: Int
)

data class PendingPresetExtension(
    val guid: String,
    val name: String
)
