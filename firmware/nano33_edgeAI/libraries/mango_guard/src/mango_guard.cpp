/*
 * mango_guard.cpp — MangoGuard unified library implementation
 *
 * All model variable definitions arrive via the include chain:
 *   ei_run_classifier.h (line 97)
 *     → model-parameters/model_variables.h
 *       → model_variables_health.h   (impulse_handle_908354_24)
 *       → model_variables_forecast.h (impulse_handle_916176_2)
 *
 * This file ONLY implements the MangoGuard class methods.
 * No model variables are redefined here.
 *
 * Copyright (c) 2026 University Program - Bahir Dar Institute of Technology
 */

/* ── Arduino compatibility (must come before any SDK include) ────────────── */
#include <Arduino.h>
#include <stdarg.h>
#ifdef min
#undef min
#endif
#ifdef max
#undef max
#endif
#ifdef round
#undef round
#endif
#ifdef DEFAULT
#undef DEFAULT
#endif
#ifdef A0
#undef A0
#endif
#ifdef A1
#undef A1
#endif
#ifdef A2
#undef A2
#endif

/* ── Data normalisation must be visible before model_variables.h loads ────── */
#ifndef EI_CLASSIFIER_HAS_DATA_NORMALIZATION
#define EI_CLASSIFIER_HAS_DATA_NORMALIZATION 1
#endif
#undef  __EI_DATA_NORMALIZATION_H__
#include "edge-impulse-sdk/classifier/ei_data_normalization.h"

/* ── Edge Impulse SDK — also pulls in model-parameters/model_variables.h ─── */
/* which includes model_variables_health.h and model_variables_forecast.h     */
#include "edge-impulse-sdk/classifier/ei_run_classifier.h"
#include "edge-impulse-sdk/dsp/numpy.hpp"

/* ── Own public header (class declaration only, no SDK includes) ─────────── */
#include "mango_guard.h"

/* =========================================================================
 *  Static label tables
 * ========================================================================= */

const char * const MangoGuard::HEALTH_LABELS[3] = {
    "Anthracnose", "Healthy", "Powdery Mildew"
};

/* =========================================================================
 *  Private helpers
 * ========================================================================= */

MangoGuard::HealthResult MangoGuard::_makeHealthError(int err) {
    HealthResult r;
    r.label = "error"; r.confidence = 0.0f;
    r.scores[0] = r.scores[1] = r.scores[2] = 0.0f;
    r.error = err;
    return r;
}

/* =========================================================================
 *  Health classifier  (project 908354 — camera / MobileNet)
 * ========================================================================= */

MangoGuard::HealthResult MangoGuard::runHealthClassifier(float *raw_pixels,
                                                          size_t length,
                                                          bool   debug_nn) {
    if (length != HEALTH_RAW_SAMPLE_COUNT) {
        ei_printf("MangoGuard::runHealthClassifier ERR: expected %u pixels, got %u\n",
                  (unsigned)HEALTH_RAW_SAMPLE_COUNT, (unsigned)length);
        return _makeHealthError(-100);
    }

    signal_t signal;
    int err = numpy::signal_from_buffer(raw_pixels, length, &signal);
    if (err != 0) return _makeHealthError(err);

    ei_impulse_result_t result = { 0 };
    EI_IMPULSE_ERROR ei_err = process_impulse(&impulse_handle_908354_24,
                                              &signal, &result, debug_nn);
    if (ei_err != EI_IMPULSE_OK) return _makeHealthError((int)ei_err);

    HealthResult hr;
    hr.error = 0; hr.label = HEALTH_LABELS[0]; hr.confidence = 0.0f;
    for (int i = 0; i < HEALTH_LABEL_COUNT; i++) {
        hr.scores[i] = result.classification[i].value;
        if (hr.scores[i] > hr.confidence) {
            hr.confidence = hr.scores[i];
            hr.label      = HEALTH_LABELS[i];
        }
    }
    return hr;
}

