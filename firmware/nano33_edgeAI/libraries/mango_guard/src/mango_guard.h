/*
 * mango_guard.h — MangoGuard unified library public API
 *
 * This header intentionally contains NO Edge Impulse SDK includes.
 * All heavy SDK/model machinery lives exclusively in mango_guard.cpp.
 * That separation prevents duplicate-symbol and missing-header errors
 * that occur when the SDK headers are pulled into the .ino compilation unit.
 *
 * Usage from the sketch:
 *   #include <mango_guard.h>
 *   MangoGuard mg;
 *   MangoGuard::HealthResult   hr = mg.runHealthClassifier(pixBuf, 9216);
 *   MangoGuard::ForecastResult fr = mg.runForecastClassifier(thBuf,  48);
 */

#ifndef _MANGO_GUARD_H_
#define _MANGO_GUARD_H_

#include <stdint.h>
#include <stddef.h>

class MangoGuard {
public:
    /* ── Result types ─────────────────────────────────────────────────── */

    struct HealthResult {
        const char *label;      ///< Winning label ("Anthracnose" | "Healthy" | "Powdery Mildew")
        float       confidence; ///< Confidence [0..1]
        float       scores[3];  ///< Per-class scores
        int         error;      ///< 0 = OK, non-zero = EI_IMPULSE_ERROR code
    };

    static const uint16_t HEALTH_INPUT_WIDTH      = 96;
    static const uint16_t HEALTH_INPUT_HEIGHT     = 96;
    static const uint32_t HEALTH_RAW_SAMPLE_COUNT = 9216;  ///< 96*96 pixels
    static const uint8_t  HEALTH_LABEL_COUNT      = 3;
    static const char * const HEALTH_LABELS[3];


    /**
     * Classify a mango leaf image captured by the OV7675 camera.
     *
     * @param raw_pixels  Float buffer (9216 elements) where each float encodes
     *                    one RGB pixel as (R<<16)|(G<<8)|B  (0xRRGGBB in float).
     * @param length      Must be HEALTH_RAW_SAMPLE_COUNT (9216).
     * @param debug_nn    true → print DSP feature vectors over Serial.
     */
    HealthResult runHealthClassifier(float *raw_pixels, size_t length,
                                     bool debug_nn = false);

    static HealthResult   _makeHealthError(int err);
};

#endif /* _MANGO_GUARD_H_ */
