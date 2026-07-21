package com.dadigua.hyperbrowser.ui.browser

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.dadigua.hyperbrowser.R
import com.dadigua.hyperbrowser.browser.BrowserSettings

/**
 * 快速设置面板：首次启动自动弹出，设置页也有入口。
 *
 * 把新设备最常需要的三件事集中在一个页面：
 * - 启用 DoH（ECH 自动跟随）
 * - 安装扩展（跳到扩展管理页）
 * - 从备份恢复（跳到 SAF 文件选择）
 *
 * 不重复实现完整设置项，所有写入逻辑复用 BrowserActivity 已有的回调，
 * 保证行为和 SettingsPage 一致。
 */
@Composable
internal fun QuickSettingsPage(
    settings: BrowserSettings,
    message: String?,
    onBack: () -> Unit,
    onUpdateDoh: (dohEnabled: Boolean, dohProviderUrl: String) -> Unit,
    onShowExtensions: () -> Unit,
    onImportBackup: () -> Unit
) {
    var dohEnabled by remember { mutableStateOf(settings.dohEnabled) }
    var dohDraft by remember { mutableStateOf(settings.dohProviderUrl) }
    var dohError by remember { mutableStateOf("") }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFFF7F8FC)),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(48.dp)
                    .padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                IconButton(onClick = onBack, modifier = Modifier.size(40.dp)) {
                    Text("‹", fontSize = 24.sp, color = Color(0xFF202124))
                }
                Text(
                    stringResource(R.string.quick_settings_title),
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Bold,
                    color = Color(0xFF202124)
                )
            }
            HorizontalDivider(color = Color(0xFFDADCE3))
        }

        item {
            Text(
                stringResource(R.string.quick_settings_intro),
                modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp),
                style = MaterialTheme.typography.bodyMedium,
                color = Color(0xFF5F6368)
            )
        }

        // DoH 卡片
        item {
            QuickCard(
                title = stringResource(R.string.quick_settings_doh_title),
                subtitle = stringResource(R.string.quick_settings_doh_subtitle)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        "DNS over HTTPS",
                        modifier = Modifier.weight(1f),
                        style = MaterialTheme.typography.bodyLarge
                    )
                    Switch(
                        checked = dohEnabled,
                        onCheckedChange = { newValue ->
                            dohEnabled = newValue
                            val cleanUrl = dohDraft.trim()
                            if (!cleanUrl.startsWith("https://", ignoreCase = true)) {
                                dohError = stringResource(R.string.settings_doh_https_required)
                                return@Switch
                            }
                            dohError = ""
                            onUpdateDoh(newValue, cleanUrl)
                        }
                    )
                }
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = dohDraft,
                    onValueChange = {
                        dohDraft = it
                        dohError = ""
                    },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Uri,
                        imeAction = ImeAction.Done
                    ),
                    label = { Text(stringResource(R.string.settings_doh_address)) },
                    isError = dohError.isNotBlank(),
                    modifier = Modifier.fillMaxWidth()
                )
                if (dohError.isNotBlank()) {
                    Text(
                        dohError,
                        modifier = Modifier.padding(top = 4.dp),
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.End
                ) {
                    TextButton(onClick = {
                        val cleanUrl = dohDraft.trim()
                        if (!cleanUrl.startsWith("https://", ignoreCase = true)) {
                            dohError = stringResource(R.string.settings_doh_https_required)
                            return@TextButton
                        }
                        dohError = ""
                        onUpdateDoh(dohEnabled, cleanUrl)
                    }) {
                        Text(stringResource(R.string.common_action_save))
                    }
                }
            }
        }

        // 扩展安装卡片
        item {
            QuickCard(
                title = stringResource(R.string.quick_settings_extensions_title),
                subtitle = stringResource(R.string.quick_settings_extensions_subtitle)
            ) {
                Button(
                    onClick = onShowExtensions,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(stringResource(R.string.quick_settings_open_extensions))
                }
            }
        }

        // 备份恢复卡片
        item {
            QuickCard(
                title = stringResource(R.string.quick_settings_backup_title),
                subtitle = stringResource(R.string.quick_settings_backup_subtitle)
            ) {
                Button(
                    onClick = onImportBackup,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(stringResource(R.string.quick_settings_import_backup))
                }
            }
        }

        if (message != null) {
            item {
                Text(
                    message,
                    modifier = Modifier.padding(horizontal = 18.dp, vertical = 8.dp),
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF5F6368)
                )
            }
        }
    }
}

@Composable
private fun QuickCard(
    title: String,
    subtitle: String,
    content: @Composable () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(
                title,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                color = Color(0xFF202124)
            )
            Spacer(Modifier.height(4.dp))
            Text(
                subtitle,
                style = MaterialTheme.typography.bodySmall,
                color = Color(0xFF5F6368)
            )
            Spacer(Modifier.height(12.dp))
            content()
        }
    }
}
