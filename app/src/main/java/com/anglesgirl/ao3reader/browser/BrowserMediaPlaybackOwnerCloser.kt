package com.anglesgirl.ao3reader.browser

import android.content.Context
import com.anglesgirl.ao3reader.gecko.HyperBridge

fun closeBrowserMediaPlaybackOwner(context: Context, ownerInfo: BrowserMediaOwnerInfo) {
    val mediaNotifications = BrowserMediaNotificationController.get(context)
    mediaNotifications.sessionsForOwner(ownerInfo).forEach { session ->
        HyperBridge.unregister(session)
        mediaNotifications.clearIfOwner(session)
        runCatching { session.close() }
    }
    mediaNotifications.clearIfOwner(ownerInfo)
}
