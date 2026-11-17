package com.dadigua.hyperbrowser.extensions

import com.anglesgirl.ao3reader.extensions.parseAmoSearchResponse
import org.junit.Assert.assertEquals
import org.junit.Test

class AmoSearchResponseParserTest {
    @Test
    fun parsesCatCatchFromOfficialAmoSearchResponseShape() {
        val response = """
            {
              "results": [
                {
                  "name": {"zh-CN": "猫抓(cat-catch)", "en-US": "Cat Catch"},
                  "slug": "cat-catch",
                  "guid": "xifangczy@gmail.com",
                  "average_daily_users": 16789,
                  "current_version": {
                    "version": "2.7.4",
                    "compatibility": {"android": {"min": "120.0", "max": "*"}},
                    "file": {
                      "url": "https://addons.mozilla.org/firefox/downloads/file/5170950/cat_catch-2.7.4.xpi",
                      "permissions": ["tabs", "webRequest", "downloads"]
                    }
                  }
                }
              ]
            }
        """.trimIndent()

        val addon = parseAmoSearchResponse(response).single()

        assertEquals("猫抓(cat-catch)", addon.name)
        assertEquals("cat-catch", addon.slug)
        assertEquals("xifangczy@gmail.com", addon.guid)
        assertEquals("2.7.4", addon.version)
        assertEquals(16789, addon.userCount)
        assertEquals(
            "https://addons.mozilla.org/firefox/downloads/file/5170950/cat_catch-2.7.4.xpi",
            addon.xpiUrl
        )
        assertEquals(listOf("tabs", "webRequest", "downloads"), addon.permissions)
        assertEquals("120.0", addon.minAndroidVersion)
        assertEquals("*", addon.maxAndroidVersion)
    }
}
