package com.anglesgirl.ao3reader.webapp

import android.app.Activity
import android.app.ActivityManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Color
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build
import android.util.Base64
import com.anglesgirl.ao3reader.R
import com.anglesgirl.ao3reader.browser.BrowserIconComposer
import com.anglesgirl.ao3reader.browser.FaviconRepository
import com.anglesgirl.ao3reader.data.AtomicFileWriter
import com.anglesgirl.ao3reader.data.WebAppDefinition
import com.anglesgirl.ao3reader.ui.webapp.WebAppActivity
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import org.json.JSONObject
import java.io.File
import java.io.ByteArrayOutputStream

class WebAppRepository(
    private val context: Context
) {
    private val storeFile = File(context.filesDir, "webapps.json")
    private val faviconStore = FaviconRepository(context)
    private val state = MutableStateFlow(load())

    fun observeAll(): StateFlow<List<WebAppDefinition>> = state

    fun syncJson(): JSONObject =
        readJSONObject(storeFile) ?: emptyWebAppsJson()

    fun saveSyncJson(json: JSONObject) {
        val previousById = state.value.associateBy { it.id }
        AtomicFileWriter.writeText(storeFile, json.deepCopy().toString())
        val next = loadFromSyncFile(storeFile).sortedByDescending { it.lastOpenedAt }
        val nextIds = next.map { it.id }.toSet()
        previousById.values
            .filter { it.id !in nextIds }
            .forEach { disableShortcut(it) }
        state.value = next
        next.filter { previousById[it.id] != null && previousById[it.id] != it }
            .forEach { updateShortcut(it) }
    }

    suspend fun get(id: String): WebAppDefinition? = state.value.firstOrNull { it.id == id }

    fun iconDataUrl(webApp: WebAppDefinition): String? {
        val icon = rawWebAppIconBitmap(webApp, 128) ?: return null
        return bitmapDataUrl(icon)
    }

    fun siteIconDataUrl(webApp: WebAppDefinition): String? {
        val currentIconPath = faviconStore.existingIconPath(siteModeIconPath(webApp.iconPath))
        val siteIconPath = if (faviconStore.isCustomIconPath(currentIconPath)) {
            faviconStore.cachedIconPath(webApp.startUrl)
        } else {
            currentIconPath ?: faviconStore.cachedIconPath(webApp.startUrl)
        }
        return faviconStore.iconDataUrl(siteIconPath)
    }

    fun iconSource(webApp: WebAppDefinition): String {
        val currentIconPath = faviconStore.existingIconPath(siteModeIconPath(webApp.iconPath))
        return when {
            faviconStore.isCustomIconPath(currentIconPath) -> "custom"
            currentIconPath != null || faviconStore.cachedIconPath(webApp.startUrl) != null -> "site"
            else -> "title"
        }
    }

    suspend fun pinToHome(id: String): PinnedShortcutRequestResult {
        val webApp = state.value.firstOrNull { it.id == id } ?: return PinnedShortcutRequestResult.WebAppNotFound
        return requestPinnedShortcut(webApp)
    }

    fun pinToHome(webApp: WebAppDefinition): PinnedShortcutRequestResult =
        requestPinnedShortcut(webApp)

    fun applyTaskDescription(activity: Activity, webApp: WebAppDefinition) {
        @Suppress("DEPRECATION")
        val icon = badgedWebAppIconBitmap(webApp, 96)
            ?: BitmapFactory.decodeResource(activity.resources, R.mipmap.ic_launcher)
        @Suppress("DEPRECATION")
        activity.setTaskDescription(ActivityManager.TaskDescription(webApp.name, icon, webApp.themeColor))
    }

    private fun requestPinnedShortcut(webApp: WebAppDefinition): PinnedShortcutRequestResult {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return PinnedShortcutRequestResult.Unsupported
        val shortcutManager = context.getSystemService(ShortcutManager::class.java)
        if (!shortcutManager.isRequestPinShortcutSupported) return PinnedShortcutRequestResult.Unsupported
        val shortcut = shortcutInfo(webApp)
        val callback = PendingIntent.getBroadcast(
            context,
            shortcutId(webApp.id).hashCode(),
            ShortcutPinnedReceiver.intent(context, webApp.name),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return if (shortcutManager.requestPinShortcut(shortcut, callback.intentSender)) {
            PinnedShortcutRequestResult.Requested
        } else {
            PinnedShortcutRequestResult.Failed
        }
    }

    private fun updateShortcut(webApp: WebAppDefinition) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val shortcutManager = context.getSystemService(ShortcutManager::class.java)
        runCatching { shortcutManager.updateShortcuts(listOf(shortcutInfo(webApp))) }
    }

    private fun disableShortcut(webApp: WebAppDefinition) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N_MR1) return
        val shortcutManager = context.getSystemService(ShortcutManager::class.java)
        runCatching { shortcutManager.disableShortcuts(listOf(shortcutId(webApp.id)), "WebApp removed") }
    }

    private fun shortcutInfo(webApp: WebAppDefinition): ShortcutInfo {
        val intent = WebAppActivity.intent(context, webApp.id, true).apply {
            action = Intent.ACTION_VIEW
            data = Uri.parse("hyperbrowser://webapp/${webApp.id}")
        }
        return ShortcutInfo.Builder(context, shortcutId(webApp.id))
            .setShortLabel(webApp.name.take(20))
            .setLongLabel(webApp.name)
            .setIcon(shortcutIcon(webApp))
            .setIntent(intent)
            .build()
    }

    private fun shortcutIcon(webApp: WebAppDefinition): Icon =
        badgedWebAppIconBitmap(webApp, 192)
            ?.let { Icon.createWithBitmap(it) }
            ?: Icon.createWithResource(context, R.mipmap.ic_launcher)

    private fun iconPathFor(webApp: WebAppDefinition): String? =
        faviconStore.existingIconPath(siteModeIconPath(webApp.iconPath))
            ?: faviconStore.cachedIconPath(webApp.startUrl)

    private fun shortcutId(id: String): String = "webapp-$id"

    private fun rawWebAppIconBitmap(webApp: WebAppDefinition, size: Int): Bitmap? {
        val iconPath = iconPathFor(webApp)
        val bitmap = iconPath?.let { BitmapFactory.decodeFile(it) }
        if (bitmap != null && !bitmap.isRecycled) return normalizeBitmap(bitmap, size)
        return BrowserIconComposer.defaultWebAppIcon(webApp.name, webApp.startUrl, size)
    }

    private fun badgedWebAppIconBitmap(webApp: WebAppDefinition, size: Int): Bitmap? {
        val rawIcon = rawWebAppIconBitmap(webApp, size) ?: return null
        return BrowserIconComposer.badgedSiteIcon(context, rawIcon, size)
    }

    private fun normalizeBitmap(source: Bitmap, size: Int): Bitmap? {
        if (source.isRecycled || size <= 0) return null
        val output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = android.graphics.Canvas(output)
        val paint = android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG or android.graphics.Paint.FILTER_BITMAP_FLAG)
        canvas.drawBitmap(source, null, android.graphics.RectF(0f, 0f, size.toFloat(), size.toFloat()), paint)
        return output
    }

    private fun bitmapDataUrl(bitmap: Bitmap): String {
        val output = ByteArrayOutputStream()
        bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
        return "data:image/png;base64,${Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)}"
    }

    private fun load(): List<WebAppDefinition> {
        if (!storeFile.exists()) {
            // 首次启动：预置用户的三个导航站，之后走正常加载路径
            return seedDefaultWebApps()
        }
        // 存量修复：补回缺失的种子。用户手动删除的有 tombstone，不补；
        // 缺 rev 被同步层吞掉的没有 tombstone，自动补回。
        val root = readJSONObject(storeFile)
        if (root != null) {
            val appsObj = root.optJSONObject("apps") ?: JSONObject()
            val tombstonesObj = root.optJSONObject("appTombstones") ?: JSONObject()
            val now = System.currentTimeMillis()
            var changed = false
            seedDefinitions(now).forEach { seed ->
                if (!appsObj.has(seed.id) && !tombstonesObj.has(seed.id)) {
                    appsObj.put(seed.id, seedToJson(seed, now))
                    changed = true
                    android.util.Log.i("WebAppRepository", "补回缺失的预置导航: ${seed.name}")
                }
            }
            if (changed) {
                root.put("apps", appsObj)
                runCatching {
                    AtomicFileWriter.writeText(storeFile, root.toString())
                }.onFailure {
                    android.util.Log.w("WebAppRepository", "补回预置导航写入失败: ${it.message}")
                }
            }
        }
        return loadFromSyncFile(storeFile).sortedByDescending { it.lastOpenedAt }
    }

    private fun seedDefinitions(now: Long): List<WebAppDefinition> = listOf(
        WebAppDefinition(
            id = "seed-blog",
            name = "博客",
            startUrl = "https://anglesya.win/",
            iconPath = null,
            themeColor = Color.rgb(18, 109, 106),
            displayMode = "standalone",
            createdAt = now,
            lastOpenedAt = now
        ),
        WebAppDefinition(
            id = "seed-movie",
            name = "2BTV",
            startUrl = "https://2btv.eu.org/",
            iconPath = null,
            themeColor = Color.rgb(18, 109, 106),
            displayMode = "standalone",
            createdAt = now,
            lastOpenedAt = now - 1
        ),
        WebAppDefinition(
            id = "seed-ao3",
            name = "AO3",
            startUrl = "https://archiveofourown.org/",
            iconPath = null,
            themeColor = Color.rgb(155, 0, 0),
            displayMode = "standalone",
            createdAt = now,
            lastOpenedAt = now - 2
        )
    )

    private fun seedToJson(app: WebAppDefinition, now: Long): JSONObject =
        JSONObject()
            .put("id", app.id)
            .put("name", app.name)
            .put("startUrl", app.startUrl)
            .put("themeColor", app.themeColor)
            .put("displayMode", app.displayMode)
            .put("createdAt", app.createdAt)
            .put("lastOpenedAt", app.lastOpenedAt)
            // 同步层硬要求：normalizeStoredWebAppRecord 无 rev 直接丢弃（op-log.ts:1212）。
            // 不带 rev 会导致编辑任一 WebApp 时，其余种子在 JS 层不可见、写回时被覆盖。
            .put("rev", JSONObject()
                .put("updatedAt", now)
                .put("deviceId", "seed"))

    /**
     * 首次启动预置导航：博客 / 电影站 / AO3。
     * 只在 webapps.json 完全不存在时执行一次并落盘；用户手动删除后不再补回。
     * 图标传 null，走站点 favicon，拿不到时用首字母兜底（BrowserIconComposer）。
     */
    private fun seedDefaultWebApps(): List<WebAppDefinition> {
        val now = System.currentTimeMillis()
        val seeds = seedDefinitions(now)
        val appsJson = JSONObject()
        seeds.forEach { app ->
            appsJson.put(app.id, seedToJson(app, now))
        }
        runCatching {
            AtomicFileWriter.writeText(storeFile, emptyWebAppsJson().put("apps", appsJson).toString())
            android.util.Log.i("WebAppRepository", "首次启动已预置 ${seeds.size} 个导航")
        }.onFailure {
            android.util.Log.w("WebAppRepository", "预置导航写入失败: ${it.message}")
        }
        return seeds.sortedByDescending { it.lastOpenedAt }
    }

    private fun loadFromSyncFile(file: File): List<WebAppDefinition> =
        runCatching {
            val root = JSONObject(file.readText())
            val apps = root.optJSONObject("apps") ?: JSONObject()
            buildList {
                val keys = apps.keys()
                while (keys.hasNext()) {
                    val key = keys.next()
                    val item = apps.optJSONObject(key) ?: continue
                    val startUrl = item.optString("startUrl").trim()
                    if (startUrl.isBlank()) continue
                    val id = item.optString("id").trim().ifBlank { key.trim() }
                    if (id.isBlank()) continue
                    add(
                        WebAppDefinition(
                            id = id,
                            name = item.optString("name").trim().ifBlank { Uri.parse(startUrl).host ?: "WebApp" },
                            startUrl = startUrl,
                            iconPath = siteModeIconPath(item.optCleanString("iconPath"))
                                ?: iconPathFromSyncRecord(id, startUrl, item),
                            themeColor = item.optInt("themeColor", Color.rgb(18, 109, 106)),
                            displayMode = item.optString("displayMode", "standalone"),
                            createdAt = item.optLong("createdAt").takeIf { it > 0 }
                                ?: item.optLong("updatedAt").takeIf { it > 0 }
                                ?: System.currentTimeMillis(),
                            lastOpenedAt = item.optLong("lastOpenedAt").takeIf { it > 0 }
                                ?: item.optLong("updatedAt").takeIf { it > 0 }
                                ?: System.currentTimeMillis()
                        )
                    )
                }
            }
        }.getOrDefault(emptyList())

    private fun iconPathFromSyncRecord(id: String, startUrl: String, item: JSONObject): String? {
        val iconDataUrl = item.optCleanString("iconDataUrl")
        return when (item.optCleanString("iconSource")) {
            "custom" -> faviconStore.saveCustomIconDataUrl(id.ifBlank { startUrl }, iconDataUrl)
            "site" -> faviconStore.saveIconDataUrl(startUrl, iconDataUrl)
            else -> null
        } ?: faviconStore.cachedIconPath(startUrl)
    }

    private fun readJSONObject(file: File): JSONObject? {
        if (!file.exists()) return null
        return runCatching { JSONObject(file.readText()) }.getOrNull()
    }

    private fun JSONObject.deepCopy(): JSONObject =
        JSONObject(toString())

    private fun JSONObject.optCleanString(name: String): String? {
        if (!has(name) || isNull(name)) return null
        val value = optString(name).trim()
        return value.takeIf { it.isNotBlank() && it != "null" && it != "undefined" }
    }

    private fun emptyWebAppsJson(): JSONObject =
        JSONObject()
            .put("schemaVersion", 2)
            .put("apps", JSONObject())
            .put("appTombstones", JSONObject())

    private fun siteModeIconPath(iconPath: String?): String? =
        iconPath?.takeUnless { isLegacyNoIconPath(it) }

    companion object {
        private const val LEGACY_NO_ICON_PATH = "hyperbrowser://webapp-icon/none"

        fun isLegacyNoIconPath(iconPath: String?): Boolean = iconPath == LEGACY_NO_ICON_PATH
    }
}

enum class PinnedShortcutRequestResult {
    Requested,
    Unsupported,
    Failed,
    WebAppNotFound
}
