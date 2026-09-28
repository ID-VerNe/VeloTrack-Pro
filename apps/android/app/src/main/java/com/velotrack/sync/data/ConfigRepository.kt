package com.velotrack.sync.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.datastore.preferences.core.emptyPreferences
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import java.io.IOException

val Context.dataStore by preferencesDataStore(name = "velosync_settings")

class ConfigRepository(private val context: Context) {

    companion object {
        private val KEY_BASE_URL = stringPreferencesKey("base_url")
        private val KEY_ADMIN_TOKEN = stringPreferencesKey("admin_token")
        private val KEY_CF_CLIENT_ID = stringPreferencesKey("cf_client_id")
        private val KEY_CF_CLIENT_SECRET = stringPreferencesKey("cf_client_secret")
        private val KEY_CACHED_ZONES = stringPreferencesKey("cached_privacy_zones")
    }

    private val json = Json { ignoreUnknownKeys = true }

    val configFlow: Flow<AppConfig> = context.dataStore.data
        .catch { e ->
            if (e is IOException) emit(emptyPreferences()) else throw e
        }
        .map { pref ->
            AppConfig(
                baseUrl = pref[KEY_BASE_URL] ?: "https://cycling.yuuverne.site",
                adminToken = pref[KEY_ADMIN_TOKEN] ?: "",
                cfClientId = pref[KEY_CF_CLIENT_ID] ?: "",
                cfClientSecret = pref[KEY_CF_CLIENT_SECRET] ?: ""
            )
        }

    suspend fun getConfig(): AppConfig {
        return try {
            configFlow.first()
        } catch (_: Exception) {
            AppConfig(
                baseUrl = "https://cycling.yuuverne.site",
                adminToken = "",
                cfClientId = "",
                cfClientSecret = ""
            )
        }
    }

    suspend fun saveConfig(config: AppConfig) {
        val normalizedBase = config.baseUrl.trim().let {
            if (it.isEmpty()) it
            else if (!it.startsWith("http://") && !it.startsWith("https://")) "https://$it"
            else it
        }.trimEnd('/')
        context.dataStore.edit { pref ->
            pref[KEY_BASE_URL] = normalizedBase
            pref[KEY_ADMIN_TOKEN] = config.adminToken.trim()
            pref[KEY_CF_CLIENT_ID] = config.cfClientId.trim()
            pref[KEY_CF_CLIENT_SECRET] = config.cfClientSecret.trim()
        }
    }

    suspend fun saveCachedZones(zones: List<PrivacyZone>) {
        val serialized = json.encodeToString(zones)
        context.dataStore.edit { pref ->
            pref[KEY_CACHED_ZONES] = serialized
        }
    }

    suspend fun getCachedZones(): List<PrivacyZone> {
        return try {
            val raw = context.dataStore.data.first()[KEY_CACHED_ZONES] ?: return emptyList()
            json.decodeFromString<List<PrivacyZone>>(raw)
        } catch (_: Exception) {
            emptyList()
        }
    }
}
