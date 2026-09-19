package com.velotrack.sync.ui

import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.ActivityResultLauncher
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.velotrack.sync.R
import com.velotrack.sync.data.ApiService
import com.velotrack.sync.data.AppConfig
import com.velotrack.sync.data.ConfigRepository
import com.velotrack.sync.databinding.ActivityMainBinding
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var configRepo: ConfigRepository
    private lateinit var apiService: ApiService
    private lateinit var qrScanLauncher: ActivityResultLauncher<ScanOptions>

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        configRepo = ConfigRepository(this)
        apiService = ApiService(configRepo)

        initQrScanner()
        initListeners()
        loadCurrentConfig()
    }

    private fun initQrScanner() {
        qrScanLauncher = registerForActivityResult(ScanContract()) { result ->
            val content = result.contents
            if (!content.isNullOrBlank()) {
                parseAndApplyQrConfig(content)
            }
        }
    }

    private fun cleanToken(raw: String): String {
        return raw.trim()
            .replace(Regex("^(CF-Access-Client-Id|Client[-_ ]?ID)\\s*[:=]\\s*", RegexOption.IGNORE_CASE), "")
            .replace(Regex("^(CF-Access-Client-Secret|Client[-_ ]?Secret)\\s*[:=]\\s*", RegexOption.IGNORE_CASE), "")
            .replace(Regex("^(Authorization|Admin[-_ ]?Token|Bearer)\\s*[:=]?\\s*", RegexOption.IGNORE_CASE), "")
            .trim('"', '\'', ' ', '\n', '\r', '\t')
    }

    private fun parseAndApplyQrConfig(qrRaw: String) {
        try {
            val element = Json.parseToJsonElement(qrRaw).jsonObject
            val baseUrl = element["baseUrl"]?.jsonPrimitive?.content ?: "https://cycling.yuuverne.site"
            val adminToken = cleanToken(element["adminToken"]?.jsonPrimitive?.content ?: "")
            val cfClientId = cleanToken(element["cfClientId"]?.jsonPrimitive?.content ?: "")
            val cfClientSecret = cleanToken(element["cfClientSecret"]?.jsonPrimitive?.content ?: "")

            val config = AppConfig(baseUrl, adminToken, cfClientId, cfClientSecret)
            lifecycleScope.launch {
                configRepo.saveConfig(config)
                displayConfig(config)
                Toast.makeText(this@MainActivity, "扫码配对成功！已导入凭据", Toast.LENGTH_SHORT).show()
                refreshPrivacyZones()
            }
        } catch (e: Exception) {
            Toast.makeText(this, "无效的配对二维码内容: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    private fun initListeners() {
        binding.btnScanQr.setOnClickListener {
            val options = ScanOptions().apply {
                setPrompt("请对准 VeloTrack Pro PC 端配对二维码")
                setBeepEnabled(true)
                setOrientationLocked(true)
                setCaptureActivity(QrScannerActivity::class.java)
            }
            qrScanLauncher.launch(options)
        }

        binding.btnSaveConfig.setOnClickListener {
            val config = AppConfig(
                baseUrl = binding.etBaseUrl.text.toString().trim(),
                adminToken = cleanToken(binding.etAdminToken.text.toString()),
                cfClientId = cleanToken(binding.etCfClientId.text.toString()),
                cfClientSecret = cleanToken(binding.etCfClientSecret.text.toString())
            )
            lifecycleScope.launch {
                configRepo.saveConfig(config)
                displayConfig(config)
                Toast.makeText(this@MainActivity, "配置已保存", Toast.LENGTH_SHORT).show()
                refreshPrivacyZones()
            }
        }

        binding.btnSyncZones.setOnClickListener {
            refreshPrivacyZones()
        }
    }

    private fun loadCurrentConfig() {
        lifecycleScope.launch {
            val config = configRepo.configFlow.first()
            displayConfig(config)

            val cachedZones = configRepo.getCachedZones()
            binding.tvZonesInfo.text = getString(R.string.zones_count, cachedZones.size)
        }
    }

    private fun displayConfig(config: AppConfig) {
        binding.etBaseUrl.setText(config.baseUrl)
        binding.etAdminToken.setText(config.adminToken)
        binding.etCfClientId.setText(config.cfClientId)
        binding.etCfClientSecret.setText(config.cfClientSecret)
    }

    private fun refreshPrivacyZones() {
        binding.tvZonesInfo.text = "正在同步云端隐私圈..."
        lifecycleScope.launch {
            val res = apiService.fetchPrivacyZones()
            if (res.isSuccess) {
                val list = res.getOrNull() ?: emptyList()
                binding.tvZonesInfo.text = getString(R.string.zones_count, list.size)
                Toast.makeText(this@MainActivity, "隐私圈同步成功（共 ${list.size} 个）", Toast.LENGTH_SHORT).show()
            } else {
                val err = res.exceptionOrNull()?.localizedMessage ?: "未知错误"
                binding.tvZonesInfo.text = "同步失败: $err"
                Toast.makeText(this@MainActivity, "拉取失败: $err", Toast.LENGTH_LONG).show()
            }
        }
    }
}
