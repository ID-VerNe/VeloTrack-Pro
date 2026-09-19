# ProGuard rules for VeloSync
-keepattributes *Annotation*
-keepclassmembers class * {
    @kotlinx.serialization.Serializable mMethod;
    @kotlinx.serialization.Serializable mField;
}
