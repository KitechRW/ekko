plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.compose")
}

val configuredYouTubeVideoId = providers.gradleProperty("EKKO_YOUTUBE_VIDEO_ID")
    .orElse("")
    .get()
    .trim()

require(configuredYouTubeVideoId.isBlank() || configuredYouTubeVideoId.matches(Regex("[A-Za-z0-9_-]{11}"))) {
    "EKKO_YOUTUBE_VIDEO_ID must be a YouTube video ID with 11 characters."
}

android {
    namespace = "rw.kitech.ekko.tv"
    compileSdk = 36

    defaultConfig {
        applicationId = "rw.kitech.ekko.tv"
        minSdk = 23
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        buildConfigField("String", "EKKO_YOUTUBE_VIDEO_ID", "\"$configuredYouTubeVideoId\"")
    }

    buildFeatures {
        buildConfig = true
        compose = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.10.0")

    implementation("androidx.compose.runtime:runtime:1.10.5")
    implementation("androidx.compose.ui:ui:1.10.5")
    implementation("androidx.compose.ui:ui-tooling-preview:1.10.5")
    implementation("androidx.compose.foundation:foundation:1.10.5")
    implementation("androidx.compose.animation:animation:1.10.5")
    implementation("androidx.tv:tv-material:1.1.0")

    debugImplementation("androidx.compose.ui:ui-tooling:1.10.5")
}
