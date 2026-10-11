package com.anglesgirl.ao3reader.browser

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class BrowserMediaActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        BrowserMediaNotificationController.get(context).handleAction(
            intent.action,
            intent.getStringExtra(EXTRA_OWNER_KEY)
        )
    }

    companion object {
        const val EXTRA_OWNER_KEY = "com.anglesgirl.ao3reader.media.OWNER_KEY"

        const val ACTION_PLAY = "com.anglesgirl.ao3reader.media.PLAY"
        const val ACTION_PAUSE = "com.anglesgirl.ao3reader.media.PAUSE"
        const val ACTION_STOP = "com.anglesgirl.ao3reader.media.STOP"
        const val ACTION_SEEK_FORWARD = "com.anglesgirl.ao3reader.media.SEEK_FORWARD"
        const val ACTION_SEEK_BACKWARD = "com.anglesgirl.ao3reader.media.SEEK_BACKWARD"
        const val ACTION_NEXT = "com.anglesgirl.ao3reader.media.NEXT"
        const val ACTION_PREVIOUS = "com.anglesgirl.ao3reader.media.PREVIOUS"

        fun pendingIntent(
            context: Context,
            action: String,
            ownerKey: String,
            requestCode: Int
        ): PendingIntent =
            PendingIntent.getBroadcast(
                context.applicationContext,
                requestCode,
                Intent(context.applicationContext, BrowserMediaActionReceiver::class.java)
                    .setAction(action)
                    .putExtra(EXTRA_OWNER_KEY, ownerKey),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
    }
}
