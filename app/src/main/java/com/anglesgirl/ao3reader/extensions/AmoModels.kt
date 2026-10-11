package com.anglesgirl.ao3reader.extensions

data class AmoAddonListing(
    val name: String,
    val slug: String,
    val guid: String,
    val version: String,
    val userCount: Int,
    val xpiUrl: String,
    val permissions: List<String>,
    val minAndroidVersion: String?,
    val maxAndroidVersion: String?
)
