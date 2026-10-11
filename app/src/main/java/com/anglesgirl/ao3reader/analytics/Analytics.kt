package com.anglesgirl.ao3reader.analytics

import android.content.Context
import android.os.Bundle
import com.google.firebase.analytics.FirebaseAnalytics

/**
 * Firebase Analytics（GA4）埋点辅助。
 *
 * 与 CO3 同一 Firebase 项目（ao3app-a00a3），数据进同一份 GA4 属性。
 * 风格对齐 CO3 main/utils/analytics.js：
 * - 惰性初始化，任何异常静默吞掉，绝不影响业务；
 * - 事件名 ≤40 字符，字符串参数 ≤100 字符。
 */
object Analytics {
    private var firebase: FirebaseAnalytics? = null

    fun init(context: Context) {
        try {
            firebase = FirebaseAnalytics.getInstance(context.applicationContext)
        } catch (_: Throwable) {
        }
    }

    fun track(name: String, params: Map<String, Any?> = emptyMap()) {
        try {
            val fb = firebase ?: return
            val bundle = Bundle()
            params.forEach { (key, value) ->
                val k = key.take(40)
                when (value) {
                    is String -> bundle.putString(k, value.take(100))
                    is Number -> bundle.putDouble(k, value.toString().toDoubleOrNull() ?: 0.0)
                    is Boolean -> bundle.putBoolean(k, value)
                    null -> {}
                    else -> bundle.putString(k, value.toString().take(100))
                }
            }
            fb.logEvent(name.take(40), bundle)
        } catch (_: Throwable) {
        }
    }
}
