/*
 * model-parameters/model_variables.h  — MangoGuard unified library
 *
 * ei_run_classifier.h hardcodes "#include model-parameters/model_variables.h"
 * at line 97. In a normal single-model library this file contains all the
 * impulse handle variables. Here we forward to both prefixed model-variable
 * headers so both impulse handles are defined in one compilation unit.
 *
 * IMPORTANT: ei_data_normalization.h must be included BEFORE the forecast
 * variables because they reference data_normalization_standard_scaler.
 * We define EI_CLASSIFIER_HAS_DATA_NORMALIZATION here so the SDK compiles
 * the normalization code for the forecasting model.
 */

#pragma once

#ifndef EI_CLASSIFIER_HAS_DATA_NORMALIZATION
#define EI_CLASSIFIER_HAS_DATA_NORMALIZATION 1
#endif
#undef  __EI_DATA_NORMALIZATION_H__

#include "edge-impulse-sdk/classifier/ei_data_normalization.h"
#include "../model-parameters-health/model_variables_health.h"
#include "../model-parameters-forecast/model_variables_forecast.h"

/* ei_run_classifier.h references ei_default_impulse for its legacy
 * run_classifier() / run_classifier_continuous() API.
 * We point it to the health model — at runtime we always call
 * process_impulse() with explicit handles so this is never used. */
static ei_impulse_handle_t ei_default_impulse = impulse_handle_908354_24;
