package com.anglesgirl.ao3reader.browser

import java.net.InetSocketAddress
import java.net.Socket
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext

data class IpResult(val ip: String, val latencyMs: Long)

/**
 * Concurrently probes a /24 prefix for reachable IPs by attempting a
 * TCP connection to port 443 (the HTTPS port used by the DoH gateway).
 * Returns reachable IPs sorted by latency, fastest first.
 */
object IpScanner {
    suspend fun scan(prefix: String, maxConcurrency: Int = 16, timeoutMs: Int = 1500): List<IpResult> =
        withContext(Dispatchers.IO) {
            val semaphore = Semaphore(maxConcurrency)
            (1..254).map { last ->
                async {
                    semaphore.withPermit {
                        val ip = "$prefix.$last"
                        runCatching {
                            Socket().use { socket ->
                                val start = System.currentTimeMillis()
                                socket.connect(InetSocketAddress(ip, 443), timeoutMs)
                                val elapsed = System.currentTimeMillis() - start
                                IpResult(ip, elapsed)
                            }
                        }.getOrNull()
                    }
                }
            }.awaitAll().filterNotNull().sortedBy { it.latencyMs }
        }
}
